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

      // UPSERT on clerk_id — absorbs the most common race (Clerk retry, /api/me
      // fallback already created the row). Other UNIQUE violations
      // (username/referral_code/github_id) still surface as 23505.
      const { error } = await supabaseAdmin.from("users").upsert(
        {
          clerk_id: id,
          github_id: githubId,
          username: finalUsername,
          display_name: displayName,
          avatar_url: avatarUrl,
          email: email,
          referral_code: referralCode,
        },
        { onConflict: "clerk_id" }
      );

      if (!error) break;

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
            referral_code: retryReferralCode,
          },
          { onConflict: "clerk_id" }
        );

        if (!retryError) {
          console.log("[webhook] user.created succeeded on retry:", {
            clerk_id: id,
            retryUsername,
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
