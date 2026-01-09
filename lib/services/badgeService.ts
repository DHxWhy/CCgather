import { createServiceClient } from "@/lib/supabase/server";
import { BADGES, type Badge, type BadgeContext } from "@/lib/constants/badges";

interface UsageDay {
  date: string;
  tokens: number;
}

interface BadgeCheckResult {
  newBadges: Badge[];
  allBadges: string[];
}

/**
 * Calculate consecutive days streak from usage history
 */
function calculateStreak(usageHistory: UsageDay[]): number {
  if (!usageHistory || usageHistory.length === 0) return 0;

  // Sort by date descending (most recent first)
  const sorted = [...usageHistory]
    .filter((day) => day.tokens > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) return 0;

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Check if most recent activity is today or yesterday
  const mostRecent = sorted[0]?.date;
  if (mostRecent !== today && mostRecent !== yesterday) {
    return 0; // Streak broken
  }

  let streak = 1;
  let currentDate = new Date(mostRecent!);

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const expectedDate = prevDate.toISOString().split("T")[0];

    if (sorted[i]?.date === expectedDate) {
      streak++;
      currentDate = prevDate;
    } else {
      break; // Gap found, streak ends
    }
  }

  return streak;
}

/**
 * Build BadgeContext from user data
 * This prepares all the data needed to check badge conditions
 */
async function buildBadgeContext(
  userId: string,
  stats: {
    total_tokens: number;
    total_cost: number;
    global_rank: number;
    country_rank?: number;
    country_code?: string;
    referral_count?: number;
  },
  usageHistory?: UsageDay[]
): Promise<BadgeContext> {
  const supabase = createServiceClient();

  // Calculate streak
  const streak = usageHistory ? calculateStreak(usageHistory) : 0;

  // Check if user is top 10 earliest from their country (for trailblazer badge)
  let isEarlyCountryUser = false;
  if (stats.country_code) {
    const { data: earlyUsers } = await supabase
      .from("users")
      .select("id")
      .eq("country_code", stats.country_code)
      .order("created_at", { ascending: true })
      .limit(10);

    isEarlyCountryUser = earlyUsers?.some((u: { id: string }) => u.id === userId) || false;
  }

  return {
    total_tokens: stats.total_tokens,
    total_cost: stats.total_cost,
    global_rank: stats.global_rank,
    country_rank: stats.country_rank,
    country_code: stats.country_code,
    referral_count: stats.referral_count,
    streak,
    is_early_country_user: isEarlyCountryUser,
    // TODO: Add model_usage when model breakdown data is available
    // TODO: Add rank_gain_weekly when rank history tracking is implemented
  };
}

/**
 * Check all badge conditions and return newly earned badges
 * Uses the condition function defined in each badge
 */
export async function checkAndAwardBadges(
  userId: string,
  stats: {
    id: string;
    total_tokens: number;
    total_cost: number;
    global_rank: number;
    country_rank?: number;
    country_code?: string;
    referral_count?: number;
  },
  usageHistory?: UsageDay[]
): Promise<BadgeCheckResult> {
  const supabase = createServiceClient();

  // Get existing badges
  const { data: existingBadges } = await supabase
    .from("user_badges")
    .select("badge_type")
    .eq("user_id", userId);

  const earnedBadgeIds = new Set<string>(
    existingBadges?.map((b: { badge_type: string }) => b.badge_type) || []
  );
  const newlyEarnedBadges: Badge[] = [];

  // Build context once for all badge checks
  const context = await buildBadgeContext(userId, stats, usageHistory);

  // Check each badge using its condition function
  for (const badge of BADGES) {
    // Skip if already earned
    if (earnedBadgeIds.has(badge.id)) continue;

    // Check condition using the badge's condition function
    const shouldAward = badge.condition(context);

    if (shouldAward) {
      newlyEarnedBadges.push(badge);
      earnedBadgeIds.add(badge.id);
    }
  }

  // Insert newly earned badges into database
  if (newlyEarnedBadges.length > 0) {
    const badgeRecords = newlyEarnedBadges.map((badge) => ({
      user_id: userId,
      badge_type: badge.id,
      earned_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("user_badges").insert(badgeRecords);

    if (error) {
      console.error("[BadgeService] Failed to insert badges:", error);
    } else {
      console.log(
        `[BadgeService] Awarded ${newlyEarnedBadges.length} badges to user ${userId}:`,
        newlyEarnedBadges.map((b) => b.name).join(", ")
      );
    }
  }

  return {
    newBadges: newlyEarnedBadges,
    allBadges: Array.from(earnedBadgeIds),
  };
}

/**
 * Get badge progress for a user (how close they are to each badge)
 */
export function getBadgeProgress(
  stats: {
    total_tokens: number;
    total_cost: number;
    global_rank: number;
  },
  streak: number
): Record<string, { current: number; target: number; percent: number }> {
  const progress: Record<string, { current: number; target: number; percent: number }> = {};

  // Streak progress
  const streakTargets = [7, 14, 30, 60, 90, 180];
  for (const target of streakTargets) {
    if (streak < target) {
      progress[`streak_${target}`] = {
        current: streak,
        target,
        percent: Math.min(100, (streak / target) * 100),
      };
    }
  }

  // Token progress
  const tokenTargets = [
    { id: "first_million", target: 1_000_000 },
    { id: "hundred_million", target: 100_000_000 },
    { id: "billion_club", target: 1_000_000_000 },
    { id: "10b_club", target: 10_000_000_000 },
  ];
  for (const { id, target } of tokenTargets) {
    if (stats.total_tokens < target) {
      progress[id] = {
        current: stats.total_tokens,
        target,
        percent: Math.min(100, (stats.total_tokens / target) * 100),
      };
    }
  }

  // Cost progress
  const costTargets = [
    { id: "big_spender", target: 5000 },
    { id: "whale", target: 10000 },
  ];
  for (const { id, target } of costTargets) {
    if (stats.total_cost < target) {
      progress[id] = {
        current: stats.total_cost,
        target,
        percent: Math.min(100, (stats.total_cost / target) * 100),
      };
    }
  }

  // Rank progress
  const rankTargets = [
    { id: "top_50", target: 50 },
    { id: "top_3", target: 3 },
    { id: "global_first", target: 1 },
  ];
  for (const { id, target } of rankTargets) {
    if (stats.global_rank > target) {
      // For rank, lower is better
      progress[id] = {
        current: stats.global_rank,
        target,
        // Inverse progress for rank
        percent: Math.min(100, (target / stats.global_rank) * 100),
      };
    }
  }

  return progress;
}
