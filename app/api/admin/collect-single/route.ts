import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAdminAccess } from "@/lib/admin";
import { GeminiPipeline } from "@/lib/ai";
import { getThumbnailWithFallback } from "@/lib/gemini/thumbnail-generator";
import type { TargetCategory } from "@/types/automation";

// POST - Collect single URL through AI pipeline
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    if (!(await checkAdminAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      url,
      category = "press",
      force = false,
      autoPublish = false,
      thumbnailModel = "gemini_flash",
      useStyleTransfer = true, // Use OG image style for AI generation
    } = body as {
      url: string;
      category?: TargetCategory;
      force?: boolean; // Force re-collection even if URL exists
      autoPublish?: boolean; // Auto-publish if fact check passes
      thumbnailModel?: "imagen" | "gemini_flash"; // Thumbnail generation model
      useStyleTransfer?: boolean; // Use OG image colors/mood for generation
    };

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Status labels for user display
    const statusLabels: Record<string, string> = {
      published: "게시중",
      pending: "검토 대기",
      needs_review: "재검토 필요",
      rejected: "거부됨",
      draft: "임시저장",
    };

    // Check if URL already exists
    const { data: existing } = await supabase
      .from("contents")
      .select("id, status, title")
      .eq("source_url", url)
      .single();

    if (existing) {
      const statusLabel = statusLabels[existing.status] || existing.status;

      // If rejected, allow re-collection without force
      if (existing.status === "rejected") {
        console.log(
          `[Collect Single] Deleting rejected content before re-collection: ${existing.id}`
        );
        await supabase.from("contents").delete().eq("id", existing.id);
      }
      // If force=true, delete existing and re-collect
      else if (force) {
        console.log(
          `[Collect Single] Force re-collection: deleting existing content ${existing.id} (${existing.status})`
        );
        await supabase.from("contents").delete().eq("id", existing.id);
      }
      // Otherwise, return conflict with detailed info for user confirmation
      else {
        return NextResponse.json(
          {
            error: "이미 수집된 URL입니다.",
            message: `이 URL은 이미 수집되어 있습니다. (상태: ${statusLabel})`,
            existing_id: existing.id,
            existing_status: existing.status,
            existing_status_label: statusLabel,
            existing_title: existing.title,
            can_force: true, // Frontend can show "재수집하시겠습니까?" confirmation
          },
          { status: 409 }
        );
      }
    }

    // Initialize Gemini AI pipeline
    const hasApiKey = !!process.env.GOOGLE_GEMINI_API_KEY;

    if (!hasApiKey) {
      return NextResponse.json({ error: "AI API key not configured" }, { status: 500 });
    }

    const pipeline = new GeminiPipeline({
      minFactCheckScore: 80, // Increased for higher quality
      maxRetries: 1, // Retry once if score is below threshold
      skipFactCheck: false,
    });

    console.log(`[Collect Single] Processing URL: ${url}`);

    // Process URL through AI pipeline
    const result = await pipeline.process(url, category);

    if (!result.success || !result.article) {
      console.error(`[Collect Single] Pipeline failed:`, result.error);
      return NextResponse.json(
        { error: result.error || "Failed to process article" },
        { status: 400 }
      );
    }

    const pipelineResult = result;
    const hasRichContent = pipelineResult.success && pipelineResult.summary;

    // Map category to valid content_type
    const contentTypeMap: Record<string, string> = {
      official: "official",
      claude_code: "community", // claude_code maps to community
      press: "press",
      youtube: "youtube",
      version_update: "version_update",
      community: "community",
    };
    const validContentType = contentTypeMap[category] || "press";

    // Determine status based on autoPublish and fact-check result
    // - published: Auto-publish enabled and fact check passed
    // - needs_review: Fact-check score below threshold after retries (requires manual review)
    // - pending: Normal review queue (when autoPublish is false)
    const needsReview = pipelineResult.needsReview || false;
    const status = autoPublish
      ? needsReview
        ? "needs_review"
        : "published"
      : needsReview
        ? "needs_review"
        : "pending";

    // Determine published_at: HTML extracted > AI extracted > current time
    let publishedAt = result.article.publishedAt;

    // Check if HTML extraction failed (returned current time)
    const now = new Date();
    const extractedDate = new Date(publishedAt);
    const isRecentDate = Math.abs(now.getTime() - extractedDate.getTime()) < 60 * 60 * 1000; // Within 1 hour

    // If HTML extraction likely failed, try AI-extracted date
    if (isRecentDate && pipelineResult.extractedFacts?.publishedAt) {
      const aiPublishedAt = pipelineResult.extractedFacts.publishedAt;
      const aiDate = new Date(aiPublishedAt);
      if (!isNaN(aiDate.getTime())) {
        publishedAt = aiDate.toISOString();
        console.log(`[Collect Single] Using AI-extracted date: ${publishedAt}`);
      }
    }

    // Build insert data
    const insertData: Record<string, unknown> = {
      type: "news",
      content_type: validContentType,
      source_url: result.article.url,
      source_name: result.article.sourceName,
      title: hasRichContent ? pipelineResult.summary!.richContent.title.text : result.article.title,
      thumbnail_url: result.article.thumbnail,
      published_at: publishedAt,
      status, // 'needs_review' if low score, 'pending' otherwise
      category: category,
    };

    // Add news_tags for filtering
    if (pipelineResult.newsTags && pipelineResult.newsTags.length > 0) {
      insertData.news_tags = pipelineResult.newsTags;
    }

    // Add rich content fields if AI processing succeeded
    if (hasRichContent) {
      const rewritten = pipelineResult.rewrittenArticle;

      // Note: 'summary' column doesn't exist, use summary_md instead
      insertData.summary_md = rewritten?.summary || pipelineResult.summary!.summaryPlain;
      insertData.rich_content = pipelineResult.summary!.richContent;
      insertData.favicon_url = pipelineResult.article?.favicon;
      insertData.difficulty = pipelineResult.summary!.difficulty;
      insertData.original_content = pipelineResult.article?.content;

      // Gemini-specific fields
      if (rewritten) {
        insertData.one_liner = rewritten.oneLiner;
        insertData.body_html = rewritten.bodyHtml;
        insertData.insight_html = rewritten.insightHtml;
        insertData.key_takeaways = rewritten.keyTakeaways;
        // Don't override category with AI-generated one as it may not match valid content_type
      }

      // Fact check results
      if (pipelineResult.factVerification) {
        insertData.fact_check_score = pipelineResult.factVerification.score / 100;
        insertData.fact_check_reason =
          pipelineResult.factVerification.issues.join("; ") || "Passed";
      }

      // AI usage metadata
      insertData.ai_model_used = pipelineResult.aiUsage.model;
      insertData.ai_tokens_used =
        pipelineResult.aiUsage.inputTokens + pipelineResult.aiUsage.outputTokens;
      insertData.ai_cost_usd = pipelineResult.aiUsage.costUsd;
      insertData.ai_processed_at = new Date().toISOString();

      // AI classification (for thumbnail generation)
      if (pipelineResult.extractedFacts?.classification) {
        insertData.ai_article_type = pipelineResult.extractedFacts.classification.primary;
        insertData.ai_article_type_secondary =
          pipelineResult.extractedFacts.classification.secondary || null;
        insertData.ai_classification_confidence =
          pipelineResult.extractedFacts.classification.confidence;
        insertData.ai_classification_signals =
          pipelineResult.extractedFacts.classification.signals || [];
      }
    }

    // Save to database
    const { data: savedContent, error: insertError } = await supabase
      .from("contents")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("[Collect Single] Insert error:", insertError);
      return NextResponse.json({ error: "Failed to save article" }, { status: 500 });
    }

    // Log AI usage
    if (hasRichContent && pipelineResult.aiUsage.costUsd > 0) {
      await supabase.from("ai_usage_log").insert({
        request_type: "single_collect",
        operation: "gemini_pipeline",
        model: pipelineResult.aiUsage.model,
        input_tokens: pipelineResult.aiUsage.inputTokens,
        output_tokens: pipelineResult.aiUsage.outputTokens,
        total_tokens: pipelineResult.aiUsage.inputTokens + pipelineResult.aiUsage.outputTokens,
        cost_usd: pipelineResult.aiUsage.costUsd,
        metadata: {
          source_url: url,
          content_id: savedContent.id,
          manual: true,
        },
      });
    }

    // Always generate AI thumbnail (regardless of OG image existence)
    let thumbnailResult = null;
    console.log(
      `[Collect Single] Generating AI thumbnail for: ${savedContent.id} (model: ${thumbnailModel}, styleTransfer: ${useStyleTransfer})`
    );
    thumbnailResult = await getThumbnailWithFallback(
      savedContent.id,
      url,
      savedContent.title,
      savedContent.summary_md,
      false, // skipAiGeneration
      savedContent.ai_article_type, // AI-classified article type for accurate theme selection
      thumbnailModel, // User-selected model (imagen or gemini_flash)
      useStyleTransfer, // Use OG image colors/mood for generation
      {
        // Rich content for better image planning (extract text from keyTakeaways objects)
        key_takeaways: pipelineResult.rewrittenArticle?.keyTakeaways?.map((k) =>
          typeof k === "string" ? k : k.text
        ),
        one_liner: pipelineResult.rewrittenArticle?.oneLiner,
      }
    );

    if (thumbnailResult.success) {
      // Log thumbnail generation cost
      if (thumbnailResult.cost_usd && thumbnailResult.cost_usd > 0) {
        const thumbnailModelName =
          thumbnailResult.source === "imagen"
            ? "imagen-4.0-generate-001"
            : "gemini-2.5-flash-image";
        await supabase.from("ai_usage_log").insert({
          request_type: "thumbnail_generate",
          operation: thumbnailResult.source === "imagen" ? "thumbnail_imagen" : "thumbnail_gemini",
          model: thumbnailModelName,
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          cost_usd: thumbnailResult.cost_usd,
          metadata: {
            content_id: savedContent.id,
            source: thumbnailResult.source,
          },
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Collect Single] Success in ${duration}ms. Content ID: ${savedContent.id}`);

    return NextResponse.json({
      success: true,
      content_id: savedContent.id,
      title: insertData.title,
      status, // 'needs_review' or 'pending'
      needs_review: pipelineResult.needsReview || false,
      retry_count: pipelineResult.retryCount || 0,
      fact_check_score: pipelineResult.factVerification?.score || null,
      thumbnail: thumbnailResult
        ? {
            url: thumbnailResult.thumbnail_url,
            source: thumbnailResult.source,
            cost_usd: thumbnailResult.cost_usd || 0,
          }
        : { url: savedContent.thumbnail_url, source: "og_image" },
      duration_ms: duration,
      ai_usage: {
        model: pipelineResult.aiUsage.model,
        tokens: pipelineResult.aiUsage.inputTokens + pipelineResult.aiUsage.outputTokens,
        cost_usd: pipelineResult.aiUsage.costUsd + (thumbnailResult?.cost_usd || 0),
      },
    });
  } catch (error) {
    console.error("[Collect Single] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
