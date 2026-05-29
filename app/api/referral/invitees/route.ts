import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/referral/invitees
// Returns the list of users this account referred (active only), newest first.
// Powers the avatar stack in settings' Invite Friends section.
export async function GET() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Resolve current user (active only)
  const { data: me, error: meError } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .is("deleted_at", null)
    .single();

  if (meError || !me) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Active referrals only — same basis as the social-badge count.
  // Small set in practice (capped at 100) so the 1000-row limit is irrelevant.
  const { data: invitees, error } = await supabase
    .from("users")
    .select("username, avatar_url, custom_avatar_url, created_at")
    .eq("referred_by", me.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[referral/invitees] query failed:", error.message);
    return NextResponse.json({ error: "Failed to load invitees" }, { status: 500 });
  }

  return NextResponse.json({
    invitees: (invitees ?? []).map(
      (u: { username: string; avatar_url: string | null; custom_avatar_url: string | null }) => ({
        username: u.username,
        avatarUrl: u.custom_avatar_url || u.avatar_url || null,
      })
    ),
  });
}
