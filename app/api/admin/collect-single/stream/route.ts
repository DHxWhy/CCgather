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
  event: { stage: string; message: string; progress?: number; data?: Record<string, unknown> }
) {
  const data = JSON.stringify(event);
  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
}

// POST - Collect single URL through AI pipeline with streaming progress
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Auth check first
  if (!(await checkAdminAccess())) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const {
    url,
    category = "press",
    force = false,
  } = body as {
    url: string;
    category?: TargetCategory;
    force?: boolean;
  };

  if (!url) {
    return new Response(JSON.stringify({ error: "URL is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid URL format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const supabase = createServiceClient();

        // Stage 0: Check existing
        sendEvent(controller, encoder, {
          stage: "checking",
          message: "기존 콘텐츠 확인 중...",
          progress: 5,
        });

        const statusLabels: Record<string, string> = {
          published: "게시중",
          pending: "검토 대기",
          needs_review: "재검토 필요",
          rejected: "거부됨",
          draft: "임시저장",
        };

        const { data: existing } = await supabase
          .from("contents")
          .select("id, status, title")
          .eq("source_url", url)
          .single();

        if (existing) {
          const statusLabel = statusLabels[existing.status] || existing.status;

          if (existing.status === "rejected") {
            await supabase.from("contents").delete().eq("id", existing.id);
          } else if (force) {
            await supabase.from("contents").delete().eq("id", existing.id);
          } else {
            sendEvent(controller, encoder, {
              stage: "conflict",
              message: `이미 수집된 URL입니다. (상태: ${statusLabel})`,
              data: {
                existing_id: existing.id,
                existing_status: existing.status,
                existing_status_label: statusLabel,
                existing_title: existing.title,
                can_force: true,
              },
            });
            controller.close();
            return;
          }
        }

        // Stage 1: Fetch article
        sendEvent(controller, encoder, {
          stage: "fetching",
          message: "웹 페이지 분석 중...",
          progress: 10,
        });

        const hasApiKey = !!process.env.GOOGLE_GEMINI_API_KEY;
        if (!hasApiKey) {
          sendEvent(controller, encoder, {
            stage: "error",
            message: "AI API key not configured",
          });
          controller.close();
          return;
        }

        const pipeline = new GeminiPipeline({
          minFactCheckScore: 80,
          maxRetries: 1,
          skipFactCheck: false,
        });

        // Stage 2: AI Processing
        sendEvent(controller, encoder, {
          stage: "ai_stage1",
          message: "AI Stage 1: 팩트 추출 중...",
          progress: 25,
        });

        // Small delay to show the message
        await new Promise((resolve) => setTimeout(resolve, 100));

        sendEvent(controller, encoder, {
          stage: "ai_stage2",
          message: "AI Stage 2: 기사 리라이팅 중...",
          progress: 45,
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        sendEvent(controller, encoder, {
          stage: "ai_stage3",
          message: "AI Stage 3: 팩트 검증 중...",
          progress: 65,
        });

        // Actually process (this takes time)
        const result = await pipeline.process(url, category);

        if (!result.success || !result.article) {
          sendEvent(controller, encoder, {
            stage: "error",
            message: result.error || "Failed to process article",
          });
          controller.close();
          return;
        }

        sendEvent(controller, encoder, {
          stage: "saving",
          message: "데이터베이스 저장 중...",
          progress: 75,
        });

        const pipelineResult = result;
        const hasRichContent = pipelineResult.success && pipelineResult.summary;

        // Map category to valid content_type
        const contentTypeMap: Record<string, string> = {
          official: "official",
          claude_code: "community",
          press: "press",
          youtube: "youtube",
          version_update: "version_update",
          community: "community",
        };
        const validContentType = contentTypeMap[category] || "press";

        const status = pipelineResult.needsReview ? "needs_review" : "pending";

        // Determine published_at
        let publishedAt = result.article.publishedAt;
        const now = new Date();
        const extractedDate = new Date(publishedAt);
        const isRecentDate = Math.abs(now.getTime() - extractedDate.getTime()) < 60 * 60 * 1000;

        if (isRecentDate && pipelineResult.extractedFacts?.publishedAt) {
          const aiPublishedAt = pipelineResult.extractedFacts.publishedAt;
          const aiDate = new Date(aiPublishedAt);
          if (!isNaN(aiDate.getTime())) {
            publishedAt = aiDate.toISOString();
          }
        }

        // Build insert data
        const insertData: Record<string, unknown> = {
          type: "news",
          content_type: validContentType,
          source_url: result.article.url,
          source_name: result.article.sourceName,
          title: hasRichContent
            ? pipelineResult.summary!.richContent.title.text
            : result.article.title,
          thumbnail_url: result.article.thumbnail,
          published_at: publishedAt,
          status,
          category: category,
        };

        if (pipelineResult.newsTags && pipelineResult.newsTags.length > 0) {
          insertData.news_tags = pipelineResult.newsTags;
        }

        if (hasRichContent) {
          const rewritten = pipelineResult.rewrittenArticle;
          insertData.summary_md = rewritten?.summary || pipelineResult.summary!.summaryPlain;
          insertData.rich_content = pipelineResult.summary!.richContent;
          insertData.favicon_url = pipelineResult.article?.favicon;
          insertData.difficulty = pipelineResult.summary!.difficulty;
          insertData.original_content = pipelineResult.article?.content;

          if (rewritten) {
            insertData.one_liner = rewritten.oneLiner;
            insertData.body_html = rewritten.bodyHtml;
            insertData.insight_html = rewritten.insightHtml;
            insertData.key_takeaways = rewritten.keyTakeaways;
          }

          if (pipelineResult.factVerification) {
            insertData.fact_check_score = pipelineResult.factVerification.score / 100;
            insertData.fact_check_reason =
              pipelineResult.factVerification.issues.join("; ") || "Passed";
          }

          insertData.ai_model_used = pipelineResult.aiUsage.model;
          insertData.ai_tokens_used =
            pipelineResult.aiUsage.inputTokens + pipelineResult.aiUsage.outputTokens;
          insertData.ai_cost_usd = pipelineResult.aiUsage.costUsd;
          insertData.ai_processed_at = new Date().toISOString();

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

        const { data: savedContent, error: insertError } = await supabase
          .from("contents")
          .insert(insertData)
          .select()
          .single();

        if (insertError) {
          sendEvent(controller, encoder, {
            stage: "error",
            message: "Failed to save article",
          });
          controller.close();
          return;
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

        // Stage 4: Thumbnail generation
        let thumbnailResult = null;
        if (
          !savedContent.thumbnail_url ||
          savedContent.thumbnail_url === "/images/news-placeholder.svg"
        ) {
          sendEvent(controller, encoder, {
            stage: "thumbnail",
            message: "썸네일 생성 중...",
            progress: 85,
          });

          thumbnailResult = await getThumbnailWithFallback(
            savedContent.id,
            url,
            savedContent.title,
            savedContent.summary_md,
            false,
            savedContent.ai_article_type
          );

          if (thumbnailResult.cost_usd && thumbnailResult.cost_usd > 0) {
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
                content_id: savedContent.id,
                source: thumbnailResult.source,
              },
            });
          }
        }

        const duration = Date.now() - startTime;

        // Final success event
        sendEvent(controller, encoder, {
          stage: "complete",
          message: `수집 완료! (${(duration / 1000).toFixed(1)}초)`,
          progress: 100,
          data: {
            success: true,
            content_id: savedContent.id,
            title: insertData.title,
            status,
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
          },
        });

        controller.close();
      } catch (error) {
        sendEvent(controller, encoder, {
          stage: "error",
          message: error instanceof Error ? error.message : "Internal server error",
        });
        controller.close();
      }
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
