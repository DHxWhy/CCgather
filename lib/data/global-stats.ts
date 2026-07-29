import { createServiceClient } from "@/lib/supabase/server";

// Thresholds for showing stats vs early adopter message
export const GLOBAL_STATS_THRESHOLDS = {
  minUsers: 100,
  minCountries: 10,
  minTokens: 100_000_000_000, // 100B
};

export interface GlobalStats {
  totalUsers: number;
  totalCountries: number;
  totalTokens: number;
  totalCost: number;
  showStats: boolean;
}

/**
 * Fetch global stats from Supabase.
 * This can be called from Server Components for SSR.
 */
export async function getGlobalStats(): Promise<GlobalStats> {
  try {
    const supabase = createServiceClient();

    // 가입 기준으로 센다. 제출(total_tokens > 0)로 좁히면 랜딩이 커뮤니티
    // 규모를 실제보다 훨씬 작게 보여준다(2026-07 기준 143명 vs 82명, 22개국 vs 16개국).
    // 토큰·비용 합계는 미제출자가 0 이라 기준을 넓혀도 값이 변하지 않는다.
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

    const totalUsers = countResult.count;

    const aggregateData = aggregateResult.data;

    const uniqueCountries = new Set(
      aggregateData
        ?.filter((u: { country_code: string | null }) => u.country_code !== null)
        .map((u: { country_code: string }) => u.country_code) || []
    );
    const totalCountries = uniqueCountries.size;

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

    // Determine if we should show stats or early adopter message
    const showStats =
      (totalUsers || 0) >= GLOBAL_STATS_THRESHOLDS.minUsers &&
      totalCountries >= GLOBAL_STATS_THRESHOLDS.minCountries &&
      totalTokens >= GLOBAL_STATS_THRESHOLDS.minTokens;

    return {
      totalUsers: totalUsers || 0,
      totalCountries,
      totalTokens,
      totalCost,
      showStats,
    };
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
