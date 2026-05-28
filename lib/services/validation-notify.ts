/**
 * Validation issue notification — Discord "이슈감지" channel + admin_alerts row.
 *
 * Triggered when a CLI submission produces a HARD validation finding. This is
 * STRICTLY observe-only:
 *   - NEVER throws (fire-and-forget; a failure here must not affect the submit)
 *   - NEVER blocks the user (CCgather does not reject submissions over numbers)
 *   - Dedups per user within 24h so frequent submitters don't spam the channel
 *
 * PII policy (matches notifyDiscordNewUser in webhooks/clerk): email is never
 * included — only the public handle (username) and GitHub URL.
 *
 * Mirrors the env-sanitize + fire-and-forget pattern already proven in
 * `app/api/webhooks/clerk/route.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const ALERT_TYPE = "validation_issue";
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const DISCORD_RED = 0xe74c3c;
const DISCORD_FIELD_MAX = 1000; // Discord field value hard limit is 1024

export interface ValidationHardFlag {
  code: string;
  detail?: string;
}

export interface NotifyValidationIssueParams {
  supabase: SupabaseClient;
  userId: string;
  username: string;
  githubId?: string | null;
  hardFlags: ValidationHardFlag[];
  totalTokens?: number;
  totalSpent?: number;
}

/**
 * Record + push a validation issue. Returns the action taken (useful for tests
 * and logging). Never rejects.
 */
export async function notifyValidationIssue(
  params: NotifyValidationIssueParams
): Promise<"skipped_no_flags" | "skipped_deduped" | "recorded_no_webhook" | "notified" | "error"> {
  const { supabase, userId, username, githubId, hardFlags, totalTokens, totalSpent } = params;
  if (!hardFlags || hardFlags.length === 0) return "skipped_no_flags";

  try {
    // ── Dedup: skip entirely if this user was already alerted within 24h ───────
    const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
    const { data: existing } = await supabase
      .from("admin_alerts")
      .select("id")
      .eq("type", ALERT_TYPE)
      .filter("metadata->>user_id", "eq", userId)
      .gte("created_at", since)
      .limit(1);

    if (existing && existing.length > 0) return "skipped_deduped";

    const codes = hardFlags.map((f) => f.code);

    // ── Always record an admin_alerts row (powers the admin dashboard) ─────────
    const { error: insertErr } = await supabase.from("admin_alerts").insert({
      type: ALERT_TYPE,
      message: `제출 검토 필요: @${username} (${codes.join(", ")})`,
      metadata: {
        user_id: userId,
        username,
        flag_codes: codes,
        details: hardFlags.map((f) => f.detail ?? ""),
        total_tokens: totalTokens ?? null,
        total_spent: totalSpent ?? null,
        flagged_at: new Date().toISOString(),
      },
    });
    if (insertErr) {
      // Surface insert failures — otherwise an alert could go to Discord but be
      // missing from the admin dashboard (dedup also relies on this row).
      console.warn("[validation-notify] admin_alerts insert failed:", insertErr.message);
    }

    // ── Discord push (optional — only when webhook is configured) ──────────────
    // Vercel env vars can carry a literal `\n` or trailing whitespace from
    // copy-paste; sanitize the same way the new-user webhook does.
    const webhookUrl = process.env.DISCORD_WEBHOOK_ISSUE?.replace(/\\n$/, "").trim();
    if (!webhookUrl) return "recorded_no_webhook";

    const githubUrl = githubId ? `https://github.com/${username}` : null;
    const avatarUrl = githubId ? `https://avatars.githubusercontent.com/u/${githubId}?v=4` : null;
    const reviewUrl = `https://ccgather.com/superadmin/analytics/submit-logs?search=${encodeURIComponent(
      username
    )}`;
    const kst = new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const reasonText = hardFlags
      .map((f) => `\`${f.code}\`${f.detail ? ` — ${f.detail}` : ""}`)
      .join("\n")
      .slice(0, DISCORD_FIELD_MAX);

    const payload = {
      username: "CCgather 이슈감지",
      content: "🚨 **제출 검토 필요**",
      embeds: [
        {
          title: `@${username}`,
          url: githubUrl,
          color: DISCORD_RED,
          ...(avatarUrl && { thumbnail: { url: avatarUrl } }),
          fields: [
            { name: "사유", value: reasonText || "—", inline: false },
            {
              name: "토큰",
              value: totalTokens != null ? totalTokens.toLocaleString() : "—",
              inline: true,
            },
            {
              name: "비용",
              value: totalSpent != null ? `$${totalSpent.toLocaleString()}` : "—",
              inline: true,
            },
            { name: "검토", value: `[제출 로그 열기](${reviewUrl})`, inline: false },
            { name: "감지 시각 (KST)", value: kst, inline: false },
          ],
          footer: { text: "CCgather · 이슈감지" },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    // Bound the Discord call so a slow webhook can't delay the user's submit
    // response. Caller awaits this in the hot path; 3s is a generous ceiling.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        console.warn("[validation-notify] Discord non-2xx:", { status: res.status, username });
      }
    } finally {
      clearTimeout(timeout);
    }
    return "notified";
  } catch (err) {
    // Fire-and-forget: never propagate.
    console.warn(
      "[validation-notify] failed (non-fatal):",
      err instanceof Error ? err.message : String(err)
    );
    return "error";
  }
}
