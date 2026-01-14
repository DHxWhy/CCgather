import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/news/contents
 * Fetch news from contents table with tag-based filtering
 *
 * Query params:
 * - tags: comma-separated tags (e.g., "claude,anthropic") - uses OR logic
 * - content_type: legacy support (optional, deprecated)
 * - limit: number (default: 10)
 * - offset: number (default: 0)
 *
 * Available tags:
 * - claude: Claude/Anthropic official news
 * - anthropic: Anthropic company news
 * - claude-code: Claude Code specific
 * - industry: AI industry news
 * - dev-tools: Developer tools (Supabase, Vercel, Cursor)
 * - openai: OpenAI/GPT news
 * - google: Google/Gemini news
 * - meta: Meta/Llama news
 * - community: Community content
 * - youtube: YouTube content
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tagsParam = searchParams.get("tags");
    const contentType = searchParams.get("content_type"); // Legacy support
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

    // Tag-based filtering (new system)
    if (tagsParam && tagsParam !== "all") {
      const tags = tagsParam
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tags.length > 0) {
        // Use overlaps operator for array containment (OR logic)
        query = query.overlaps("news_tags", tags);
      }
    }
    // Legacy content_type support (deprecated)
    else if (contentType) {
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
