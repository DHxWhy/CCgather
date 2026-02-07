import { createServiceClient } from "@/lib/supabase/server";

// Thresholds for showing stats vs early adopter message
const THRESHOLDS = {
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

    // Parallel queries: count + (countries, tokens, cost combined)
    const [countResult, aggregateResult] = await Promise.all([
      // Query 1: total user count
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("onboarding_completed", true)
        .gt("total_tokens", 0),
      // Query 2: countries + tokens + cost in a single query
      supabase
        .from("users")
        .select("country_code, total_tokens, total_cost")
        .eq("onboarding_completed", true)
        .gt("total_tokens", 0),
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
      (totalUsers || 0) >= THRESHOLDS.minUsers &&
      totalCountries >= THRESHOLDS.minCountries &&
      totalTokens >= THRESHOLDS.minTokens;

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
