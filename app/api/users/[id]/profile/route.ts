import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();

  // Fetch user profile data (including deleted_at for status check)
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
      total_sessions,
      social_links,
      ccplan,
      has_opus_usage,
      deleted_at
    `
    )
    .eq("id", id)
    .single();

  // Count user's posts
  const { count: postCount } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("author_id", id)
    .is("deleted_at", null);

  if (userError || !user) {
    console.error("User profile query error:", userError);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if user has requested account deletion
  if (user.deleted_at) {
    return NextResponse.json({
      user: {
        id: user.id,
        username: "deleted_user",
        display_name: "Deleted User",
        avatar_url: null,
        country_code: null,
        current_level: 0,
        global_rank: null,
        country_rank: null,
        total_tokens: 0,
        total_cost: 0,
        social_links: null,
        ccplan: null,
        is_deleted: true,
      },
    });
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
      total_sessions: user.total_sessions || 0,
      social_links: user.social_links,
      ccplan: user.ccplan,
      has_opus_usage: user.has_opus_usage || false,
      post_count: postCount || 0,
    },
  });
}
