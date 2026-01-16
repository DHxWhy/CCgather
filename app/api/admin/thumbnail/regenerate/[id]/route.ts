import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAdminAccess } from "@/lib/admin";
import { getThumbnailWithFallback } from "@/lib/gemini/thumbnail-generator";

// POST - Regenerate thumbnail for a single content
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await checkAdminAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { thumbnailModel = "gemini_flash", useStyleTransfer = true } = body as {
      thumbnailModel?: "imagen" | "gemini_flash";
      useStyleTransfer?: boolean; // Use OG image colors/mood for generation
    };

    const supabase = createServiceClient();

    // Get content with rich data for better thumbnail generation
    const { data: content, error } = await supabase
      .from("contents")
      .select("id, source_url, title, summary_md, ai_article_type, key_takeaways, one_liner")
      .eq("id", id)
      .single();

    if (error || !content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    console.log(
      `[Thumbnail Regenerate] Processing: ${content.id} (model: ${thumbnailModel}, styleTransfer: ${useStyleTransfer})`
    );

    const thumbnailResult = await getThumbnailWithFallback(
      content.id,
      content.source_url,
      content.title,
      content.summary_md,
      false, // skipAiGeneration
      content.ai_article_type,
      thumbnailModel,
      useStyleTransfer, // Use OG image colors/mood for generation
      {
        // Rich content for better image planning
        key_takeaways: content.key_takeaways,
        one_liner: content.one_liner,
      }
    );

    if (!thumbnailResult.success) {
      return NextResponse.json(
        { error: thumbnailResult.error || "Generation failed" },
        { status: 500 }
      );
    }

    // Log AI usage
    if (thumbnailResult.cost_usd && thumbnailResult.cost_usd > 0) {
      const modelName =
        thumbnailResult.source === "imagen" ? "imagen-4.0-generate-001" : "gemini-2.5-flash-image";
      await supabase.from("ai_usage_log").insert({
        request_type: "thumbnail_regenerate",
        operation: thumbnailResult.source === "imagen" ? "thumbnail_imagen" : "thumbnail_gemini",
        model: modelName,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        cost_usd: thumbnailResult.cost_usd,
        metadata: {
          content_id: content.id,
          source: thumbnailResult.source,
        },
      });
    }

    console.log(`[Thumbnail Regenerate] Success: ${content.id} → ${thumbnailResult.source}`);

    return NextResponse.json({
      success: true,
      thumbnail_url: thumbnailResult.thumbnail_url,
      source: thumbnailResult.source,
      cost_usd: thumbnailResult.cost_usd || 0,
    });
  } catch (error) {
    console.error("[Thumbnail Regenerate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
