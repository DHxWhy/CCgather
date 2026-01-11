import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CronConfig, CronLogEntry, RawArticle } from "@/types/automation";

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

  const log = (level: CronLogEntry["level"], message: string, data?: Record<string, unknown>) => {
    logs.push({ timestamp: new Date().toISOString(), level, message, data });
    console[level === "error" ? "error" : "log"](`[Cron] ${message}`, data || "");
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

    log("info", "Starting news collection", { isManual });

    const supabase = await createClient();

    // Get run_id if manual
    let runId: string | undefined;
    if (isManual) {
      const body = await request.json().catch(() => ({}));
      runId = body.run_id;
    }

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

    // Collect articles from each target
    const collectedArticles: RawArticle[] = [];
    let itemsSkipped = 0;

    for (const target of targets) {
      try {
        log("info", `Processing target: ${target.type} - ${target.value}`);

        // Add delay between requests
        if (collectedArticles.length > 0) {
          await delay(config.delay_ms);
        }

        // Collect based on target type
        if (target.type === "url") {
          const articles = await collectFromUrl(target.value, target.category);
          collectedArticles.push(...articles);
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

    // Save new articles
    let savedCount = 0;
    for (const article of newArticles.slice(0, config.max_articles)) {
      try {
        const { error } = await supabase.from("contents").insert({
          type: "news",
          source_url: article.source_url,
          source_name: article.source_name,
          title: article.original_title,
          thumbnail_url: article.thumbnail_url,
          published_at: article.published_at, // Preserve original date
          status: "pending",
          category: "news",
        });

        if (!error) {
          savedCount++;
        } else {
          log("warn", `Failed to save article: ${article.source_url}`, { error: error.message });
        }
      } catch (saveError) {
        log("error", `Error saving article`, { error: String(saveError) });
      }
    }

    log("info", `Saved ${savedCount} new articles`);

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

async function collectFromUrl(url: string, _category?: string): Promise<RawArticle[]> {
  // For now, create a placeholder article
  // TODO: Implement actual web scraping with Claude Agent SDK
  const hostname = new URL(url).hostname;

  return [
    {
      source_url: url,
      source_name: hostname,
      original_title: `Article from ${hostname}`,
      published_at: new Date().toISOString(),
    },
  ];
}

async function searchForKeyword(_keyword: string): Promise<RawArticle[]> {
  // TODO: Implement search with Claude Agent SDK WebSearch
  // For now, return empty array
  return [];
}

function deduplicateArticles(articles: RawArticle[]): RawArticle[] {
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
  const { data } = await supabase.from("contents").select("source_url").in("source_url", urls);

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
