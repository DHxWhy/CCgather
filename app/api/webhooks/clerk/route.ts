import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

// Generate 5-character alphanumeric referral code
function generateShortCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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

      // Generate short 5-character referral code
      const referralCode = generateShortCode();

      const { error } = await getSupabaseAdmin().from("users").insert({
        clerk_id: id,
        username: finalUsername,
        display_name: displayName,
        avatar_url: avatarUrl,
        email: email,
        referral_code: referralCode,
      });

      if (error) {
        console.error("Failed to create user:", error);
        return new Response("Failed to create user", { status: 500 });
      }
      break;
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

      const { error } = await getSupabaseAdmin()
        .from("users")
        .update({
          username: finalUsername || undefined,
          display_name: displayName,
          avatar_url: avatarUrl,
          email: email,
          updated_at: new Date().toISOString(),
        })
        .eq("clerk_id", id);

      if (error) {
        console.error("Failed to update user:", error);
        return new Response("Failed to update user", { status: 500 });
      }
      break;
    }

    case "user.deleted": {
      const { id } = evt.data;

      if (id) {
        const { error } = await getSupabaseAdmin().from("users").delete().eq("clerk_id", id);

        if (error) {
          console.error("Failed to delete user:", error);
          return new Response("Failed to delete user", { status: 500 });
        }
      }
      break;
    }

    default:
      console.log(`Unhandled webhook event: ${eventType}`);
  }

  return new Response("OK", { status: 200 });
}
