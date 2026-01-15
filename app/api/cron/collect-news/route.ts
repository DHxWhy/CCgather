import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CronConfig, CronLogEntry, RawArticle } from "@/types/automation";
import { GeminiPipeline, type GeminiPipelineResult } from "@/lib/ai";
import { getThumbnailWithFallback } from "@/lib/gemini/thumbnail-generator";

// Extended article type with AI processing results
interface ProcessedArticle extends RawArticle {
  pipelineResult?: GeminiPipelineResult;
  contentType?: string; // Maps to content_type in database (official, claude_code, press, etc.)
}

// Vercel Cron requires GET method
export async function GET(request: NextRequest) {
  return handleCronRequest(request, false);
}

// POST for manual triggers
export async function POST(request: NextRequest) {
  return handleCronRequest(request, true);
}

async function handleCronRequest(request: NextRequest, isManual: boolean) {
  const startTime = Date.now();
  const logs: CronLogEntry[] = [];
  let runId: string | undefined;
  let supabaseClient: Awaited<ReturnType<typeof createClient>> | null = null;

  // Helper to update logs in database (non-blocking)
  const updateLogsInDb = () => {
    if (runId && supabaseClient) {
      void supabaseClient.from("cron_run_history").update({ log: logs }).eq("id", runId);
    }
  };

  const log = (level: CronLogEntry["level"], message: string, data?: Record<string, unknown>) => {
    logs.push({ timestamp: new Date().toISOString(), level, message, data });
    console[level === "error" ? "error" : "log"](`[Cron] ${message}`, data || "");
    // Update logs in DB every time (non-blocking)
    updateLogsInDb();
  };

  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "dev-secret";

    if (authHeader !== `Bearer ${cronSecret}`) {
      // In Vercel, cron jobs don't send auth header but have vercel-cron header
      const vercelCron = request.headers.get("x-vercel-cron");
      if (!vercelCron && process.env.NODE_ENV !== "development") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = await createClient();
    supabaseClient = supabase;

    // Get run_id if manual
    if (isManual) {
      const body = await request.json().catch(() => ({}));
      runId = body.run_id;
    }

    log("info", "Starting news collection", { isManual });

    // Get cron job config
    const { data: cronJob } = await supabase
      .from("cron_jobs")
      .select("*")
      .eq("id", "news-collector")
      .single();

    const config: CronConfig = cronJob?.config || {
      max_articles: 10,
      delay_ms: 2000,
      parallel_workers: 2,
    };

    log("info", "Using config", config as unknown as Record<string, unknown>);

    // Get active targets
    const { data: targets } = await supabase
      .from("automation_targets")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (!targets || targets.length === 0) {
      log("warn", "No active targets found");
      await finishRun(supabase, runId, "success", 0, 0, 0, 0, startTime, logs);
      return NextResponse.json({ message: "No targets to process" });
    }

    log("info", `Found ${targets.length} active targets`);

    // Initialize Gemini AI pipeline (only if GOOGLE_GEMINI_API_KEY is set)
    let pipeline: GeminiPipeline | undefined;
    const hasApiKey = !!process.env.GOOGLE_GEMINI_API_KEY;

    if (hasApiKey) {
      pipeline = new GeminiPipeline({
        minFactCheckScore: 80, // Increased for higher quality
        maxRetries: 1, // Retry once if score is below threshold
        skipFactCheck: false,
      });
      log("info", "Gemini AI Pipeline initialized (gemini-3-flash-preview)");
    } else {
      log("warn", "GOOGLE_GEMINI_API_KEY not set - running in fallback mode");
    }

    // Track AI usage
    let totalAiCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Collect articles from each target
    const collectedArticles: ProcessedArticle[] = [];
    let itemsSkipped = 0;

    for (const target of targets) {
      try {
        log("info", `Processing target: ${target.type} - ${target.value}`);

        // Add random delay between requests (30-60 seconds for rate limiting safety)
        if (collectedArticles.length > 0) {
          const waitTime = await randomDelay(30, 60);
          log("info", `Waited ${(waitTime / 1000).toFixed(1)}s before next request`);
        }

        // Collect based on target type (pass category as content_type)
        if (target.type === "url") {
          const articles = await collectFromUrl(target.value, target.category as string, pipeline);
          collectedArticles.push(...articles);

          // Track AI usage from pipeline results
          for (const article of articles) {
            if (article.pipelineResult?.aiUsage) {
              totalAiCost += article.pipelineResult.aiUsage.costUsd;
              totalInputTokens += article.pipelineResult.aiUsage.inputTokens;
              totalOutputTokens += article.pipelineResult.aiUsage.outputTokens;
            }
          }

          log("info", `Collected ${articles.length} articles from URL`);
        } else if (target.type === "keyword") {
          const articles = await searchForKeyword(target.value);
          collectedArticles.push(...articles);
          log("info", `Found ${articles.length} articles for keyword`);
        }

        // Update target stats
        await supabase
          .from("automation_targets")
          .update({
            last_crawled_at: new Date().toISOString(),
            crawl_count: target.crawl_count + 1,
            success_count: target.success_count + 1,
          })
          .eq("id", target.id);

        // Check if we have enough articles
        if (collectedArticles.length >= config.max_articles) {
          log("info", `Reached max articles limit (${config.max_articles})`);
          break;
        }
      } catch (targetError) {
        log("error", `Failed to process target ${target.id}`, { error: String(targetError) });

        // Update fail count
        await supabase
          .from("automation_targets")
          .update({
            crawl_count: target.crawl_count + 1,
            fail_count: target.fail_count + 1,
          })
          .eq("id", target.id);
      }
    }

    log("info", `Total collected: ${collectedArticles.length} articles`);

    // Deduplicate by URL
    const uniqueArticles = deduplicateArticles(collectedArticles);
    itemsSkipped += collectedArticles.length - uniqueArticles.length;

    log("info", `After dedup: ${uniqueArticles.length} unique articles`);

    // Check for existing URLs in database
    const existingUrls = await getExistingUrls(
      supabase,
      uniqueArticles.map((a) => a.source_url)
    );
    const newArticles = uniqueArticles.filter((a) => !existingUrls.has(a.source_url));
    itemsSkipped += uniqueArticles.length - newArticles.length;

    log("info", `New articles to save: ${newArticles.length}`);

    // Save new articles with rich content
    let savedCount = 0;
    for (const article of newArticles.slice(0, config.max_articles)) {
      try {
        const pipelineResult = (article as ProcessedArticle).pipelineResult;
        const hasRichContent = pipelineResult?.success && pipelineResult?.summary;

        // Build insert data
        // content_type determines which section the article appears in on news page
        const articleContentType = (article as ProcessedArticle).contentType || "press";

        // Determine status based on pipeline result:
        // - needs_review: Fact-check score below threshold after retries
        // - published: AI processed successfully with good score
        // - pending: No AI processing (fallback mode)
        let articleStatus: string;
        if (hasRichContent) {
          articleStatus = pipelineResult!.needsReview ? "needs_review" : "published";
        } else {
          articleStatus = "pending";
        }

        const insertData: Record<string, unknown> = {
          type: "news",
          content_type: articleContentType, // official, claude_code, press, community, youtube
          source_url: article.source_url,
          source_name: article.source_name,
          title: hasRichContent
            ? pipelineResult!.summary!.richContent.title.text
            : article.original_title,
          thumbnail_url: article.thumbnail_url,
          published_at: article.published_at,
          status: articleStatus,
          category: articleContentType, // Keep for backwards compatibility
          news_tags: pipelineResult?.newsTags || [], // Tag-based filtering
        };

        // Add rich content fields if AI processing succeeded (Gemini pipeline)
        if (hasRichContent) {
          const rewritten = pipelineResult!.rewrittenArticle;

          // summary_md stores the AI-generated summary (no 'summary' column exists)
          insertData.summary_md = rewritten?.summary || pipelineResult!.summary!.summaryPlain;
          insertData.rich_content = pipelineResult!.summary!.richContent;
          insertData.favicon_url = pipelineResult!.article?.favicon;
          insertData.difficulty = pipelineResult!.summary!.difficulty;
          insertData.original_content = pipelineResult!.article?.content;

          // Gemini-specific fields
          if (rewritten) {
            insertData.one_liner = rewritten.oneLiner;
            insertData.body_html = rewritten.bodyHtml;
            insertData.insight_html = rewritten.insightHtml;
            insertData.key_takeaways = rewritten.keyTakeaways;
            insertData.category = rewritten.category;
          }

          // Fact check results (Gemini verification)
          if (pipelineResult!.factVerification) {
            insertData.fact_check_score = pipelineResult!.factVerification.score / 100;
            insertData.fact_check_reason =
              pipelineResult!.factVerification.issues.join("; ") || "Passed";
          } else if (pipelineResult!.factCheck) {
            insertData.fact_check_score = pipelineResult!.factCheck.score;
            insertData.fact_check_reason = pipelineResult!.factCheck.reason;
          }

          // AI usage metadata
          insertData.ai_model_used = pipelineResult!.aiUsage.model;
          insertData.ai_tokens_used =
            pipelineResult!.aiUsage.inputTokens + pipelineResult!.aiUsage.outputTokens;
          insertData.ai_cost_usd = pipelineResult!.aiUsage.costUsd;
          insertData.ai_processed_at = new Date().toISOString();
          insertData.ai_model_version = pipelineResult!.aiUsage.model;

          // AI Classification fields (from Stage 1 fact extraction)
          if (pipelineResult!.extractedFacts?.classification) {
            const classification = pipelineResult!.extractedFacts.classification;
            insertData.ai_article_type = classification.primary;
            insertData.ai_article_type_secondary = classification.secondary || null;
            insertData.ai_classification_confidence = classification.confidence;
            insertData.ai_classification_signals = classification.signals;
          }
        }

        const { data: insertedContent, error } = await supabase
          .from("contents")
          .insert(insertData)
          .select("id")
          .single();

        if (!error && insertedContent) {
          savedCount++;

          // Log AI usage if processed (Gemini 3-stage pipeline)
          if (hasRichContent && pipelineResult!.aiUsage.costUsd > 0) {
            await supabase.from("ai_usage_log").insert({
              model: pipelineResult!.aiUsage.model,
              operation: "gemini_pipeline",
              input_tokens: pipelineResult!.aiUsage.inputTokens,
              output_tokens: pipelineResult!.aiUsage.outputTokens,
              cost_usd: pipelineResult!.aiUsage.costUsd,
              metadata: {
                source_url: article.source_url,
                content_length: pipelineResult!.article?.content.length,
                stages: ["extract_facts", "rewrite_article", "verify_facts"],
              },
            });
          }

          // Step 4: Generate thumbnail image (after AI processing)
          try {
            const title = String(insertData.title || article.original_title);
            const summary = String(insertData.summary_md || "");
            const articleType = pipelineResult?.extractedFacts?.classification?.primary;

            await getThumbnailWithFallback(
              insertedContent.id,
              article.source_url,
              title,
              summary,
              false, // Don't skip AI generation
              articleType
            );
          } catch (thumbnailError) {
            log("warn", `Failed to generate thumbnail for ${article.source_url}`, {
              error: String(thumbnailError),
            });
          }
        } else {
          log("warn", `Failed to save article: ${article.source_url}`, { error: error.message });
        }
      } catch (saveError) {
        log("error", `Error saving article`, { error: String(saveError) });
      }
    }

    log("info", `Saved ${savedCount} new articles`);
    if (totalAiCost > 0) {
      log(
        "info",
        `AI Usage: ${totalInputTokens + totalOutputTokens} tokens, $${totalAiCost.toFixed(4)}`
      );
    }

    // Update job stats
    await supabase
      .from("cron_jobs")
      .update({
        is_running: false,
        last_run_at: new Date().toISOString(),
        last_run_status: "success",
        last_run_duration_ms: Date.now() - startTime,
        run_count: (cronJob?.run_count || 0) + 1,
        success_count: (cronJob?.success_count || 0) + 1,
        total_items_collected: (cronJob?.total_items_collected || 0) + savedCount,
        last_run_result: {
          items_found: collectedArticles.length,
          items_valid: newArticles.length,
          items_saved: savedCount,
          items_skipped: itemsSkipped,
          sources_crawled: targets.map((t) => t.value),
          ai_usage: hasApiKey
            ? {
                total_tokens: totalInputTokens + totalOutputTokens,
                input_tokens: totalInputTokens,
                output_tokens: totalOutputTokens,
                cost_usd: totalAiCost,
              }
            : null,
        },
      })
      .eq("id", "news-collector");

    // Update run history if manual
    await finishRun(
      supabase,
      runId,
      "success",
      collectedArticles.length,
      newArticles.length,
      savedCount,
      itemsSkipped,
      startTime,
      logs
    );

    return NextResponse.json({
      success: true,
      collected: savedCount,
      duration_ms: Date.now() - startTime,
      ai_usage: hasApiKey
        ? {
            total_tokens: totalInputTokens + totalOutputTokens,
            cost_usd: totalAiCost,
          }
        : null,
    });
  } catch (error) {
    log("error", "Cron job failed", { error: String(error) });

    const supabase = await createClient();

    // Update job status
    await supabase
      .from("cron_jobs")
      .update({
        is_running: false,
        last_run_status: "failed",
        last_error: String(error),
      })
      .eq("id", "news-collector");

    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}

// Helper functions

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Random delay between min and max seconds (for rate limiting safety)
async function randomDelay(minSec: number, maxSec: number): Promise<number> {
  const delayMs = Math.floor(Math.random() * (maxSec - minSec) * 1000) + minSec * 1000;
  await delay(delayMs);
  return delayMs;
}

async function collectFromUrl(
  url: string,
  contentType?: string,
  pipeline?: GeminiPipeline
): Promise<ProcessedArticle[]> {
  // Skip if no pipeline provided (fallback mode)
  if (!pipeline) {
    const hostname = new URL(url).hostname;
    return [
      {
        source_url: url,
        source_name: hostname,
        original_title: `Article from ${hostname}`,
        published_at: new Date().toISOString(),
        contentType: contentType || "press",
      },
    ];
  }

  try {
    // Process URL through AI pipeline
    const result = await pipeline.process(url, contentType);

    if (!result.success || !result.article) {
      console.log(`[Cron] Pipeline failed for ${url}: ${result.error}`);
      return [];
    }

    return [
      {
        source_url: result.article.url,
        source_name: result.article.sourceName,
        original_title: result.article.title,
        thumbnail_url: result.article.thumbnail,
        published_at: result.article.publishedAt,
        pipelineResult: result,
        contentType: contentType || "press",
      },
    ];
  } catch (error) {
    console.error(`[Cron] Error processing ${url}:`, error);
    return [];
  }
}

async function searchForKeyword(_keyword: string): Promise<RawArticle[]> {
  // TODO: Implement search with Claude Agent SDK WebSearch
  // For now, return empty array
  return [];
}

function deduplicateArticles<T extends RawArticle>(articles: T[]): T[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    if (seen.has(article.source_url)) {
      return false;
    }
    seen.add(article.source_url);
    return true;
  });
}

async function getExistingUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  urls: string[]
): Promise<Set<string>> {
  // Exclude rejected status - allow re-collection of rejected items
  const { data } = await supabase
    .from("contents")
    .select("source_url")
    .in("source_url", urls)
    .not("status", "eq", "rejected");

  return new Set((data || []).map((d) => d.source_url));
}

async function finishRun(
  supabase: Awaited<ReturnType<typeof createClient>>,
  runId: string | undefined,
  status: "success" | "failed",
  itemsFound: number,
  itemsValid: number,
  itemsSaved: number,
  itemsSkipped: number,
  startTime: number,
  logs: CronLogEntry[]
) {
  if (!runId) return;

  await supabase
    .from("cron_run_history")
    .update({
      finished_at: new Date().toISOString(),
      status,
      duration_ms: Date.now() - startTime,
      items_found: itemsFound,
      items_valid: itemsValid,
      items_saved: itemsSaved,
      items_skipped: itemsSkipped,
      log: logs,
    })
    .eq("id", runId);
}
