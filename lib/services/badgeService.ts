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

const MODEL_FAMILIES = ["opus", "sonnet", "haiku", "fable"] as const;
type ModelFamily = (typeof MODEL_FAMILIES)[number];

/** primary_model 문자열 → 모델군. mythos 는 fable 계열의 상위 이름이라 같은 군으로 묶는다. */
function modelFamilyOf(model: string | null): ModelFamily | null {
  const m = (model || "").toLowerCase();
  if (m.includes("opus")) return "opus";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("haiku")) return "haiku";
  if (m.includes("fable") || m.includes("mythos")) return "fable";
  return null;
}

/** Supabase 는 응답당 1000행에서 잘리므로 커서 페이지네이션으로 전량을 읽는다. */
async function fetchAllUsageRows(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<Array<{ date: string; total_tokens: number | null; primary_model: string | null }>> {
  const PAGE = 1000;
  const rows: Array<{ date: string; total_tokens: number | null; primary_model: string | null }> =
    [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("usage_stats")
      .select("date, total_tokens, primary_model")
      .eq("user_id", userId)
      .order("date", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[BadgeService] usage_stats fetch failed:", error);
      break;
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

/** DB 이력과 제출 payload 를 날짜 기준으로 합친다 — 아직 저장되지 않은 오늘치를 잃지 않기 위해. */
function mergeUsageHistory(fromDb: UsageDay[], fromPayload?: UsageDay[]): UsageDay[] {
  if (!fromPayload || fromPayload.length === 0) return fromDb;
  const byDate = new Map<string, number>();
  for (const d of fromDb) byDate.set(d.date, d.tokens);
  for (const d of fromPayload) byDate.set(d.date, Math.max(byDate.get(d.date) ?? 0, d.tokens));
  return Array.from(byDate, ([date, tokens]) => ({ date, tokens }));
}

/**
 * Build BadgeContext from user data
 */
async function buildBadgeContext(
  userId: string,
  stats: {
    total_tokens: number;
    total_cost: number;
    total_sessions?: number;
    global_rank: number;
    country_rank?: number;
    country_code?: string;
    referral_count?: number;
    auto_sync_enabled?: boolean;
    github_starred?: boolean;
  },
  usageHistory?: UsageDay[]
): Promise<BadgeContext> {
  const supabase = createServiceClient();

  // Referral count: prefer caller-provided, else compute here. Computing inside
  // buildBadgeContext guarantees community badges work from ANY entry point.
  let referralCount = stats.referral_count;
  if (referralCount === undefined) {
    const { count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("referred_by", userId)
      .is("deleted_at", null);
    referralCount = count ?? 0;
  }

  // 사용량 전체 이력: 스트릭·모델군 집계의 단일 출처.
  // 제출 payload(usageHistory)만 쓰면 CLI 가 보낸 일수 밖의 스트릭을 판정할 수 없어
  // 60·90·150일 배지가 영원히 발급되지 않는다.
  const usageRows = await fetchAllUsageRows(supabase, userId);
  const historyFromDb: UsageDay[] = usageRows.map((r) => ({
    date: r.date,
    tokens: r.total_tokens ?? 0,
  }));
  const mergedHistory = mergeUsageHistory(historyFromDb, usageHistory);
  const streak = calculateStreak(mergedHistory);

  // Check if user is top 10 earliest from their country (for trailblazer badge)
  let isEarlyCountryUser = false;
  let countryUserCount: number | undefined;
  if (stats.country_code) {
    const { data: earlyUsers } = await supabase
      .from("users")
      .select("id")
      .eq("country_code", stats.country_code)
      .order("created_at", { ascending: true })
      .limit(10);
    isEarlyCountryUser = earlyUsers?.some((u: { id: string }) => u.id === userId) || false;

    // 국가 순위 배지는 회원 3명 이상인 국가에서만 의미가 있다(1명뿐인 국가의 자동 획득 방지)
    const { count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("country_code", stats.country_code)
      .is("deleted_at", null)
      .eq("shadow_banned", false);
    countryUserCount = count ?? undefined;
  }

  // 모델군 집계 (소급 근사): usage_stats 는 per-model 분해를 저장하지 않고
  // primary_model(그날 최다 토큰 모델) 1개만 저장하므로 "그날 전체 토큰 = 주 모델 100%" 로 근사한다.
  const familyTokens: Record<ModelFamily, number> = { opus: 0, sonnet: 0, haiku: 0, fable: 0 };
  let familyTotal = 0;
  let haikuPrimaryDays = 0;
  for (const row of usageRows) {
    const family = modelFamilyOf(row.primary_model);
    const tokens = row.total_tokens ?? 0;
    familyTotal += tokens;
    if (!family) continue;
    familyTokens[family] += tokens;
    if (family === "haiku" && tokens > 0) haikuPrimaryDays++;
  }
  const modelUsage =
    familyTotal > 0
      ? {
          opus: (familyTokens.opus / familyTotal) * 100,
          sonnet: (familyTokens.sonnet / familyTotal) * 100,
          haiku: (familyTokens.haiku / familyTotal) * 100,
          fable: (familyTokens.fable / familyTotal) * 100,
        }
      : undefined;

  return {
    total_tokens: stats.total_tokens,
    total_cost: stats.total_cost,
    total_sessions: stats.total_sessions ?? 0,
    global_rank: stats.global_rank,
    country_rank: stats.country_rank,
    country_code: stats.country_code,
    country_user_count: countryUserCount,
    referral_count: referralCount,
    streak,
    is_early_country_user: isEarlyCountryUser,
    model_usage: modelUsage,
    model_tokens: familyTotal > 0 ? { ...familyTokens } : undefined,
    haiku_primary_days: haikuPrimaryDays,
    auto_sync_enabled: stats.auto_sync_enabled,
    github_starred: stats.github_starred,
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
    total_sessions?: number;
    global_rank: number;
    country_rank?: number;
    country_code?: string;
    referral_count?: number;
    auto_sync_enabled?: boolean;
    github_starred?: boolean;
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
