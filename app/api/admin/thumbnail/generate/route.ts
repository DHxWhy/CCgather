import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateThumbnail, updateContentThumbnail } from "@/lib/gemini/thumbnail-generator";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    const body = await request.json();
    const { content_id, title, summary, force_regenerate } = body;

    if (!content_id || !title) {
      return NextResponse.json({ error: "content_id and title are required" }, { status: 400 });
    }

    // Check if content exists
    const { data: content } = await supabase
      .from("contents")
      .select("id, thumbnail_url, thumbnail_source")
      .eq("id", content_id)
      .single();

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    // Skip if already has thumbnail and not forcing regeneration
    if (content.thumbnail_url && content.thumbnail_source === "gemini" && !force_regenerate) {
      return NextResponse.json({
        success: true,
        thumbnail_url: content.thumbnail_url,
        source: content.thumbnail_source,
        message: "Existing Gemini thumbnail",
      });
    }

    // Generate new thumbnail
    const result = await generateThumbnail({
      content_id,
      title,
      summary,
      force_regenerate,
    });

    if (result.success && result.thumbnail_url) {
      // Update database
      await updateContentThumbnail(content_id, result.thumbnail_url, result.source);

      return NextResponse.json({
        success: true,
        thumbnail_url: result.thumbnail_url,
        source: result.source,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error || "Failed to generate thumbnail",
        source: "default",
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("Thumbnail generation API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
