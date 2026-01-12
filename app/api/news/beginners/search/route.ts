import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BeginnersSearchResponse, BeginnersDictionaryItem } from "@/types/changelog";

/**
 * GET /api/news/beginners/search?q=...
 * FOR BEGINNERS 사전 검색
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // 이름, slug, 설명에서 검색
    const { data: items, error: searchError } = await supabase
      .from("beginners_dictionary")
      .select("*")
      .eq("verification_status", "approved")
      .or(
        `name.ilike.%${query}%,slug.ilike.%${query}%,what_it_does.ilike.%${query}%,for_beginners.ilike.%${query}%`
      )
      .order("popularity_score", { ascending: false })
      .limit(limit);

    if (searchError) {
      console.error("Failed to search beginners dictionary:", searchError);
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    const response: BeginnersSearchResponse = {
      items: (items || []) as BeginnersDictionaryItem[],
      query,
      totalResults: (items || []).length,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Beginners search API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
