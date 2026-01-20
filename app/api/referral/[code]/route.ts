import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  if (!code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Find user by referral code
  const { data: user, error } = await supabase
    .from("users")
    .select(
      "id, username, display_name, avatar_url, total_tokens, global_rank, hide_profile_on_invite"
    )
    .eq("referral_code", code.toLowerCase())
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  // If user chose to hide profile, return minimal info
  if (user.hide_profile_on_invite) {
    return NextResponse.json({
      inviter: {
        username: user.username,
        display_name: null,
        avatar_url: null,
        total_tokens: null,
        global_rank: null,
        hidden: true,
      },
    });
  }

  return NextResponse.json({
    inviter: {
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      total_tokens: user.total_tokens || 0,
      global_rank: user.global_rank || 999,
      hidden: false,
    },
  });
}
