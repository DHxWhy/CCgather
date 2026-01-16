import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAdminAccess } from "@/lib/admin";
import { GeminiPipeline } from "@/lib/ai";
import { getThumbnailWithFallback } from "@/lib/gemini/thumbnail-generator";
import type { TargetCategory } from "@/types/automation";

// Helper to send SSE event
function sendEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: {
    type: "progress" | "success" | "error" | "skip" | "complete";
    index: number;
    total: number;
    url?: string;
    title?: string;
    message?: string;
    stats?: { success: number; failed: number; skipped: number };
  }
) {
  const data = JSON.stringify(event);
  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
}

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST - Batch collect multiple URLs with streaming progress
export async function POST(request: NextRequest) {
  // Auth check first
  if (!(await checkAdminAccess())) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const {
    urls,
    delayMs = 30000,
    autoPublish: shouldAutoPublish = true,
    thumbnailModel: requestedModel = "gemini_flash",
    useStyleTransfer: shouldUseStyleTransfer = true,
  } = body as {
    urls: Array<{ url: string; category: TargetCategory }>;
    delayMs?: number;
    autoPublish?: boolean;
    thumbnailModel?: "imagen" | "gemini_flash";
    useStyleTransfer?: boolean; // Use OG image colors/mood for generation
  };
  // Capture in local const for closure
  const autoPublish = shouldAutoPublish;
  const thumbnailModel = requestedModel;
  const useStyleTransfer = shouldUseStyleTransfer;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return new Response(JSON.stringify({ error: "URLs array is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const supabase = createServiceClient();
      const stats = { success: 0, failed: 0, skipped: 0 };

      for (let i = 0; i < urls.length; i++) {
        const item = urls[i];
        if (!item) continue;
        const { url, category } = item;

        try {
          // Send progress event
          sendEvent(controller, encoder, {
            type: "progress",
            index: i,
            total: urls.length,
            url,
            message: `처리 중... (${i + 1}/${urls.length})`,
          });

          // Check if URL already exists
          const { data: existing } = await supabase
            .from("contents")
            .select("id, title, status")
            .eq("source_url", url)
            .maybeSingle();

          if (existing) {
            stats.skipped++;
            sendEvent(controller, encoder, {
              type: "skip",
              index: i,
              total: urls.length,
              url,
              title: existing.title,
              message: `이미 존재: ${existing.title}`,
            });

            // Add delay before next request
            if (i < urls.length - 1) {
              await delay(delayMs);
            }
            continue;
          }

          // Initialize pipeline and process
          const pipeline = new GeminiPipeline();
          const result = await pipeline.process(url, category);

          if (!result.success || !result.article || !result.summary) {
            throw new Error(result.error || "Failed to process URL");
          }

          // Extract data from pipeline result
          const {
            article,
            summary,
            newsTags,
            extractedFacts,
            rewrittenArticle,
            factVerification,
            aiUsage,
          } = result;
          const richContent = summary.richContent;

          // Determine published_at (use extracted date if available, otherwise article date)
          let publishedAt = article.publishedAt;
          if (extractedFacts?.publishedAt) {
            const aiDate = new Date(extractedFacts.publishedAt);
            if (!isNaN(aiDate.getTime())) {
              publishedAt = aiDate.toISOString();
            }
          }

          // Determine status
          const needsReview = result.needsReview || false;
          const contentStatus = autoPublish
            ? needsReview
              ? "needs_review"
              : "published"
            : "pending";

          // Build insert data (matching single collect)
          const insertData: Record<string, unknown> = {
            type: "news",
            content_type: category,
            source_url: url,
            source_name: article.sourceName || "Unknown",
            title: richContent.title.text,
            thumbnail_url: article.thumbnail,
            published_at: publishedAt,
            status: contentStatus,
            category: richContent.meta.category,
            tags: [],
            news_tags: newsTags || [],
            rich_content: richContent,
            // Summary fields
            summary_md: rewrittenArticle?.summary || summary.summaryPlain,
            difficulty: summary.difficulty,
            original_content: article.content,
            favicon_url: article.favicon,
            // Rewritten article fields
            one_liner: rewrittenArticle?.oneLiner,
            body_html: rewrittenArticle?.bodyHtml,
            insight_html: rewrittenArticle?.insightHtml,
            key_takeaways: rewrittenArticle?.keyTakeaways,
            // Fact check fields
            fact_check_score: factVerification ? factVerification.score / 100 : null,
            fact_check_reason: factVerification?.issues?.join("; ") || null,
            // AI usage fields
            ai_model_used: aiUsage.model,
            ai_tokens_used: aiUsage.inputTokens + aiUsage.outputTokens,
            ai_cost_usd: aiUsage.costUsd,
            ai_processed_at: new Date().toISOString(),
            // AI classification fields
            ai_article_type: extractedFacts?.classification?.primary,
            ai_article_type_secondary: extractedFacts?.classification?.secondary,
            ai_classification_confidence: extractedFacts?.classification?.confidence,
            ai_classification_signals: extractedFacts?.classification?.signals,
          };

          // Insert into database
          const { data: insertedContent, error: insertError } = await supabase
            .from("contents")
            .insert(insertData)
            .select("id, title, summary_md")
            .single();

          if (insertError || !insertedContent) {
            throw new Error(insertError?.message || "Failed to insert content");
          }

          // Generate thumbnail (with articleType and model selection)
          const thumbnailResult = await getThumbnailWithFallback(
            insertedContent.id,
            url,
            insertedContent.title,
            insertedContent.summary_md,
            false, // Don't skip AI generation
            extractedFacts?.classification?.primary, // articleType for theme selection
            thumbnailModel, // User-selected model (imagen or gemini_flash)
            useStyleTransfer, // Use OG image colors/mood for generation
            {
              // Rich content for better image planning (extract text from keyTakeaways objects)
              key_takeaways: rewrittenArticle?.keyTakeaways?.map((k) =>
                typeof k === "string" ? k : k.text
              ),
              one_liner: rewrittenArticle?.oneLiner,
            }
          );

          // Log AI usage for thumbnail if generated
          if (thumbnailResult?.cost_usd && thumbnailResult.cost_usd > 0) {
            const thumbnailModelName =
              thumbnailResult.source === "imagen"
                ? "imagen-4.0-generate-001"
                : "gemini-2.5-flash-image";
            await supabase.from("ai_usage_log").insert({
              request_type: "thumbnail_generate",
              operation:
                thumbnailResult.source === "imagen" ? "thumbnail_imagen" : "thumbnail_gemini",
              model: thumbnailModelName,
              input_tokens: 0,
              output_tokens: 0,
              total_tokens: 0,
              cost_usd: thumbnailResult.cost_usd,
              metadata: {
                content_id: insertedContent.id,
                source: thumbnailResult.source,
                batch: true,
              },
            });
          }

          // Log AI usage for content processing
          if (aiUsage.costUsd > 0) {
            await supabase.from("ai_usage_log").insert({
              request_type: "batch_collect",
              operation: "gemini_pipeline",
              model: aiUsage.model,
              input_tokens: aiUsage.inputTokens,
              output_tokens: aiUsage.outputTokens,
              total_tokens: aiUsage.inputTokens + aiUsage.outputTokens,
              cost_usd: aiUsage.costUsd,
              metadata: {
                source_url: url,
                content_id: insertedContent.id,
                batch: true,
              },
            });
          }

          stats.success++;
          sendEvent(controller, encoder, {
            type: "success",
            index: i,
            total: urls.length,
            url,
            title: insertedContent.title,
            message: `성공: ${insertedContent.title}`,
          });
        } catch (error) {
          stats.failed++;
          sendEvent(controller, encoder, {
            type: "error",
            index: i,
            total: urls.length,
            url,
            message: `실패: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }

        // Add delay before next request (except for the last one)
        if (i < urls.length - 1) {
          await delay(delayMs);
        }
      }

      // Send completion event
      sendEvent(controller, encoder, {
        type: "complete",
        index: urls.length,
        total: urls.length,
        message: "배치 수집 완료",
        stats,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
