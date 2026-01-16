import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getThumbnailWithFallback } from "@/lib/gemini/thumbnail-generator";

// 배치 크기 제한 - Vercel 타임아웃 방지 (10개 × 4초 = 40초)
const BATCH_SIZE = 10;

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (process.env.NODE_ENV === "development") return true;
  return true;
}

// POST - Regenerate thumbnails for contents with OG images (배치 처리)
export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      contentIds,
      thumbnailModel = "gemini_flash",
      onlyOgImages = true,
      useStyleTransfer = true,
      batchIndex = 0, // 배치 인덱스 (0부터 시작)
    } = body as {
      contentIds?: string[];
      thumbnailModel?: "imagen" | "gemini_flash";
      onlyOgImages?: boolean;
      useStyleTransfer?: boolean;
      batchIndex?: number;
    };

    const supabase = createServiceClient();

    // Get contents to regenerate with rich data for better thumbnail generation
    let query = supabase
      .from("contents")
      .select(
        "id, source_url, title, summary_md, ai_article_type, thumbnail_source, key_takeaways, one_liner"
      )
      .eq("type", "news")
      .order("created_at", { ascending: false }); // 일관된 순서 보장

    if (contentIds && contentIds.length > 0) {
      query = query.in("id", contentIds);
    }

    if (onlyOgImages) {
      query = query.or("thumbnail_source.eq.og_image,thumbnail_source.is.null");
    }

    const { data: allContents, error } = await query;

    if (error) {
      console.error("[Bulk Thumbnail] Query error:", error);
      return NextResponse.json({ error: "Failed to fetch contents" }, { status: 500 });
    }

    if (!allContents || allContents.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No contents to regenerate",
        processed: 0,
        totalRemaining: 0,
        batchIndex: 0,
        hasMore: false,
        results: [],
      });
    }

    // 배치 슬라이싱
    const totalCount = allContents.length;
    const startIndex = batchIndex * BATCH_SIZE;
    const contents = allContents.slice(startIndex, startIndex + BATCH_SIZE);
    const hasMore = startIndex + BATCH_SIZE < totalCount;

    if (contents.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All batches completed",
        processed: 0,
        totalRemaining: 0,
        batchIndex,
        hasMore: false,
        results: [],
      });
    }

    console.log(
      `[Bulk Thumbnail] Batch ${batchIndex + 1}: Processing ${contents.length}/${totalCount} (model: ${thumbnailModel})`
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

    // Process batch contents
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
          false,
          content.ai_article_type,
          thumbnailModel,
          useStyleTransfer,
          {
            key_takeaways: content.key_takeaways,
            one_liner: content.one_liner,
          }
        );

        if (thumbnailResult.success) {
          successCount++;
          results.push({
            id: content.id,
            title: content.title,
            success: true,
            source: thumbnailResult.source,
          });

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
                batch_index: batchIndex,
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
        await new Promise((resolve) => setTimeout(resolve, 300));
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

    const totalRemaining = totalCount - (startIndex + contents.length);

    console.log(
      `[Bulk Thumbnail] Batch ${batchIndex + 1} completed. Success: ${successCount}, Failed: ${failedCount}, Remaining: ${totalRemaining}`
    );

    return NextResponse.json({
      success: true,
      message: `Batch ${batchIndex + 1}: ${successCount} success, ${failedCount} failed`,
      processed: contents.length,
      totalCount,
      totalRemaining,
      batchIndex,
      nextBatchIndex: hasMore ? batchIndex + 1 : null,
      hasMore,
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
