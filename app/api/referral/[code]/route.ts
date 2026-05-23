import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Pending-referral cookie — picked up by /api/me on first authenticated request
// after sign-up so attribution survives even if localStorage is cleared between
// /j/[code] and onboarding (private mode, app/browser switch, etc.).
const PENDING_REF_COOKIE = "ccg_pending_ref";
const PENDING_REF_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function attachPendingRefCookie(response: NextResponse, code: string): NextResponse {
  response.cookies.set({
    name: PENDING_REF_COOKIE,
    value: code,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_REF_MAX_AGE,
  });
  return response;
}

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  if (!code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const normalizedCode = code.toLowerCase();
  const supabase = createServiceClient();

  // Find user by referral code (exclude soft-deleted accounts)
  const { data: user, error } = await supabase
    .from("users")
    .select(
      "id, username, display_name, avatar_url, total_tokens, global_rank, hide_profile_on_invite"
    )
    .eq("referral_code", normalizedCode)
    .is("deleted_at", null)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  // If user chose to hide profile, return minimal info
  if (user.hide_profile_on_invite) {
    return attachPendingRefCookie(
      NextResponse.json({
        inviter: {
          username: user.username,
          display_name: null,
          avatar_url: null,
          total_tokens: null,
          global_rank: null,
          hidden: true,
        },
      }),
      normalizedCode
    );
  }

  return attachPendingRefCookie(
    NextResponse.json({
      inviter: {
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        total_tokens: user.total_tokens || 0,
        global_rank: user.global_rank || 999,
        hidden: false,
      },
    }),
    normalizedCode
  );
}
