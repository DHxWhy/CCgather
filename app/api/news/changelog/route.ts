import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ChangelogListResponse, ChangelogVersionWithCounts } from "@/types/changelog";

/**
 * GET /api/news/changelog
 * 버전 목록 조회
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = (page - 1) * limit;

  try {
    const supabase = await createClient();

    // 버전 목록 조회 (with counts view 사용)
    const {
      data: versions,
      error,
      count,
    } = await supabase
      .from("changelog_versions_with_counts")
      .select("*", { count: "exact" })
      .order("version", { ascending: false }) // 최신 버전 순
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Failed to fetch changelog versions:", error);
      return NextResponse.json({ error: "Failed to fetch changelog versions" }, { status: 500 });
    }

    const response: ChangelogListResponse = {
      versions: (versions || []) as ChangelogVersionWithCounts[],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Changelog API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
