import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aggregateByDate } from "@/lib/utils/usage-aggregation";

/**
 * Usage Summary API - Central data source for all usage-related UI components
 *
 * Provides:
 * - Daily usage history (tokens, cost) for charts and heatmaps
 * - Aggregated totals (total tokens, total cost, total sessions)
 * - Calculated averages (daily avg)
 * - Streak information (current streak, longest streak)
 *
 * Used by:
 * - ProfileSidePanel (heatmap, chart, stats)
 * - Settings/Usage page (heatmap, stats)
 * - Any component needing usage data
 *
 * Caching: 5 minutes TTL via Cache-Control header
 */

interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
}

interface UsageSummary {
  daily: DailyUsage[];
  totals: {
    tokens: number;
    cost: number;
    sessions: number;
  };
  averages: {
    dailyTokens: number;
    dailyCost: number;
  };
  streaks: {
    current: number;
    longest: number;
  };
}

// Calculate streak information from daily usage data
function calculateStreaks(dailyData: DailyUsage[]): { current: number; longest: number } {
  if (dailyData.length === 0) {
    return { current: 0, longest: 0 };
  }

  // Create a set of dates with activity
  const activeDates = new Set(dailyData.filter((d) => d.tokens > 0).map((d) => d.date));

  if (activeDates.size === 0) {
    return { current: 0, longest: 0 };
  }

  // Calculate current streak (counting backwards from today)
  let currentStreak = 0;
  const today = new Date();
  const checkDate = new Date(today);

  while (true) {
    const dateStr = checkDate.toISOString().split("T")[0] as string;
    if (activeDates.has(dateStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate longest streak
  const sortedDates = Array.from(activeDates).sort();
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1] as string);
    const currDate = new Date(sortedDates[i] as string);
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return { current: currentStreak, longest: longestStreak };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") || "365", 10);

  const supabase = await createClient();

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Fetch usage history from usage_stats table
  const { data: usageData, error: usageError } = await supabase
    .from("usage_stats")
    .select("date, total_tokens, cost_usd")
    .eq("user_id", id)
    .gte("date", startDate.toISOString().split("T")[0])
    .lte("date", endDate.toISOString().split("T")[0])
    .order("date", { ascending: true });

  if (usageError) {
    console.error("[Usage Summary] Query error:", usageError);
    return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
  }

  // Fetch user totals (these are pre-calculated in users table)
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("total_tokens, total_cost, total_sessions")
    .eq("id", id)
    .single();

  if (userError || !user) {
    console.error("[Usage Summary] User not found:", userError);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Aggregate by date: SUM tokens/cost across devices for the same date
  const daily: DailyUsage[] = aggregateByDate(
    usageData,
    (d) => d.date,
    (d) => d.total_tokens || 0,
    (d) => d.cost_usd || 0
  );

  // Calculate averages from daily data
  const totalDailyTokens = daily.reduce((sum, d) => sum + d.tokens, 0);
  const totalDailyCost = daily.reduce((sum, d) => sum + d.cost, 0);
  const activeDaysCount = daily.filter((d) => d.tokens > 0).length;

  const averages = {
    dailyTokens: activeDaysCount > 0 ? Math.round(totalDailyTokens / activeDaysCount) : 0,
    dailyCost: activeDaysCount > 0 ? totalDailyCost / activeDaysCount : 0,
  };

  // Calculate streaks
  const streaks = calculateStreaks(daily);

  // Build response
  const summary: UsageSummary = {
    daily,
    totals: {
      tokens: user.total_tokens || 0,
      cost: user.total_cost || 0,
      sessions: user.total_sessions || 0,
    },
    averages,
    streaks,
  };

  // Return with cache headers (5 minutes)
  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
