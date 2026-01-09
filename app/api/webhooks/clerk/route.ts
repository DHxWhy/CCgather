import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

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

      // Use GitHub username (preserves case) if available, otherwise fall back to Clerk username
      const githubAccount = external_accounts?.find(
        (acc: { provider: string }) => acc.provider === "oauth_github"
      );
      const finalUsername = githubAccount?.username || username || `user_${id.slice(0, 8)}`;

      const displayName =
        [first_name, last_name].filter(Boolean).join(" ") || finalUsername || "Anonymous";

      const { error } = await getSupabaseAdmin().from("users").insert({
        clerk_id: id,
        username: finalUsername,
        display_name: displayName,
        avatar_url: image_url,
        email: email,
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

      // Use GitHub username (preserves case) if available
      const githubAccount = external_accounts?.find(
        (acc: { provider: string }) => acc.provider === "oauth_github"
      );
      const finalUsername = githubAccount?.username || username;

      const displayName =
        [first_name, last_name].filter(Boolean).join(" ") || finalUsername || "Anonymous";

      const { error } = await getSupabaseAdmin()
        .from("users")
        .update({
          username: finalUsername || undefined,
          display_name: displayName,
          avatar_url: image_url,
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
