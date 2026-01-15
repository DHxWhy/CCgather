import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();

  // Fetch user profile data
  const { data: user, error: userError } = await supabase
    .from("users")
    .select(
      `
      id,
      username,
      display_name,
      avatar_url,
      country_code,
      current_level,
      global_rank,
      country_rank,
      total_tokens,
      total_cost,
      social_links,
      ccplan,
      ccplan_rank
    `
    )
    .eq("id", id)
    .single();

  if (userError || !user) {
    console.error("User profile query error:", userError);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Return user profile in LeaderboardUser-compatible format
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      country_code: user.country_code,
      current_level: user.current_level || 1,
      global_rank: user.global_rank,
      country_rank: user.country_rank,
      total_tokens: user.total_tokens || 0,
      total_cost: user.total_cost || 0,
      social_links: user.social_links,
      ccplan: user.ccplan,
      ccplan_rank: user.ccplan_rank,
    },
  });
}
