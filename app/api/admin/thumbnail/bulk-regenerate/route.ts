import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getThumbnailWithFallback } from "@/lib/gemini/thumbnail-generator";

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (process.env.NODE_ENV === "development") return true;
  return true;
}

// POST - Regenerate thumbnails for contents with OG images
export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      contentIds,
      thumbnailModel = "gemini_flash",
      onlyOgImages = true, // Only regenerate contents with OG images
    } = body as {
      contentIds?: string[];
      thumbnailModel?: "imagen" | "gemini_flash";
      onlyOgImages?: boolean;
    };

    const supabase = createServiceClient();

    // Get contents to regenerate
    let query = supabase
      .from("contents")
      .select("id, source_url, title, summary_md, ai_article_type, thumbnail_source")
      .eq("type", "news");

    if (contentIds && contentIds.length > 0) {
      query = query.in("id", contentIds);
    }

    if (onlyOgImages) {
      // Only get contents where thumbnail_source is 'og_image' or null
      query = query.or("thumbnail_source.eq.og_image,thumbnail_source.is.null");
    }

    const { data: contents, error } = await query;

    if (error) {
      console.error("[Bulk Thumbnail] Query error:", error);
      return NextResponse.json({ error: "Failed to fetch contents" }, { status: 500 });
    }

    if (!contents || contents.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No contents to regenerate",
        processed: 0,
        results: [],
      });
    }

    console.log(
      `[Bulk Thumbnail] Starting regeneration for ${contents.length} contents (model: ${thumbnailModel})`
    );

    const results: Array<{
      id: string;
      title: string;
      success: boolean;
      source?: string;
      error?: string;
    }> = [];

    let successCount = 0;
    let failedCount = 0;

    // Process contents one by one to avoid rate limits
    for (const content of contents) {
      try {
        console.log(
          `[Bulk Thumbnail] Processing: ${content.id} - ${content.title?.substring(0, 50)}`
        );

        const thumbnailResult = await getThumbnailWithFallback(
          content.id,
          content.source_url,
          content.title,
          content.summary_md,
          false, // skipAiGeneration
          content.ai_article_type,
          thumbnailModel
        );

        if (thumbnailResult.success) {
          successCount++;
          results.push({
            id: content.id,
            title: content.title,
            success: true,
            source: thumbnailResult.source,
          });

          // Log AI usage if cost > 0
          if (thumbnailResult.cost_usd && thumbnailResult.cost_usd > 0) {
            const modelName =
              thumbnailResult.source === "imagen"
                ? "imagen-4.0-generate-001"
                : "gemini-2.5-flash-image";
            await supabase.from("ai_usage_log").insert({
              request_type: "thumbnail_bulk_regenerate",
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
        } else {
          failedCount++;
          results.push({
            id: content.id,
            title: content.title,
            success: false,
            error: thumbnailResult.error || "Generation failed",
          });
        }

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        failedCount++;
        results.push({
          id: content.id,
          title: content.title,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    console.log(`[Bulk Thumbnail] Completed. Success: ${successCount}, Failed: ${failedCount}`);

    return NextResponse.json({
      success: true,
      message: `Regenerated ${successCount} thumbnails, ${failedCount} failed`,
      processed: contents.length,
      successCount,
      failedCount,
      results,
    });
  } catch (error) {
    console.error("[Bulk Thumbnail] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Get count of contents that need thumbnail regeneration
export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Count contents with OG images
    const { count: ogCount } = await supabase
      .from("contents")
      .select("*", { count: "exact", head: true })
      .eq("type", "news")
      .or("thumbnail_source.eq.og_image,thumbnail_source.is.null");

    // Count contents with AI generated images
    const { count: aiCount } = await supabase
      .from("contents")
      .select("*", { count: "exact", head: true })
      .eq("type", "news")
      .or("thumbnail_source.eq.imagen,thumbnail_source.eq.gemini_flash");

    // Total news contents
    const { count: totalCount } = await supabase
      .from("contents")
      .select("*", { count: "exact", head: true })
      .eq("type", "news");

    return NextResponse.json({
      total: totalCount || 0,
      ogImages: ogCount || 0,
      aiGenerated: aiCount || 0,
      needsRegeneration: ogCount || 0,
    });
  } catch (error) {
    console.error("[Bulk Thumbnail] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
