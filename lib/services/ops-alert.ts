import type { SupabaseClient } from "@supabase/supabase-js";

const DISCORD_TIMEOUT_MS = 3000;

export async function alertOps(title: string, detail: Record<string, unknown>): Promise<void> {
  const payload = { evt: "ops_alert", title, ...detail, ts: new Date().toISOString() };
  console.error(JSON.stringify(payload));

  const webhookUrl = (process.env.DISCORD_WEBHOOK_ISSUE ?? process.env.DISCORD_WEBHOOK_NEW_USER)
    ?.replace(/\\n$/, "")
    .trim();
  if (!webhookUrl) return;

  const fields = Object.entries(detail)
    .slice(0, 8)
    .map(([name, value]) => ({
      name: name.slice(0, 256),
      // An embed field needs a value: an empty one goes out as a dash
      value: String(value).slice(0, 1000) || "—",
      inline: true,
    }));

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
      body: JSON.stringify({
        username: "CCgather Ops",
        embeds: [
          {
            title: `🚨 ${title}`.slice(0, 256),
            color: 0xef4444,
            fields,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
    if (!response.ok) console.warn("[ops-alert] Discord push refused:", response.status);
  } catch (error) {
    console.warn("[ops-alert] Discord push failed:", error);
  }
}

// 20 hours rather than 24: a member who submits at about the same time every day is back after
// 23-odd hours, and something that goes wrong for them daily should be pushed daily.
const ONCE_PER_USER_WINDOW_MS = 20 * 60 * 60 * 1000;
// What this instance pushed while the record could not be read or written, by type and user.
// Without the row nothing else holds the limit, and whoever can make the read or the insert
// fail could repeat the alert at will.
const pushedWithoutRecord = new Map<string, number>();
const PUSHED_WITHOUT_RECORD_MAX = 1000;

function alreadyPushedWithoutRecord(alert: UserAlert): boolean {
  const key = `${alert.type}:${alert.userId}`;
  const pushedAt = pushedWithoutRecord.get(key);
  if (pushedAt !== undefined && Date.now() - pushedAt < ONCE_PER_USER_WINDOW_MS) return true;
  if (pushedWithoutRecord.size >= PUSHED_WITHOUT_RECORD_MAX) pushedWithoutRecord.clear();
  pushedWithoutRecord.set(key, Date.now());
  return false;
}

export interface UserAlert {
  /** admin_alerts.type — with the user, what the limit counts */
  type: string;
  userId: string;
  title: string;
  /** Shown on the admin dashboard */
  message: string;
  detail: Record<string, unknown>;
}

/** The push is held back, the occurrence is not: every one leaves a line in the server log. */
function held(alert: UserAlert): "deduped" {
  console.error(
    JSON.stringify({
      evt: "ops_alert_held",
      type: alert.type,
      title: alert.title,
      userId: alert.userId,
      ...alert.detail,
      ts: new Date().toISOString(),
    })
  );
  return "deduped";
}

/**
 * alertOps for something a signed-in client can cause as often as it likes: one push per user and
 * type in 20 hours. The admin_alerts row is the record and the limit at once, so repeating the
 * request cannot fill the channel or run the webhook into its rate limit, where a real alert
 * sent in the same minute would be dropped.
 */
export async function alertOpsOncePerUser(
  supabase: SupabaseClient,
  alert: UserAlert
): Promise<"notified" | "deduped"> {
  try {
    const since = new Date(Date.now() - ONCE_PER_USER_WINDOW_MS).toISOString();
    const earliestRow = async (): Promise<{ id: string | null } | "unreadable"> => {
      const { data, error } = await supabase
        .from("admin_alerts")
        .select("id")
        .eq("type", alert.type)
        .filter("metadata->>user_id", "eq", alert.userId)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(1);
      if (error) return "unreadable";
      return { id: (data as { id: string }[] | null)?.[0]?.id ?? null };
    };

    const before = await earliestRow();
    if (before === "unreadable") {
      console.warn(`[ops-alert] admin_alerts read failed for ${alert.type}`);
      if (alreadyPushedWithoutRecord(alert)) return held(alert);
    } else if (before.id !== null) {
      return held(alert);
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("admin_alerts")
        .insert({
          type: alert.type,
          message: alert.message,
          metadata: { user_id: alert.userId, ...alert.detail },
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        console.warn(
          `[ops-alert] admin_alerts insert failed for ${alert.type}:`,
          insertError?.message ?? "no row returned"
        );
        if (alreadyPushedWithoutRecord(alert)) return held(alert);
      } else {
        // Requests that arrive together all pass the check above; the one whose row is first sends
        const first = await earliestRow();
        if (first !== "unreadable" && first.id !== null && first.id !== inserted.id) {
          return held(alert);
        }
      }
    }
  } catch (error) {
    console.warn(
      "[ops-alert] admin_alerts unreachable:",
      error instanceof Error ? error.message : String(error)
    );
    if (alreadyPushedWithoutRecord(alert)) return held(alert);
  }

  await alertOps(alert.title, alert.detail);
  return "notified";
}
