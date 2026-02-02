import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAndAwardBadges } from "@/lib/services/badgeService";
import { calculateLevel, getLevelInfo } from "@/lib/types/leaderboard";
import {
  sendPushNotificationToUser,
  createSubmissionSummaryNotification,
} from "@/lib/push/send-notification";

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

    const previousDates = previousDailyData?.map((d: { date: string }) => d.date) || [];
    const previousDailyMap = new Map<string, { tokens: number; cost: number }>();
    previousDailyData?.forEach((d: { date: string; total_tokens: number; cost_usd: number }) => {
      previousDailyMap.set(d.date, { tokens: d.total_tokens, cost: d.cost_usd });
    });

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

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Insert/Update daily usage records FIRST
    // ═══════════════════════════════════════════════════════════════════════════
    const overallPrimaryModel = getPrimaryModel(body.dailyUsage);

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
          submission_source: "cli",
          league_reason: isOpusModel ? "opus" : null,
        };
      });

      const { error: statsError } = await supabase
        .from("usage_stats")
        .upsert(usageRecords, { onConflict: "user_id,date" });

      if (statsError) {
        console.error("[CLI Submit] Bulk usage stats upsert error:", statsError);
      } else {
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
          submission_source: "cli",
          league_reason: isOpusModel ? "opus" : null,
        },
        { onConflict: "user_id,date" }
      );

      if (statsError) {
        console.error("[CLI Submit] Usage stats upsert error:", statsError);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Calculate cumulative totals from ALL daily usage records
    // ═══════════════════════════════════════════════════════════════════════════
    const { data: allDailyUsage, error: sumError } = await supabase
      .from("usage_stats")
      .select("total_tokens, cost_usd, sessions")
      .eq("user_id", authenticatedUser.id);

    if (sumError) {
      console.error("[CLI Submit] Failed to calculate cumulative totals:", sumError);
    }

    // Sum all daily usage for true cumulative totals (tokens, cost, sessions)
    let finalTotalTokens = 0;
    let finalTotalCost = 0;
    let finalTotalSessions = 0;
    if (allDailyUsage) {
      for (const day of allDailyUsage) {
        finalTotalTokens += day.total_tokens || 0;
        finalTotalCost += day.cost_usd || 0;
        finalTotalSessions += day.sessions || 0;
      }
    }

    console.log(
      `[CLI Submit] Cumulative totals for ${authenticatedUser.username}: ${finalTotalTokens} tokens, $${finalTotalCost.toFixed(2)}, ${finalTotalSessions} sessions`
    );

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
    const { data: rankData } = await supabase
      .from("users")
      .select("id")
      .gt("total_tokens", 0)
      .order("total_tokens", { ascending: false });

    const rank =
      (rankData?.findIndex((u: { id: string }) => u.id === authenticatedUser.id) ?? -1) + 1;

    // Update global rank
    if (rank > 0) {
      await supabase.from("users").update({ global_rank: rank }).eq("id", authenticatedUser.id);
    }

    // Get country rank for badge calculation
    let countryRank: number | undefined;
    if (authenticatedUser.country_code) {
      const { data: countryRankData } = await supabase
        .from("users")
        .select("id")
        .eq("country_code", authenticatedUser.country_code)
        .gt("total_tokens", 0)
        .order("total_tokens", { ascending: false });

      const foundRank =
        (countryRankData?.findIndex((u: { id: string }) => u.id === authenticatedUser.id) ?? -1) +
        1;

      if (foundRank > 0) {
        countryRank = foundRank;
        await supabase
          .from("users")
          .update({ country_rank: countryRank })
          .eq("id", authenticatedUser.id);
      }
    }

    // Check and award badges
    const usageHistory = body.dailyUsage?.map((d) => ({ date: d.date, tokens: d.tokens })) || [];
    const { newBadges, allBadges } = await checkAndAwardBadges(
      authenticatedUser.id,
      {
        id: authenticatedUser.id,
        total_tokens: Math.max(authenticatedUser.total_tokens || 0, body.totalTokens),
        total_cost: Math.max(authenticatedUser.total_cost || 0, body.totalSpent),
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
