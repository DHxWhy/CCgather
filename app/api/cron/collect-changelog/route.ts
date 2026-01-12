/**
 * Changelog Cron Job - Automated Official Changelog Sync
 *
 * Monitors https://code.claude.com/docs/en/changelog for new versions
 * and triggers the AI pipeline to process new entries.
 *
 * Schedule: Every 6 hours (0 star/6 star star star in cron syntax)
 * Cost: ~$2-5 per new version processed
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processAndSaveChangelog } from "@/lib/ai/changelog";

// Official changelog URL
const OFFICIAL_CHANGELOG_URL = "https://code.claude.com/docs/en/changelog";

// Types
interface ChangelogVersion {
  version: string;
  anchor: string; // e.g., "#210" for v2.1.0
}

interface CronLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
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

  const log = (level: CronLogEntry["level"], message: string, data?: Record<string, unknown>) => {
    logs.push({ timestamp: new Date().toISOString(), level, message, data });
    console[level === "error" ? "error" : "log"](`[Changelog Cron] ${message}`, data || "");
  };

  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "dev-secret";

    if (authHeader !== `Bearer ${cronSecret}`) {
      const vercelCron = request.headers.get("x-vercel-cron");
      if (!vercelCron && process.env.NODE_ENV !== "development") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    log("info", "Starting changelog sync", { isManual });

    const supabase = await createClient();

    // Check if ANTHROPIC_API_KEY is set
    if (!process.env.ANTHROPIC_API_KEY) {
      log("error", "ANTHROPIC_API_KEY not set - cannot process changelog");
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    // 1. Fetch official changelog page
    log("info", "Fetching official changelog...");
    const htmlContent = await fetchOfficialChangelog();

    if (!htmlContent) {
      log("error", "Failed to fetch official changelog");
      return NextResponse.json({ error: "Failed to fetch changelog" }, { status: 500 });
    }

    // 2. Extract version list from HTML
    log("info", "Extracting versions from changelog...");
    const detectedVersions = extractVersionsFromHtml(htmlContent);

    if (detectedVersions.length === 0) {
      log("warn", "No versions detected in changelog");
      return NextResponse.json({ message: "No versions found" });
    }

    log("info", `Detected ${detectedVersions.length} versions in official changelog`);

    // 3. Get existing versions from database
    const { data: existingVersions } = await supabase.from("changelog_versions").select("version");

    const existingSet = new Set((existingVersions || []).map((v) => v.version));

    // 4. Find new versions
    const newVersions = detectedVersions.filter((v) => !existingSet.has(v.version));

    if (newVersions.length === 0) {
      log("info", "No new versions to process");

      // Update cron job stats
      await updateCronJobStats(supabase, startTime, "success", 0, logs);

      return NextResponse.json({
        success: true,
        message: "No new versions",
        existingCount: existingSet.size,
        detectedCount: detectedVersions.length,
      });
    }

    log("info", `Found ${newVersions.length} new versions to process`, {
      versions: newVersions.map((v) => v.version),
    });

    // 5. Process new versions (limit to 3 at a time to control costs)
    const versionsToProcess = newVersions.slice(0, 3);
    let processedCount = 0;
    let totalCost = 0;
    const processedVersions: string[] = [];

    for (const versionInfo of versionsToProcess) {
      try {
        log("info", `Processing v${versionInfo.version}...`);

        // Build version-specific URL
        const versionUrl = `${OFFICIAL_CHANGELOG_URL}${versionInfo.anchor}`;

        // Run the AI pipeline (2-stage: Haiku → Opus 4.5)
        const result = await processAndSaveChangelog(versionUrl, {
          targetAudience: "beginner",
        });

        if (result.success) {
          processedCount++;
          totalCost += result.totalCost;
          processedVersions.push(versionInfo.version);

          log("info", `Successfully processed v${versionInfo.version}`, {
            items: result.items.length,
            cost: result.totalCost,
          });
        } else {
          log("error", `Failed to process v${versionInfo.version}`, {
            error: result.error,
          });
        }

        // Delay between versions (60 seconds) to avoid rate limits
        if (versionsToProcess.indexOf(versionInfo) < versionsToProcess.length - 1) {
          await delay(60000);
        }
      } catch (versionError) {
        log("error", `Error processing v${versionInfo.version}`, {
          error: String(versionError),
        });
      }
    }

    // 6. Update cron job stats
    await updateCronJobStats(supabase, startTime, "success", processedCount, logs, {
      versions_processed: processedVersions,
      total_cost: totalCost,
      remaining_new_versions: newVersions.length - versionsToProcess.length,
    });

    // 7. Log AI usage
    if (totalCost > 0) {
      await supabase.from("ai_usage_log").insert({
        model: "haiku+sonnet+opus",
        operation: "changelog_sync",
        input_tokens: 0, // Aggregated in pipeline
        output_tokens: 0,
        cost_usd: totalCost,
        metadata: {
          versions_processed: processedVersions,
          cron_run: true,
        },
      });
    }

    log("info", "Changelog sync complete", {
      processed: processedCount,
      cost: totalCost,
      duration_ms: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      processed: processedCount,
      versions: processedVersions,
      totalCost,
      remainingNew: newVersions.length - versionsToProcess.length,
      duration_ms: Date.now() - startTime,
    });
  } catch (error) {
    log("error", "Changelog cron failed", { error: String(error) });

    const supabase = await createClient();
    await updateCronJobStats(supabase, startTime, "failed", 0, logs);

    return NextResponse.json({ error: "Changelog sync failed" }, { status: 500 });
  }
}

// ============================================
// Helper Functions
// ============================================

async function fetchOfficialChangelog(): Promise<string | null> {
  try {
    const response = await fetch(OFFICIAL_CHANGELOG_URL, {
      headers: {
        "User-Agent": "CCgather-Bot/1.0 (+https://ccgather.dev)",
      },
    });

    if (!response.ok) {
      console.error(`[Changelog] HTTP ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error("[Changelog] Fetch error:", error);
    return null;
  }
}

function extractVersionsFromHtml(html: string): ChangelogVersion[] {
  const versions: ChangelogVersion[] = [];

  // Pattern: <h2 id="210">2.1.0</h2> or similar
  // Also matches: <h2 id="v210">v2.1.0</h2>
  const versionPattern = /<h[23][^>]*id=["']([^"']+)["'][^>]*>(?:v)?(\d+\.\d+(?:\.\d+)?)/gi;

  let match;
  while ((match = versionPattern.exec(html)) !== null) {
    const [, anchor, version] = match;
    if (anchor && version) {
      versions.push({
        version,
        anchor: `#${anchor}`,
      });
    }
  }

  // Also try to find versions in anchor links
  const anchorPattern = /href=["']#(\d+)["'][^>]*>(?:v)?(\d+\.\d+(?:\.\d+)?)/gi;
  while ((match = anchorPattern.exec(html)) !== null) {
    const [, anchor, version] = match;
    if (anchor && version && !versions.some((v) => v.version === version)) {
      versions.push({
        version,
        anchor: `#${anchor}`,
      });
    }
  }

  // Sort by version (newest first)
  return versions.sort((a, b) => {
    const partsA = a.version.split(".").map(Number);
    const partsB = b.version.split(".").map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const diff = (partsB[i] || 0) - (partsA[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateCronJobStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  startTime: number,
  status: "success" | "failed",
  itemsProcessed: number,
  logs: CronLogEntry[],
  extraData?: Record<string, unknown>
) {
  // Get or create cron job record
  const { data: cronJob } = await supabase
    .from("cron_jobs")
    .select("*")
    .eq("id", "changelog-sync")
    .single();

  const updateData = {
    id: "changelog-sync",
    name: "Changelog Sync",
    schedule: "0 */6 * * *", // Every 6 hours
    is_running: false,
    last_run_at: new Date().toISOString(),
    last_run_status: status,
    last_run_duration_ms: Date.now() - startTime,
    run_count: (cronJob?.run_count || 0) + 1,
    success_count: (cronJob?.success_count || 0) + (status === "success" ? 1 : 0),
    total_items_collected: (cronJob?.total_items_collected || 0) + itemsProcessed,
    last_run_result: {
      items_processed: itemsProcessed,
      logs: logs.slice(-20), // Keep last 20 log entries
      ...extraData,
    },
    last_error: status === "failed" ? logs.find((l) => l.level === "error")?.message : null,
  };

  await supabase.from("cron_jobs").upsert(updateData, { onConflict: "id" });
}
