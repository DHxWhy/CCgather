import { createServiceClient } from "@/lib/supabase/server";

// Thresholds for showing stats vs early adopter message
export const GLOBAL_STATS_THRESHOLDS = {
  minUsers: 100,
  minCountries: 10,
  minTokens: 100_000_000_000, // 100B
};

export interface LiveActivity {
  tokens30d: number;
  countries30d: number;
  countries24h: number;
}

export interface GlobalStats {
  totalUsers: number;
  totalCountries: number;
  totalTokens: number;
  totalCost: number;
  showStats: boolean;
  activity?: LiveActivity;
}

const LIVE_ACTIVITY_FIELDS = [
  "developers",
  "countries",
  "tokens_all_time",
  "cost_all_time",
  "tokens_30d",
  "countries_30d",
  "countries_24h",
] as const;

type LiveActivityRow = Record<(typeof LIVE_ACTIVITY_FIELDS)[number], number>;

function readLiveActivityRow(data: unknown): LiveActivityRow | null {
  const row: unknown = Array.isArray(data) ? data[0] : data;
  if (typeof row !== "object" || row === null) return null;
  const read = {} as LiveActivityRow;
  for (const field of LIVE_ACTIVITY_FIELDS) {
    const value = Number((row as Record<string, unknown>)[field]);
    if (!Number.isFinite(value) || value < 0) return null;
    read[field] = value;
  }
  return read;
}

function withShowStats(totals: Omit<GlobalStats, "showStats">): GlobalStats {
  return {
    ...totals,
    showStats:
      totals.totalUsers >= GLOBAL_STATS_THRESHOLDS.minUsers &&
      totals.totalCountries >= GLOBAL_STATS_THRESHOLDS.minCountries &&
      totals.totalTokens >= GLOBAL_STATS_THRESHOLDS.minTokens,
  };
}

// 가입 기준으로 센다. 제출(total_tokens > 0)로 좁히면 랜딩이 커뮤니티
// 규모를 실제보다 훨씬 작게 보여준다(2026-07 기준 143명 vs 82명, 22개국 vs 16개국).
// 토큰·비용 합계는 미제출자가 0 이라 기준을 넓혀도 값이 변하지 않는다.
// 회원 행을 받아 더하므로 1,000명을 넘으면 잘린다 — get_live_activity 가 없을 때만 쓴다.
async function countFromRows(supabase: ReturnType<typeof createServiceClient>) {
  const [countResult, aggregateResult] = await Promise.all([
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("onboarding_completed", true)
      .is("deleted_at", null)
      .eq("shadow_banned", false),
    supabase
      .from("users")
      .select("country_code, total_tokens, total_cost")
      .eq("onboarding_completed", true)
      .is("deleted_at", null)
      .eq("shadow_banned", false),
  ]);

  const aggregateData = aggregateResult.data;

  const uniqueCountries = new Set(
    aggregateData
      ?.filter((u: { country_code: string | null }) => u.country_code !== null)
      .map((u: { country_code: string }) => u.country_code) || []
  );

  const totalTokens =
    aggregateData?.reduce(
      (sum: number, u: { total_tokens: number | null }) => sum + (u.total_tokens || 0),
      0
    ) || 0;
  const totalCost =
    aggregateData?.reduce(
      (sum: number, u: { total_cost: number | null }) => sum + (u.total_cost || 0),
      0
    ) || 0;

  return withShowStats({
    totalUsers: countResult.count || 0,
    totalCountries: uniqueCountries.size,
    totalTokens,
    totalCost,
  });
}

/**
 * Fetch global stats from Supabase.
 * This can be called from Server Components for SSR.
 */
export async function getGlobalStats(): Promise<GlobalStats> {
  try {
    const supabase = createServiceClient();

    // 같은 회원 기준을 DB 안에서 센다(마이그 084). 실패하면 행을 세는 옛 방식으로.
    const { data, error } = await supabase.rpc("get_live_activity");
    const row = error ? null : readLiveActivityRow(data);
    if (row) {
      return withShowStats({
        totalUsers: row.developers,
        totalCountries: row.countries,
        totalTokens: row.tokens_all_time,
        totalCost: row.cost_all_time,
        activity: {
          tokens30d: row.tokens_30d,
          countries30d: row.countries_30d,
          countries24h: row.countries_24h,
        },
      });
    }
    console.error(
      "[global-stats] get_live_activity unavailable, counting member rows instead:",
      error?.message ?? "unexpected row"
    );
    return await countFromRows(supabase);
  } catch (error) {
    console.error("Failed to fetch global stats:", error);
    return {
      totalUsers: 0,
      totalCountries: 0,
      totalTokens: 0,
      totalCost: 0,
      showStats: false,
    };
  }
}
