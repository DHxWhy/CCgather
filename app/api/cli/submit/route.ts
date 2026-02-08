import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAndAwardBadges } from "@/lib/services/badgeService";
import { calculateLevel, getLevelInfo } from "@/lib/types/leaderboard";
import {
  sendPushNotificationToUser,
  createSubmissionSummaryNotification,
} from "@/lib/push/send-notification";
import { aggregateByDate } from "@/lib/utils/usage-aggregation";

interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  sessions?: number;
  models?: Record<string, number>; // model name -> token count
}

// Find the most used model from daily usage data
function getPrimaryModel(dailyUsage?: DailyUsage[]): string | null {
  if (!dailyUsage || dailyUsage.length === 0) return null;

  const modelTotals: Record<string, number> = {};

  for (const day of dailyUsage) {
    if (day.models) {
      for (const [model, tokens] of Object.entries(day.models)) {
        modelTotals[model] = (modelTotals[model] || 0) + tokens;
      }
    }
  }

  if (Object.keys(modelTotals).length === 0) return null;

  // Find model with highest token usage
  let primaryModel: string | null = null;
  let maxTokens = 0;

  for (const [model, tokens] of Object.entries(modelTotals)) {
    if (tokens > maxTokens) {
      maxTokens = tokens;
      primaryModel = model;
    }
  }

  return primaryModel;
}

interface SessionFingerprint {
  sessionHashes: string[];
  combinedHash: string;
  sessionCount: number;
}

interface SubmitPayload {
  username?: string; // Now optional - use token auth instead
  totalTokens: number;
  totalSpent: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  daysTracked?: number;
  // Plan info - used for badge display only (not league placement in v2.0)
  ccplan?: string | null;
  rateLimitTier?: string | null;
  authMethod?: string; // "oauth" | "api_key" | "unknown" - for Team/Enterprise detection
  rawSubscriptionType?: string | null; // Original value for discovery logging
  timestamp: string;
  dailyUsage?: DailyUsage[]; // Array of daily usage data
  sessionFingerprint?: SessionFingerprint; // For duplicate prevention
  // V2.0: Opus detection (for badge display)
  hasOpusUsage?: boolean;
  opusModels?: string[];
  // Multi-device support
  deviceId?: string;
}

// Known CCplan values
const KNOWN_CCPLANS = ["free", "pro", "max", "team", "enterprise"];

interface AuthenticatedUser {
  id: string;
  username: string;
  total_tokens: number | null;
  total_cost: number | null;
  total_sessions: number | null;
  country_code?: string;
  last_submission_at?: string | null;
  global_rank?: number | null;
  country_rank?: number | null;
  current_level?: number | null;
}

// Rate limit settings: 2 submissions per hour
// (Since v2.0 submits ALL projects at once, frequent submissions are unnecessary)
const RATE_LIMIT_WINDOW_HOURS = 1;
const RATE_LIMIT_MAX_SUBMISSIONS = 2;

export async function POST(request: NextRequest) {
  try {
    const body: SubmitPayload = await request.json();

    // Validate required fields
    if (typeof body.totalTokens !== "number" || body.totalTokens < 0) {
      return NextResponse.json({ error: "Invalid totalTokens" }, { status: 400 });
    }

    if (typeof body.totalSpent !== "number" || body.totalSpent < 0) {
      return NextResponse.json({ error: "Invalid totalSpent" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check for token authentication (required)
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      if (body.username) {
        // Legacy username-based lookup (deprecated, will be removed)
        return NextResponse.json(
          {
            error: "Authentication required. Please run 'ccgather auth' first.",
            hint: "Username-based submission is no longer supported for security reasons.",
          },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "Authentication required. Please run 'ccgather auth' first." },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    // Find user by API token
    const { data: user, error: tokenError } = await supabase
      .from("users")
      .select(
        "id, username, total_tokens, total_cost, total_sessions, country_code, last_submission_at, global_rank, country_rank, current_level"
      )
      .eq("api_key", token)
      .maybeSingle();

    if (tokenError) {
      console.error("[CLI Submit] Token lookup error:", tokenError);
      return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired token. Please run 'ccgather auth' to re-authenticate." },
        { status: 401 }
      );
    }

    const authenticatedUser = user as AuthenticatedUser;

    // Rate limit check: count unique submissions in the last hour
    // Note: Each submission can create multiple rows (one per day), so we count DISTINCT submitted_at
    const oneHourAgo = new Date(
      Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();

    // Get distinct submission timestamps for this user in the last hour
    const { data: recentSubmissionData } = await supabase
      .from("usage_stats")
      .select("submitted_at")
      .eq("user_id", authenticatedUser.id)
      .gte("submitted_at", oneHourAgo);

    // Count unique submission timestamps
    const submissionTimestamps: string[] =
      recentSubmissionData?.map((r: { submitted_at: string }) => r.submitted_at) || [];
    const uniqueSubmissions = new Set(submissionTimestamps);
    const recentSubmissionCount = uniqueSubmissions.size;

    if (recentSubmissionCount >= RATE_LIMIT_MAX_SUBMISSIONS) {
      // Calculate when they can submit again (based on oldest unique submission)
      const sortedTimestamps = Array.from(uniqueSubmissions).sort();
      const oldestSubmissionTime = sortedTimestamps[0];

      let retryAfterMinutes = 60; // Default 60 minutes
      if (oldestSubmissionTime) {
        const oldestTime = new Date(oldestSubmissionTime).getTime();
        const windowEndTime = oldestTime + RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000;
        retryAfterMinutes = Math.ceil((windowEndTime - Date.now()) / (60 * 1000));
      }

      return NextResponse.json(
        {
          error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_SUBMISSIONS} submissions per hour.`,
          retryAfterMinutes: Math.max(1, retryAfterMinutes),
          hint: `Please try again in ${retryAfterMinutes} minute${retryAfterMinutes !== 1 ? "s" : ""}.`,
        },
        { status: 429 }
      );
    }

    // Get previous daily usage dates for comparison (before upsert)
    const { data: previousDailyData } = await supabase
      .from("usage_stats")
      .select("date, total_tokens, cost_usd")
      .eq("user_id", authenticatedUser.id)
      .order("date", { ascending: true });

    const previousDailyAggregated = aggregateByDate<{
      date: string;
      total_tokens: number;
      cost_usd: number;
    }>(
      previousDailyData as { date: string; total_tokens: number; cost_usd: number }[] | null,
      (d) => d.date,
      (d) => d.total_tokens ?? 0,
      (d) => d.cost_usd ?? 0
    );
    const previousDates = previousDailyAggregated.map((d) => d.date);
    const previousDailyMap = new Map(
      previousDailyAggregated.map((d) => [d.date, { tokens: d.tokens, cost: d.cost }])
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 0.5: Validate deviceId input (before session hash storage)
    // ═══════════════════════════════════════════════════════════════════════════
    const rawDeviceId = body.deviceId || "legacy";
    const deviceId =
      rawDeviceId === "legacy" || /^[a-f0-9]{8,16}$/.test(rawDeviceId) ? rawDeviceId : "legacy";

    // Session fingerprint duplicate check (1 Project 1 Person principle)
    if (body.sessionFingerprint?.sessionHashes?.length) {
      const { sessionHashes } = body.sessionFingerprint;

      // Check if any of these session hashes already belong to another user
      const { data: existingHashes } = await supabase
        .from("submitted_sessions")
        .select("session_hash, user_id")
        .in("session_hash", sessionHashes);

      if (existingHashes && existingHashes.length > 0) {
        // Check if any hash belongs to a different user
        const foreignHashes = existingHashes.filter(
          (h: { session_hash: string; user_id: string }) => h.user_id !== authenticatedUser.id
        );

        if (foreignHashes.length > 0) {
          console.log(
            `[CLI Submit] Duplicate session detected! User ${authenticatedUser.username} tried to submit sessions owned by another user. Conflicting hashes: ${foreignHashes.length}`
          );
          return NextResponse.json(
            {
              error: "These sessions have already been submitted by another account.",
              hint: "Each project's data can only be submitted by one account (1 Project 1 Person).",
              code: "DUPLICATE_SESSION",
            },
            { status: 409 }
          );
        }
      }

      // Store new session hashes for this user
      const newHashes = sessionHashes.filter(
        (hash: string) =>
          !existingHashes?.some((e: { session_hash: string }) => e.session_hash === hash)
      );

      if (newHashes.length > 0) {
        const hashRecords = newHashes.map((hash: string) => ({
          session_hash: hash,
          user_id: authenticatedUser.id,
          device_id: deviceId !== "legacy" ? deviceId : null,
        }));

        const { error: insertError } = await supabase
          .from("submitted_sessions")
          .insert(hashRecords);

        if (insertError) {
          console.error("[CLI Submit] Failed to store session hashes:", insertError);
          // Don't fail the submission, just log the error
        } else {
          console.log(
            `[CLI Submit] Stored ${newHashes.length} new session hashes for user ${authenticatedUser.username}`
          );
        }
      }
    }

    // Validate dailyUsage date formats
    if (body.dailyUsage) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      for (const day of body.dailyUsage) {
        if (!dateRegex.test(day.date)) {
          return NextResponse.json(
            { error: `Invalid date format: ${day.date}. Expected YYYY-MM-DD.` },
            { status: 400 }
          );
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 0.7: Reinstall detection — QUERY ONLY (cleanup deferred to STEP 1.7)
    // Detect if same session hashes appear with a different device_id, indicating
    // a CLI reinstall. Actual cleanup runs AFTER successful upsert to prevent
    // data loss if upsert fails.
    // NOTE: This query must run AFTER session hash insertion (lines above) because
    // new hashes are inserted with the current device_id and won't match here.
    // ═══════════════════════════════════════════════════════════════════════════
    let staleDeviceInfo: { staleDeviceIds: string[]; staleHashes: string[] } | null = null;

    if (deviceId !== "legacy" && body.sessionFingerprint?.sessionHashes?.length) {
      const { data: staleDeviceRows } = await supabase
        .from("submitted_sessions")
        .select("session_hash, device_id")
        .eq("user_id", authenticatedUser.id)
        .in("session_hash", body.sessionFingerprint.sessionHashes)
        .not("device_id", "is", null)
        .neq("device_id", deviceId);

      if (staleDeviceRows && staleDeviceRows.length > 0) {
        const staleIds = staleDeviceRows.map(
          (r: { device_id: string | null }) => r.device_id as string
        );
        const staleHashList = staleDeviceRows.map((r: { session_hash: string }) => r.session_hash);
        staleDeviceInfo = {
          staleDeviceIds: [...new Set<string>(staleIds)],
          staleHashes: staleHashList,
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Insert/Update daily usage records FIRST (before legacy cleanup)
    // ═══════════════════════════════════════════════════════════════════════════
    const overallPrimaryModel = getPrimaryModel(body.dailyUsage);
    let upsertSucceeded = false;

    if (body.dailyUsage && body.dailyUsage.length > 0) {
      // Bulk insert daily usage data (upsert - replace existing records for same date)
      const usageRecords = body.dailyUsage.map((day) => {
        // Find primary model for this day
        let dayPrimaryModel: string | null = null;
        if (day.models && Object.keys(day.models).length > 0) {
          let maxTokens = 0;
          for (const [model, tokens] of Object.entries(day.models)) {
            if (tokens > maxTokens) {
              maxTokens = tokens;
              dayPrimaryModel = model;
            }
          }
        }

        // Determine league_reason based on model (Opus detection)
        const isOpusModel = dayPrimaryModel?.toLowerCase().includes("opus");

        return {
          user_id: authenticatedUser.id,
          date: day.date,
          total_tokens: day.tokens,
          input_tokens: day.inputTokens || 0,
          output_tokens: day.outputTokens || 0,
          cache_read_tokens: day.cacheReadTokens || 0,
          cache_write_tokens: day.cacheWriteTokens || 0,
          cost_usd: day.cost,
          sessions: day.sessions || 0,
          primary_model: dayPrimaryModel,
          submitted_at: new Date().toISOString(),
          device_id: deviceId,
          submission_source: "cli",
          league_reason: isOpusModel ? "opus" : null,
        };
      });

      const { error: statsError } = await supabase
        .from("usage_stats")
        .upsert(usageRecords, { onConflict: "user_id,date,device_id" });

      if (statsError) {
        console.error("[CLI Submit] Bulk usage stats upsert error:", statsError);
      } else {
        upsertSucceeded = true;
        console.log(
          `[CLI Submit] Inserted ${usageRecords.length} daily usage records for user ${authenticatedUser.username}`
        );
      }
    } else {
      // Fallback: Insert only today's record (legacy behavior)
      const today = new Date().toISOString().split("T")[0];
      const isOpusModel = overallPrimaryModel?.toLowerCase().includes("opus");

      const { error: statsError } = await supabase.from("usage_stats").upsert(
        {
          user_id: authenticatedUser.id,
          date: today,
          total_tokens: body.totalTokens,
          input_tokens: body.inputTokens || 0,
          output_tokens: body.outputTokens || 0,
          cache_read_tokens: body.cacheReadTokens || 0,
          cache_write_tokens: body.cacheWriteTokens || 0,
          cost_usd: body.totalSpent,
          primary_model: overallPrimaryModel,
          submitted_at: new Date().toISOString(),
          device_id: deviceId,
          submission_source: "cli",
          league_reason: isOpusModel ? "opus" : null,
        },
        { onConflict: "user_id,date,device_id" }
      );

      if (statsError) {
        console.error("[CLI Submit] Usage stats upsert error:", statsError);
      } else {
        upsertSucceeded = true;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1.5: Date-scoped legacy cleanup (AFTER successful upsert)
    // Only delete legacy rows for dates that were just upserted with a real
    // device ID. This prevents duplication without risking data loss.
    // ═══════════════════════════════════════════════════════════════════════════
    if (upsertSucceeded && deviceId !== "legacy" && body.dailyUsage && body.dailyUsage.length > 0) {
      const submittingDates = body.dailyUsage.map((d) => d.date);

      const { error: deleteError, count: deletedCount } = await supabase
        .from("usage_stats")
        .delete({ count: "exact" })
        .eq("user_id", authenticatedUser.id)
        .eq("device_id", "legacy")
        .in("date", submittingDates);

      if (deleteError) {
        console.error("[CLI Submit] Legacy cleanup error:", deleteError);
        // Non-fatal: duplicate rows may remain, but STEP 2 SUM will be higher.
        // Next submission will retry cleanup. No data loss occurs.
      } else if (deletedCount && deletedCount > 0) {
        console.log(
          `[CLI Submit] Cleaned ${deletedCount} legacy rows for user ${authenticatedUser.username}`
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1.7: Reinstall cleanup (deferred from STEP 0.7, guarded by upsertSucceeded)
    // Only runs after new data is safely written, preventing data loss if upsert fails.
    // Also guards submitted_sessions update with submittingDates to avoid orphaned rows.
    // ═══════════════════════════════════════════════════════════════════════════
    if (upsertSucceeded && staleDeviceInfo && body.dailyUsage && body.dailyUsage.length > 0) {
      const submittingDates = body.dailyUsage.map((d) => d.date);

      console.log(
        `[CLI Submit] Reinstall detected for user ${authenticatedUser.username}: ` +
          `old devices [${staleDeviceInfo.staleDeviceIds.join(",")}] → new device ${deviceId}. ` +
          `Cleaning ${submittingDates.length} date(s).`
      );

      // Delete old device's usage_stats rows for the submitting dates only
      for (const staleId of staleDeviceInfo.staleDeviceIds) {
        const { error: cleanupError, count: cleanedCount } = await supabase
          .from("usage_stats")
          .delete({ count: "exact" })
          .eq("user_id", authenticatedUser.id)
          .eq("device_id", staleId)
          .in("date", submittingDates);

        if (cleanupError) {
          console.error(
            `[CLI Submit] Reinstall cleanup error for device ${staleId}:`,
            cleanupError
          );
        } else if (cleanedCount && cleanedCount > 0) {
          console.log(`[CLI Submit] Cleaned ${cleanedCount} rows from stale device ${staleId}`);
        }
      }

      // Update submitted_sessions to the new device_id (only when cleanup ran)
      const { error: updateError } = await supabase
        .from("submitted_sessions")
        .update({ device_id: deviceId })
        .eq("user_id", authenticatedUser.id)
        .in("session_hash", staleDeviceInfo.staleHashes);

      if (updateError) {
        console.error("[CLI Submit] Failed to update session device_id:", updateError);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Calculate cumulative totals from ALL daily usage records
    // ═══════════════════════════════════════════════════════════════════════════
    const { data: allDailyUsage, error: sumError } = await supabase
      .from("usage_stats")
      .select("total_tokens, cost_usd, sessions, device_id")
      .eq("user_id", authenticatedUser.id);

    // Sum all daily usage for true cumulative totals (tokens, cost, sessions)
    let finalTotalTokens = 0;
    let finalTotalCost = 0;
    let finalTotalSessions = 0;

    if (sumError || !allDailyUsage) {
      // CRITICAL: Preserve existing user values to prevent data loss.
      // If SUM query fails, do NOT write 0 to users table.
      // Next successful submission will recalculate from usage_stats.
      console.error("[CLI Submit] CRITICAL: Failed to calculate cumulative totals:", sumError);
      finalTotalTokens = authenticatedUser.total_tokens || 0;
      finalTotalCost = authenticatedUser.total_cost || 0;
      finalTotalSessions = authenticatedUser.total_sessions || 0;
    } else {
      for (const day of allDailyUsage) {
        finalTotalTokens += day.total_tokens || 0;
        finalTotalCost += day.cost_usd || 0;
        finalTotalSessions += day.sessions || 0;
      }
    }

    console.log(
      `[CLI Submit] Cumulative totals for ${authenticatedUser.username}: ${finalTotalTokens} tokens, $${finalTotalCost.toFixed(2)}, ${finalTotalSessions} sessions`
    );

    // Calculate per-device breakdown for multi-device display
    const deviceTotals = new Map<string, { tokens: number; cost: number }>();
    if (allDailyUsage) {
      for (const day of allDailyUsage) {
        const did = day.device_id || "legacy";
        const existing = deviceTotals.get(did);
        if (existing) {
          existing.tokens += day.total_tokens || 0;
          existing.cost += day.cost_usd || 0;
        } else {
          deviceTotals.set(did, {
            tokens: day.total_tokens || 0,
            cost: day.cost_usd || 0,
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Update user stats with cumulative totals
    // ═══════════════════════════════════════════════════════════════════════════
    const level = calculateLevel(finalTotalTokens);

    const updateData: Record<string, unknown> = {
      total_tokens: finalTotalTokens,
      total_cost: finalTotalCost,
      last_submission_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      current_level: level,
    };

    // V2.0: Store Opus usage for badge display
    if (body.hasOpusUsage) {
      updateData.has_opus_usage = true;
      if (body.opusModels && body.opusModels.length > 0) {
        updateData.opus_models = body.opusModels;
      }
    }

    // Store cumulative session count (same logic as tokens - SUM from usage_stats)
    updateData.total_sessions = finalTotalSessions;

    // Update primary_model if detected
    if (overallPrimaryModel) {
      updateData.primary_model = overallPrimaryModel;
      updateData.primary_model_updated_at = new Date().toISOString();
    }

    // Update ccplan if provided
    if (body.ccplan) {
      const normalizedCcplan = body.ccplan.toLowerCase();
      updateData.ccplan = normalizedCcplan;
      updateData.ccplan_updated_at = new Date().toISOString();

      // Log unknown ccplan values for discovery (Team/Enterprise patterns)
      if (!KNOWN_CCPLANS.includes(normalizedCcplan)) {
        console.log(
          `[CLI Submit] Unknown ccplan discovered: "${body.ccplan}" (raw: "${body.rawSubscriptionType}", auth: "${body.authMethod}") for user ${authenticatedUser.username}`
        );

        // Store alert for admin review
        await supabase.from("admin_alerts").insert({
          type: "unknown_ccplan",
          message: `Unknown ccplan "${body.ccplan}" discovered`,
          metadata: {
            user_id: authenticatedUser.id,
            username: authenticatedUser.username,
            ccplan: body.ccplan,
            rawSubscriptionType: body.rawSubscriptionType,
            authMethod: body.authMethod,
            rateLimitTier: body.rateLimitTier,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Update rate_limit_tier if provided
    if (body.rateLimitTier) {
      updateData.rate_limit_tier = body.rateLimitTier;
    }

    // Log API key auth users for Team/Enterprise discovery
    if (body.authMethod === "api_key") {
      console.log(
        `[CLI Submit] API Key auth user: ${authenticatedUser.username} (ccplan: ${body.ccplan || "unknown"}, raw: ${body.rawSubscriptionType || "none"})`
      );
    }

    const { error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", authenticatedUser.id);

    if (updateError) {
      console.error("[CLI Submit] Update error:", updateError);
      return NextResponse.json({ error: "Failed to update stats" }, { status: 500 });
    }

    // Calculate rank
    // FIX: Update ALL users' global_rank (not just self) to prevent rank drift
    const { data: rankData } = await supabase
      .from("users")
      .select("id")
      .gt("total_tokens", 0)
      .order("total_tokens", { ascending: false });

    let rank = 0;
    if (rankData && rankData.length > 0) {
      // Update ALL users' global_rank
      const updatePromises = rankData.map((user: { id: string }, index: number) =>
        supabase
          .from("users")
          .update({ global_rank: index + 1 })
          .eq("id", user.id)
      );
      await Promise.all(updatePromises);

      // Get current user's rank
      const currentUserIndex = rankData.findIndex(
        (u: { id: string }) => u.id === authenticatedUser.id
      );
      if (currentUserIndex >= 0) {
        rank = currentUserIndex + 1;
      }
    }

    // Get country rank for badge calculation
    // FIX: Update ALL users' country_rank in the same country (not just self)
    let countryRank: number | undefined;
    if (authenticatedUser.country_code) {
      const { data: countryRankData } = await supabase
        .from("users")
        .select("id")
        .eq("country_code", authenticatedUser.country_code)
        .gt("total_tokens", 0)
        .order("total_tokens", { ascending: false });

      if (countryRankData && countryRankData.length > 0) {
        // Update ALL users' country_rank in this country
        const updatePromises = countryRankData.map((user: { id: string }, index: number) =>
          supabase
            .from("users")
            .update({ country_rank: index + 1 })
            .eq("id", user.id)
        );
        await Promise.all(updatePromises);

        // Get current user's rank for badge calculation
        const currentUserIndex = countryRankData.findIndex(
          (u: { id: string }) => u.id === authenticatedUser.id
        );
        if (currentUserIndex >= 0) {
          countryRank = currentUserIndex + 1;
        }
      }
    }

    // Check and award badges
    const usageHistory = body.dailyUsage?.map((d) => ({ date: d.date, tokens: d.tokens })) || [];
    const { newBadges, allBadges } = await checkAndAwardBadges(
      authenticatedUser.id,
      {
        id: authenticatedUser.id,
        total_tokens: finalTotalTokens,
        total_cost: finalTotalCost,
        global_rank: rank || 9999,
        country_rank: countryRank,
        country_code: authenticatedUser.country_code,
      },
      usageHistory
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: Invalidate caches for immediate data refresh
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      // Invalidate leaderboard cache (affects all leaderboard pages)
      revalidatePath("/api/leaderboard");
      // Invalidate country statistics cache
      revalidatePath("/api/countries");
      // Invalidate global statistics cache
      revalidatePath("/api/stats/global");
      // Invalidate this user's profile cache
      revalidatePath(`/api/profile/${authenticatedUser.username}`);

      console.log(`[CLI Submit] Cache invalidated for user ${authenticatedUser.username}`);
    } catch (cacheError) {
      // Cache invalidation failure should not block the submission
      console.error("[CLI Submit] Cache invalidation error:", cacheError);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5: Send Unified Push Notification (non-blocking)
    // ═══════════════════════════════════════════════════════════════════════════
    (async () => {
      try {
        // Get user's notification settings
        const { data: notifySettings } = await supabase
          .from("user_notification_settings")
          .select("push_enabled, notify_submissions")
          .eq("user_id", authenticatedUser.id)
          .single();

        // Default to enabled if no settings found
        const settings = notifySettings || {
          push_enabled: true,
          notify_submissions: true,
        };

        // Skip if push notifications are disabled
        if (!settings.push_enabled || !settings.notify_submissions || !rank) {
          return;
        }

        // Build unified submission summary notification
        const prevGlobalRank = authenticatedUser.global_rank;
        const prevLevel = authenticatedUser.current_level || 1;

        const payload = createSubmissionSummaryNotification({
          totalTokens: finalTotalTokens,
          rank,
          // Only show rank change if improved
          rankChange: prevGlobalRank && rank < prevGlobalRank ? prevGlobalRank - rank : undefined,
          // Only show level up if actually leveled up
          newLevel: level > prevLevel ? { level, name: getLevelInfo(level).name } : undefined,
          // Include new badges
          newBadges:
            newBadges.length > 0
              ? newBadges.map((b) => ({ name: b.name, icon: b.icon }))
              : undefined,
        });

        await sendPushNotificationToUser(authenticatedUser.id, payload);
      } catch (notifyError) {
        // Non-blocking: don't fail submission due to notification errors
        console.error("[CLI Submit] Notification error:", notifyError);
      }
    })();

    // Build response with previous submission info (for CLI UX)
    const levelInfo = getLevelInfo(level);
    const nextLevelInfo = getLevelInfo(level + 1);
    const tokensInCurrentLevel = finalTotalTokens - levelInfo.min;
    const tokensNeededForLevel = levelInfo.max - levelInfo.min;
    const levelProgress = Math.min(
      100,
      Math.floor((tokensInCurrentLevel / tokensNeededForLevel) * 100)
    );
    const tokensToNextLevel = levelInfo.max - finalTotalTokens;

    const response: Record<string, unknown> = {
      success: true,
      profileUrl: `https://ccgather.com/u/${authenticatedUser.username}`,
      rank: rank || undefined,
      countryRank: countryRank || undefined,
      currentLevel: level,
      // Accumulated totals for accurate level progress display
      accumulatedTokens: finalTotalTokens,
      accumulatedCost: finalTotalCost,
      // Level progress info
      levelInfo: {
        level,
        name: levelInfo.name,
        icon: levelInfo.icon,
        progress: levelProgress,
        tokensToNextLevel: tokensToNextLevel > 0 ? tokensToNextLevel : 0,
        nextLevelName: nextLevelInfo?.name || null,
      },
      // Badge information
      newBadges: newBadges.map((b) => ({
        id: b.id,
        name: b.name,
        icon: b.icon,
        description: b.description,
        praise: b.praise,
        rarity: b.rarity,
        category: b.category,
        earnedAt: new Date().toISOString(),
      })),
      totalBadges: allBadges.length,
    };

    // Include multi-device breakdown only when genuinely multiple real devices
    // Exclude "legacy" from device count — legacy is not a real device
    const realDeviceIds = Array.from(deviceTotals.keys()).filter((k) => k !== "legacy");

    if (realDeviceIds.length > 1) {
      const thisDevice = deviceTotals.get(deviceId) || { tokens: 0, cost: 0 };
      let otherTokens = 0;
      let otherCost = 0;
      deviceTotals.forEach((val, key) => {
        if (key !== deviceId) {
          otherTokens += val.tokens;
          otherCost += val.cost;
        }
      });

      response.deviceInfo = {
        totalDevices: realDeviceIds.length,
        thisDeviceTokens: thisDevice.tokens,
        thisDeviceCost: thisDevice.cost,
        otherDevicesTokens: otherTokens,
        otherDevicesCost: otherCost,
        combinedTokens: finalTotalTokens,
        combinedCost: finalTotalCost,
      };
    }

    // Include previous submission info if user has submitted before
    if (authenticatedUser.last_submission_at) {
      // Convert previousDailyMap to array for response
      const previousDaily: Array<{ date: string; tokens: number; cost: number }> = [];
      previousDailyMap.forEach((value, key) => {
        previousDaily.push({ date: key, tokens: value.tokens, cost: value.cost });
      });

      response.previous = {
        totalTokens: authenticatedUser.total_tokens || 0,
        totalCost: authenticatedUser.total_cost || 0,
        lastSubmissionAt: authenticatedUser.last_submission_at,
        sessionCount: body.sessionFingerprint?.sessionCount || 0,
        previousDates,
        previousDaily,
        // Previous ranks for rank change display
        previousGlobalRank: authenticatedUser.global_rank || null,
        previousCountryRank: authenticatedUser.country_rank || null,
        // Previous level for level change display (null if not set)
        previousLevel: authenticatedUser.current_level || null,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[CLI Submit] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
