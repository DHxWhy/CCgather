import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

// Generate 5-character alphanumeric referral code (CSPRNG)
function generateShortCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(bytes[i]! % chars.length);
  }
  return code;
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Discord 신규 가입 알림 (fire-and-forget).
// webhook URL 은 DISCORD_WEBHOOK_NEW_USER env var. 미설정 시 silent skip.
// 실패해도 가입 흐름 막지 않음 — try/catch 로 swallow.
// PII 노출 방지: email 절대 포함 X, username + display_name + GitHub URL 만.
async function notifyDiscordNewUser({
  username,
  displayName,
  githubId,
}: {
  username: string;
  displayName: string;
  githubId: string | null;
}): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_NEW_USER;
  if (!webhookUrl) return;

  try {
    const githubUrl = githubId ? `https://github.com/${username}` : null;
    const avatarUrl = githubId ? `https://avatars.githubusercontent.com/u/${githubId}?v=4` : null;
    const kst = new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const payload = {
      username: "CCgather 가입봇",
      content: "🎉 **신규 회원 가입**",
      embeds: [
        {
          title: displayName,
          url: githubUrl,
          color: 0xda7756, // coral
          ...(avatarUrl && { thumbnail: { url: avatarUrl } }),
          fields: [
            { name: "Username", value: `\`${username}\``, inline: true },
            {
              name: "GitHub",
              value: githubUrl ? `[프로필](${githubUrl})` : "—",
              inline: true,
            },
            { name: "가입 시각 (KST)", value: kst, inline: true },
          ],
          footer: { text: "CCgather · ccgather.com" },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn("[webhook] Discord notify non-2xx:", {
        status: response.status,
        username,
      });
    }
  } catch (err) {
    console.warn("[webhook] Discord notify failed:", err);
  }
}

// Postgres constraint-violation SQLSTATEs (class 23) are permanent — retrying
// the same payload won't fix them. Return 200 in those cases so Clerk stops
// retrying for 24h and we surface the issue via logs instead of error backoff.
function isPermanentPgError(code?: string | null): boolean {
  if (!code) return false;
  return code.startsWith("23");
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET environment variable");
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const eventType = evt.type;

  switch (eventType) {
    case "user.created": {
      const { id, username, first_name, last_name, image_url, email_addresses, external_accounts } =
        evt.data;
      const email = email_addresses[0]?.email_address;

      // Use GitHub OAuth data if available (preserves case, gets latest profile)
      const githubAccount = external_accounts?.find(
        (acc: { provider: string }) => acc.provider === "oauth_github"
      ) as
        | {
            provider: string;
            username?: string;
            first_name?: string;
            last_name?: string;
            avatar_url?: string;
            provider_user_id?: string;
          }
        | undefined;

      const finalUsername = githubAccount?.username || username || `user_${id.slice(0, 8)}`;

      // Prioritize GitHub OAuth name over Clerk profile name
      const githubDisplayName = githubAccount
        ? [githubAccount.first_name, githubAccount.last_name].filter(Boolean).join(" ")
        : null;
      const clerkDisplayName = [first_name, last_name].filter(Boolean).join(" ");
      const displayName = githubDisplayName || clerkDisplayName || finalUsername || "Anonymous";

      // Use GitHub avatar if available
      const avatarUrl = githubAccount?.avatar_url || image_url;

      // Immutable GitHub numeric ID — survives username/email changes, used for
      // safe email-based account linking in /api/me to prevent hijacks.
      const githubId = githubAccount?.provider_user_id || null;

      // Generate short 5-character referral code
      const referralCode = generateShortCode();

      const supabaseAdmin = getSupabaseAdmin();

      // 1차 INSERT 시도 — 신규 행이면 referral_code 포함.
      // Mercury P1 fix: UPSERT 가 /api/me 가 만든 referral_code 를 덮어쓰는 race
      // 방지 위해 두 단계로 분리:
      //   (a) INSERT (referral_code 포함) — 새 행이면 성공
      //   (b) 23505 인 경우만 UPDATE (referral_code 제외) — 기존 행 보호
      //
      // Frictionless 가입 정책: onboarding_completed/consents 를 webhook 단계에서
      // 미리 true 로 세팅. country_code 는 /api/me 가 ip-country 헤더로 채움.
      const userPayload = {
        clerk_id: id,
        github_id: githubId,
        username: finalUsername,
        display_name: displayName,
        avatar_url: avatarUrl,
        email: email,
        onboarding_completed: true,
        profile_visibility_consent: true,
        community_updates_consent: true,
        integrity_agreed: true,
        marketing_consent: false,
      };
      const { error: insertErr } = await supabaseAdmin
        .from("users")
        .insert({ ...userPayload, referral_code: referralCode });
      let error = insertErr;
      let isNewUser = !insertErr;
      // clerk_id 충돌 (= /api/me 가 먼저 만든 행) 일 때만 UPDATE — referral_code 제외
      if (error?.code === "23505") {
        const { error: updateErr } = await supabaseAdmin
          .from("users")
          .update({ ...userPayload, updated_at: new Date().toISOString() })
          .eq("clerk_id", id);
        if (!updateErr) {
          // 기존 행 갱신 성공 — break 흐름으로 진입 (재가입/탈퇴 복구 등 → 알림 X)
          error = null;
          isNewUser = false;
        }
        // updateErr 가 있어도 일단 23505 retry 분기 진입 → username/referral_code race 처리
      }

      if (!error) {
        // 진짜 신규 가입만 Discord 알림 (재가입/UPDATE 는 제외)
        if (isNewUser) {
          void notifyDiscordNewUser({
            username: finalUsername,
            displayName,
            githubId,
          });
        }
        break;
      }

      // Constraint violation on a non-clerk_id column (username/referral_code/etc).
      // Retry once with a fresh referral_code + a uniquified username — covers the
      // two realistic collision sources at signup volume.
      if (error.code === "23505") {
        const retryUsername = `${finalUsername}_${id.slice(-8)}`;
        const retryReferralCode = generateShortCode();
        const { error: retryError } = await supabaseAdmin.from("users").upsert(
          {
            clerk_id: id,
            github_id: githubId,
            username: retryUsername,
            display_name: displayName,
            avatar_url: avatarUrl,
            email: email,
            onboarding_completed: true,
            profile_visibility_consent: true,
            community_updates_consent: true,
            integrity_agreed: true,
            marketing_consent: false,
            referral_code: retryReferralCode,
          },
          { onConflict: "clerk_id" }
        );

        if (!retryError) {
          console.log("[webhook] user.created succeeded on retry:", {
            clerk_id: id,
            retryUsername,
          });
          void notifyDiscordNewUser({
            username: retryUsername,
            displayName,
            githubId,
          });
          break;
        }

        // Retry also failed — log and stop Clerk's 24h backoff (200 OK)
        console.error("[webhook] user.created retry failed:", {
          code: retryError.code,
          message: retryError.message,
          clerk_id: id,
        });
        return new Response("OK (logged retry failure)", { status: 200 });
      }

      // Non-23505 error: classify by whether retry is meaningful
      if (isPermanentPgError(error.code)) {
        // Schema/data issue — Clerk retrying won't help. Log + 200.
        console.error("[webhook] user.created permanent error (no retry):", {
          code: error.code,
          message: error.message,
          clerk_id: id,
        });
        return new Response("OK (permanent error logged)", { status: 200 });
      }

      // Transient (connection, timeout, etc.) — let Clerk retry with backoff
      console.error("[webhook] user.created transient error (will retry):", {
        code: error.code,
        message: error.message,
        clerk_id: id,
      });
      return new Response("Transient failure", { status: 503 });
    }

    case "user.updated": {
      const { id, username, first_name, last_name, image_url, email_addresses, external_accounts } =
        evt.data;
      const email = email_addresses[0]?.email_address;

      // Use GitHub OAuth data if available (preserves case, gets latest profile)
      const githubAccount = external_accounts?.find(
        (acc: { provider: string }) => acc.provider === "oauth_github"
      ) as
        | {
            provider: string;
            username?: string;
            first_name?: string;
            last_name?: string;
            avatar_url?: string;
            provider_user_id?: string;
          }
        | undefined;

      const finalUsername = githubAccount?.username || username;

      // Prioritize GitHub OAuth name over Clerk profile name
      const githubDisplayName = githubAccount
        ? [githubAccount.first_name, githubAccount.last_name].filter(Boolean).join(" ")
        : null;
      const clerkDisplayName = [first_name, last_name].filter(Boolean).join(" ");
      const displayName = githubDisplayName || clerkDisplayName || finalUsername || "Anonymous";

      // Use GitHub avatar if available
      const avatarUrl = githubAccount?.avatar_url || image_url;

      // Backfill / refresh immutable GitHub numeric ID (no-op if Clerk omits it)
      const githubId = githubAccount?.provider_user_id || undefined;

      const { error } = await getSupabaseAdmin()
        .from("users")
        .update({
          ...(githubId !== undefined ? { github_id: githubId } : {}),
          username: finalUsername || undefined,
          display_name: displayName,
          avatar_url: avatarUrl,
          email: email,
          updated_at: new Date().toISOString(),
        })
        .eq("clerk_id", id);

      if (error) {
        if (isPermanentPgError(error.code)) {
          console.error("[webhook] user.updated permanent error (no retry):", {
            code: error.code,
            message: error.message,
            clerk_id: id,
          });
          return new Response("OK (permanent error logged)", { status: 200 });
        }
        console.error("[webhook] user.updated transient error (will retry):", {
          code: error.code,
          message: error.message,
          clerk_id: id,
        });
        return new Response("Transient failure", { status: 503 });
      }
      break;
    }

    case "user.deleted": {
      const { id } = evt.data;

      if (id) {
        // Use soft delete (7-day grace period) instead of hard delete
        // to match the app's deletion flow and preserve user recovery option
        const { data, error } = await getSupabaseAdmin().rpc("soft_delete_user", {
          target_clerk_id: id,
        });

        if (error) {
          if (isPermanentPgError(error.code)) {
            console.error("[webhook] user.deleted permanent error (no retry):", {
              code: error.code,
              message: error.message,
              clerk_id: id,
            });
            return new Response("OK (permanent error logged)", { status: 200 });
          }
          console.error("[webhook] user.deleted transient error (will retry):", {
            code: error.code,
            message: error.message,
            clerk_id: id,
          });
          return new Response("Transient failure", { status: 503 });
        }

        // If user was already deleted or not found, still return OK
        if (!data?.success) {
          console.log("Soft delete skipped (already deleted or not found):", { clerk_id: id });
        }
      }
      break;
    }

    default:
      console.log(`Unhandled webhook event: ${eventType}`);
  }

  return new Response("OK", { status: 200 });
}
