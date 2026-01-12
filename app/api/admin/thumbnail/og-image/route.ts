import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchOgImage, updateContentThumbnail } from "@/lib/gemini/thumbnail-generator";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    const body = await request.json();
    const { content_id } = body;

    if (!content_id) {
      return NextResponse.json({ error: "content_id is required" }, { status: 400 });
    }

    // Get content with source_url
    const { data: content } = await supabase
      .from("contents")
      .select("id, source_url, thumbnail_url")
      .eq("id", content_id)
      .single();

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    if (!content.source_url) {
      return NextResponse.json({ error: "Content has no source URL" }, { status: 400 });
    }

    // Fetch OG image
    const result = await fetchOgImage(content.source_url);

    if (result.success && result.thumbnail_url) {
      // Update database
      await updateContentThumbnail(content_id, result.thumbnail_url, "og_image");

      return NextResponse.json({
        success: true,
        thumbnail_url: result.thumbnail_url,
        source: "og_image",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error || "OG image not found",
      },
      { status: 404 }
    );
  } catch (error) {
    console.error("OG image fetch API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
