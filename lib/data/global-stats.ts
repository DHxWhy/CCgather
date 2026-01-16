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

    // Get total users with usage data
    const { count: totalUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("onboarding_completed", true)
      .gt("total_tokens", 0);

    // Get unique countries
    const { data: countriesData } = await supabase
      .from("users")
      .select("country_code")
      .eq("onboarding_completed", true)
      .gt("total_tokens", 0)
      .not("country_code", "is", null);

    const uniqueCountries = new Set(
      countriesData?.map((u: { country_code: string }) => u.country_code) || []
    );
    const totalCountries = uniqueCountries.size;

    // Get total tokens and cost
    const { data: aggregateData } = await supabase
      .from("users")
      .select("total_tokens, total_cost")
      .eq("onboarding_completed", true)
      .gt("total_tokens", 0);

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
