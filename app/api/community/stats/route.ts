import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// =====================================================
// Types
// =====================================================

interface CommunityStatsRow {
  total_countries: number;
  total_posts: number;
  total_likes: number;
}

// Fallback types (레거시 호환)
interface UserCountryRow {
  country_code: string | null;
}

// =====================================================
// GET /api/community/stats
// Returns total cumulative community statistics from cached table
// - totalCountries: unique countries with onboarded users
// - totalPosts: all posts (not deleted)
// - totalLikes: total likes count
// =====================================================

export async function GET() {
  try {
    const supabase = createServiceClient();

    // Primary: community_stats 테이블에서 조회 (O(1))
    const { data: stats, error } = await supabase
      .from("community_stats")
      .select("total_countries, total_posts, total_likes")
      .eq("id", "global")
      .single();

    if (!error && stats) {
      const typedStats = stats as CommunityStatsRow;
      return NextResponse.json({
        totalCountries: typedStats.total_countries,
        totalPosts: typedStats.total_posts,
        totalLikes: typedStats.total_likes,
      });
    }

    // Fallback: 테이블 조회 실패 시 기존 방식으로 계산
    console.warn("community_stats table query failed, using fallback:", error?.message);

    const [countriesResult, postsResult, likesResult] = await Promise.all([
      supabase
        .from("users")
        .select("country_code")
        .eq("onboarding_completed", true)
        .is("deleted_at", null)
        .gt("total_tokens", 0)
        .not("country_code", "is", null),
      supabase.from("posts").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("post_likes").select("id", { count: "exact", head: true }),
    ]);

    const uniqueCountries = new Set(
      ((countriesResult.data as UserCountryRow[]) || []).map((u) => u.country_code).filter(Boolean)
    );

    return NextResponse.json({
      totalCountries: uniqueCountries.size,
      totalPosts: postsResult.count || 0,
      totalLikes: likesResult.count || 0,
    });
  } catch (error) {
    console.error("Error in GET /api/community/stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
