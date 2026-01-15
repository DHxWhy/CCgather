import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { GeminiPipeline } from "@/lib/ai";
import { getThumbnailWithFallback } from "@/lib/gemini/thumbnail-generator";
import type { TargetCategory } from "@/types/automation";

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (process.env.NODE_ENV === "development") return true;
  return true;
}

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
  if (!(await isAdmin())) {
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
  } = body as {
    urls: Array<{ url: string; category: TargetCategory }>;
    delayMs?: number;
    autoPublish?: boolean;
  };
  // Capture in local const for closure
  const autoPublish = shouldAutoPublish;

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
          const result = await pipeline.processUrl(url, category);

          if (!result.success || !result.content) {
            throw new Error(result.error || "Failed to process URL");
          }

          // Insert into database
          const status = autoPublish ? "published" : "pending";
          const { data: content, error: insertError } = await supabase
            .from("contents")
            .insert({
              type: "news",
              content_type: category,
              source_url: url,
              source_name: result.content.sourceName || "Unknown",
              title: result.content.title,
              summary_md: result.content.summaryMd,
              key_points: result.content.keyPoints,
              category: result.content.category,
              tags: result.content.tags,
              news_tags: result.content.newsTags,
              status,
              published_at: autoPublish ? new Date().toISOString() : null,
              rich_content: result.content.richContent,
              // AI classification fields
              ai_article_type: result.content.articleType,
              ai_article_type_secondary: result.content.articleTypeSecondary,
              ai_classification_confidence: result.content.classificationConfidence,
              ai_classification_signals: result.content.classificationSignals,
              ai_processed_at: new Date().toISOString(),
            })
            .select("id, title")
            .single();

          if (insertError || !content) {
            throw new Error(insertError?.message || "Failed to insert content");
          }

          // Generate thumbnail
          await getThumbnailWithFallback({
            contentId: content.id,
            title: result.content.title,
            summary: result.content.summaryMd || "",
            sourceUrl: url,
          });

          stats.success++;
          sendEvent(controller, encoder, {
            type: "success",
            index: i,
            total: urls.length,
            url,
            title: content.title,
            message: `성공: ${content.title}`,
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
