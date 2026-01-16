import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  generateThumbnail,
  generateThumbnailWithOgReference,
  generateThumbnailWithGeminiFlash,
  generateDualThumbnails,
  generateDualThumbnailsWithOgReference,
  updateContentThumbnail,
} from "@/lib/gemini/thumbnail-generator";
import type { ArticleType } from "@/lib/ai/gemini-client";

type ModelType = "imagen" | "gemini_flash" | "dual";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    const body = await request.json();
    const {
      content_id,
      title,
      summary,
      force_regenerate,
      og_image_url,
      model = "imagen",
      useStyleTransfer = true,
    } = body;

    if (!content_id || !title) {
      return NextResponse.json({ error: "content_id and title are required" }, { status: 400 });
    }

    // Check if content exists and get AI classification + rich content for better generation
    const { data: content } = await supabase
      .from("contents")
      .select("id, thumbnail_url, thumbnail_source, ai_article_type, key_takeaways, one_liner")
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

    // Extract text from key_takeaways if they are objects
    const keyTakeawaysText = content.key_takeaways?.map((k: string | { text: string }) =>
      typeof k === "string" ? k : k.text
    );

    const requestParams = {
      content_id,
      title,
      summary,
      article_type: content.ai_article_type as ArticleType | undefined,
      force_regenerate,
      // Rich content for better image planning
      key_takeaways: keyTakeawaysText,
      one_liner: content.one_liner,
    };

    // Handle dual model generation
    if ((model as ModelType) === "dual") {
      const dualResult = og_image_url
        ? await generateDualThumbnailsWithOgReference({ ...requestParams, og_image_url })
        : await generateDualThumbnails(requestParams);

      // Return both results for UI selection
      return NextResponse.json({
        success: true,
        dual_results: {
          imagen: dualResult.imagen
            ? {
                url: dualResult.imagen.thumbnail_url,
                success: dualResult.imagen.success,
                error: dualResult.imagen.error,
                cost_usd: dualResult.imagen.cost_usd,
              }
            : null,
          gemini_flash: dualResult.gemini_flash
            ? {
                url: dualResult.gemini_flash.thumbnail_url,
                success: dualResult.gemini_flash.success,
                error: dualResult.gemini_flash.error,
                cost_usd: dualResult.gemini_flash.cost_usd,
              }
            : null,
        },
      });
    }

    // Single model generation
    let result;
    if ((model as ModelType) === "gemini_flash") {
      // For gemini_flash, use style transfer if OG image available and enabled
      if (og_image_url && useStyleTransfer) {
        result = await generateThumbnailWithOgReference({ ...requestParams, og_image_url });
      } else {
        result = await generateThumbnailWithGeminiFlash(requestParams);
      }
    } else if (og_image_url) {
      result = await generateThumbnailWithOgReference({ ...requestParams, og_image_url });
    } else {
      result = await generateThumbnail(requestParams);
    }

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
