import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCountryName } from "@/lib/constants/countries";

// =====================================================
// Types
// =====================================================

interface CommunityCountryStat {
  code: string;
  name: string;
  posts: number;
  likes: number;
  contributors: number;
}

interface CountryStatsRow {
  country_code: string;
  posts: number;
  likes: number;
  contributors: number;
}

// =====================================================
// GET /api/community/country-stats
// Returns community activity statistics grouped by country
// =====================================================

export async function GET() {
  try {
    const supabase = createServiceClient();

    // Query: Group posts by author's country, count posts, sum likes, count unique contributors
    const { data, error } = await supabase.rpc("get_community_country_stats");

    if (error) {
      // Fallback to direct query if RPC doesn't exist
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("posts")
        .select(
          `
          id,
          likes_count,
          author_id,
          users!posts_author_id_fkey (
            country_code
          )
        `
        )
        .is("deleted_at", null);

      if (fallbackError) {
        console.error("Error fetching community country stats:", fallbackError);
        return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
      }

      // Aggregate data manually
      const countryMap = new Map<
        string,
        { posts: number; likes: number; contributors: Set<string> }
      >();

      for (const post of fallbackData || []) {
        const countryCode = (post.users as { country_code: string | null } | null)?.country_code;
        if (!countryCode) continue;

        const existing = countryMap.get(countryCode) || {
          posts: 0,
          likes: 0,
          contributors: new Set<string>(),
        };

        existing.posts += 1;
        existing.likes += post.likes_count || 0;
        existing.contributors.add(post.author_id);

        countryMap.set(countryCode, existing);
      }

      // Convert to array and sort by likes
      const stats: CommunityCountryStat[] = Array.from(countryMap.entries())
        .map(([code, data]) => ({
          code,
          name: getCountryName(code),
          posts: data.posts,
          likes: data.likes,
          contributors: data.contributors.size,
        }))
        .sort((a, b) => b.likes - a.likes || b.posts - a.posts);

      return NextResponse.json({ stats });
    }

    // Transform RPC result
    const stats: CommunityCountryStat[] = ((data as CountryStatsRow[]) || []).map((row) => ({
      code: row.country_code,
      name: getCountryName(row.country_code),
      posts: Number(row.posts),
      likes: Number(row.likes),
      contributors: Number(row.contributors),
    }));

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Error in GET /api/community/country-stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
