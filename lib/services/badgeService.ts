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

  // Referral count: prefer caller-provided, else compute here. Computing inside
  // buildBadgeContext guarantees social badges work from ANY entry point — the
  // CLI submit path (the only badge-award caller) does not pass referral_count,
  // so without this, social badges would never trigger. Excludes soft-deleted
  // referees to match the badge wording "friends who joined".
  let referralCount = stats.referral_count;
  if (referralCount === undefined) {
    const { count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("referred_by", userId)
      .is("deleted_at", null);
    referralCount = count ?? 0;
  }

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

  // model_usage 계산 (ⓑ 소급 근사, 2026-05-29):
  // usage_stats 는 per-model 토큰 분해를 저장하지 않고 primary_model(그날 최다
  // 토큰 모델) 1개만 저장한다. 따라서 "그날 전체 토큰 = primary_model 100%" 로
  // 근사해 모델 family 별 비중(%)을 집계한다. 70% 임계 배지엔 충분히 합리적.
  // 정밀 per-model 분해는 Phase D(model_breakdown 컬럼)에서 별도 정밀화 예정.
  let modelUsage: { opus: number; sonnet: number; haiku: number } | undefined;
  const { data: modelRows } = await supabase
    .from("usage_stats")
    .select("primary_model, total_tokens")
    .eq("user_id", userId)
    .not("primary_model", "is", null);

  if (modelRows && modelRows.length > 0) {
    let opus = 0;
    let sonnet = 0;
    let haiku = 0;
    let total = 0;
    for (const row of modelRows as {
      primary_model: string | null;
      total_tokens: number | null;
    }[]) {
      const model = (row.primary_model || "").toLowerCase();
      const tokens = row.total_tokens || 0;
      total += tokens;
      // 우선순위 매칭: opus > sonnet > haiku (한 모델명에 하나만 해당)
      if (model.includes("opus")) opus += tokens;
      else if (model.includes("sonnet")) sonnet += tokens;
      else if (model.includes("haiku")) haiku += tokens;
    }
    if (total > 0) {
      modelUsage = {
        opus: (opus / total) * 100,
        sonnet: (sonnet / total) * 100,
        haiku: (haiku / total) * 100,
      };
    }
  }

  return {
    total_tokens: stats.total_tokens,
    total_cost: stats.total_cost,
    global_rank: stats.global_rank,
    country_rank: stats.country_rank,
    country_code: stats.country_code,
    referral_count: referralCount,
    streak,
    is_early_country_user: isEarlyCountryUser,
    model_usage: modelUsage,
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
