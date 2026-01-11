import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/news/contents
 * Fetch news from contents table with content_type filtering
 *
 * Query params:
 * - content_type: "official" | "press" | "community" (optional)
 * - limit: number (default: 10)
 * - offset: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get("content_type");
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const supabase = await createClient();

    let query = supabase
      .from("contents")
      .select("*", { count: "exact" })
      .eq("type", "news")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    // Filter by content_type if specified
    if (contentType) {
      query = query.eq("content_type", contentType);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Failed to fetch news contents:", error);
      return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
    }

    return NextResponse.json({
      items: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("News contents API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
