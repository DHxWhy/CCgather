import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Thresholds for showing stats vs early adopter message
// All three must be met to show stats
const THRESHOLDS = {
  minUsers: 100,
  minCountries: 10,
  minTokens: 100_000_000_000, // 100B
};

export async function GET() {
  const supabase = await createClient();

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

  const uniqueCountries = new Set(countriesData?.map((u) => u.country_code) || []);
  const totalCountries = uniqueCountries.size;

  // Get total tokens and cost
  const { data: aggregateData } = await supabase
    .from("users")
    .select("total_tokens, total_cost")
    .eq("onboarding_completed", true)
    .gt("total_tokens", 0);

  const totalTokens = aggregateData?.reduce((sum, u) => sum + (u.total_tokens || 0), 0) || 0;
  const totalCost = aggregateData?.reduce((sum, u) => sum + (u.total_cost || 0), 0) || 0;

  // Determine if we should show stats or early adopter message
  // All three conditions must be met
  const showStats =
    (totalUsers || 0) >= THRESHOLDS.minUsers &&
    totalCountries >= THRESHOLDS.minCountries &&
    totalTokens >= THRESHOLDS.minTokens;

  return NextResponse.json(
    {
      totalUsers: totalUsers || 0,
      totalCountries,
      totalTokens,
      totalCost,
      showStats,
      thresholds: THRESHOLDS,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    }
  );
}
