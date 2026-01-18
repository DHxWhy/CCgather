/**
 * News View Count API
 * POST /api/news/[slug]/view - Increment view count
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json({ error: "Slug required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get current view count
    const { data: current } = await supabase
      .from("contents")
      .select("view_count")
      .eq("slug", slug)
      .eq("type", "news")
      .eq("status", "published")
      .single();

    if (!current) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Increment view count
    const { error } = await supabase
      .from("contents")
      .update({ view_count: (current.view_count || 0) + 1 })
      .eq("slug", slug)
      .eq("type", "news");

    if (error) {
      console.error("[News View] Update error:", error);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[News View] Error:", error);
    return NextResponse.json({ error: "Failed to track view" }, { status: 500 });
  }
}
