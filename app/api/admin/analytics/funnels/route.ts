import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface FunnelData {
  summary: {
    totalSignups: number;
    usersWithSubmit: number;
    signupToSubmitRate: number;
    activatedUsers: number;
    activationRate: number;
  };
  timeToFirstSubmit: {
    within1Hour: number;
    within24Hours: number;
    within7Days: number;
    over7Days: number;
    never: number;
  };
  dailyFunnel: Array<{
    date: string;
    signups: number;
    firstSubmits: number;
    conversionRate: number;
  }>;
  recentConversions: Array<{
    username: string;
    avatar_url: string | null;
    signed_up_at: string;
    first_submit_at: string;
    time_to_submit_hours: number;
  }>;
}

// Fallback: Get activated users count with raw SQL
async function getActivatedUsersCountFallback(): Promise<number> {
  const { data, error } = await supabase
    .from("usage_stats")
    .select("user_id")
    .then(async (result) => {
      if (result.error) throw result.error;
      // Count users with 2+ submissions
      const userCounts = new Map<string, number>();
      result.data?.forEach((row) => {
        const count = userCounts.get(row.user_id) || 0;
        userCounts.set(row.user_id, count + 1);
      });
      let activated = 0;
      userCounts.forEach((count) => {
        if (count >= 2) activated++;
      });
      return { data: activated, error: null };
    });

  return data || 0;
}

// Fallback: Get time to first submit distribution
async function getTimeDistributionFallback(): Promise<{
  within1Hour: number;
  within24Hours: number;
  within7Days: number;
  over7Days: number;
  never: number;
}> {
  // Get all users with their first submission time
  const { data: users } = await supabase
    .from("users")
    .select("id, created_at, last_submission_at")
    .is("deleted_at", null);

  const distribution = {
    within1Hour: 0,
    within24Hours: 0,
    within7Days: 0,
    over7Days: 0,
    never: 0,
  };

  if (!users) return distribution;

  for (const user of users) {
    if (!user.last_submission_at) {
      distribution.never++;
      continue;
    }

    const signedUp = new Date(user.created_at).getTime();
    const firstSubmit = new Date(user.last_submission_at).getTime();
    const diffHours = (firstSubmit - signedUp) / (1000 * 60 * 60);

    if (diffHours <= 1) {
      distribution.within1Hour++;
    } else if (diffHours <= 24) {
      distribution.within24Hours++;
    } else if (diffHours <= 168) {
      distribution.within7Days++;
    } else {
      distribution.over7Days++;
    }
  }

  return distribution;
}

// Fallback: Get daily funnel data
async function getDailyFunnelFallback(days: number): Promise<
  Array<{
    date: string;
    signups: number;
    firstSubmits: number;
    conversionRate: number;
  }>
> {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  // Get signups by date
  const { data: users } = await supabase
    .from("users")
    .select("created_at, last_submission_at")
    .gte("created_at", dateFrom.toISOString())
    .is("deleted_at", null);

  // Create date map
  const dailyData = new Map<string, { signups: number; firstSubmits: number }>();

  // Initialize all dates
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    dailyData.set(dateStr, { signups: 0, firstSubmits: 0 });
  }

  // Count signups and first submits
  if (users) {
    for (const user of users) {
      const signupDate = user.created_at.split("T")[0];
      const existing = dailyData.get(signupDate);
      if (existing) {
        existing.signups++;
        if (user.last_submission_at) {
          const submitDate = user.last_submission_at.split("T")[0];
          const submitExisting = dailyData.get(submitDate);
          if (submitExisting) {
            submitExisting.firstSubmits++;
          }
        }
      }
    }
  }

  // Convert to array and sort
  return Array.from(dailyData.entries())
    .map(([date, data]) => ({
      date,
      signups: data.signups,
      firstSubmits: data.firstSubmits,
      conversionRate: data.signups > 0 ? Math.round((data.firstSubmits / data.signups) * 100) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const dateFromStr = dateFrom.toISOString();

    // 1. 전체 사용자 수
    const { count: totalSignups } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    // 2. 제출 기록이 있는 사용자 수
    const { count: usersWithSubmit } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .not("last_submission_at", "is", null);

    // 3. 2회 이상 제출한 사용자 (활성화) - RPC with fallback
    let activatedUsers = 0;
    try {
      const { data: activatedData, error } = await supabase.rpc("get_activated_users_count");
      if (error) throw error;
      activatedUsers = activatedData || 0;
    } catch {
      activatedUsers = await getActivatedUsersCountFallback();
    }

    // 4. Time to First Submit 분포 - RPC with fallback
    let timeToFirstSubmit;
    try {
      const { data: timeDistribution, error } = await supabase.rpc(
        "get_time_to_first_submit_distribution"
      );
      if (error) throw error;
      timeToFirstSubmit = timeDistribution
        ? {
            within1Hour: timeDistribution.within_1_hour || 0,
            within24Hours: timeDistribution.within_24_hours || 0,
            within7Days: timeDistribution.within_7_days || 0,
            over7Days: timeDistribution.over_7_days || 0,
            never: timeDistribution.never || 0,
          }
        : await getTimeDistributionFallback();
    } catch {
      timeToFirstSubmit = await getTimeDistributionFallback();
    }

    // 5. 일별 가입 → 제출 추이 - RPC with fallback
    let dailyFunnel;
    try {
      const { data: dailyData, error } = await supabase.rpc("get_daily_funnel_data", {
        days_count: days,
      });
      if (error) throw error;
      dailyFunnel = (dailyData || []).map(
        (d: { date: string; signups: number; first_submits: number }) => ({
          date: d.date,
          signups: d.signups || 0,
          firstSubmits: d.first_submits || 0,
          conversionRate: d.signups > 0 ? Math.round((d.first_submits / d.signups) * 100) : 0,
        })
      );
    } catch {
      dailyFunnel = await getDailyFunnelFallback(days);
    }

    // 6. 최근 전환 사용자
    const { data: recentConversions } = await supabase
      .from("users")
      .select("username, avatar_url, created_at, last_submission_at")
      .is("deleted_at", null)
      .not("last_submission_at", "is", null)
      .gte("created_at", dateFromStr)
      .order("last_submission_at", { ascending: false })
      .limit(10);

    const signupToSubmitRate =
      totalSignups && totalSignups > 0
        ? Math.round(((usersWithSubmit || 0) / totalSignups) * 100)
        : 0;

    const activationRate =
      usersWithSubmit && usersWithSubmit > 0
        ? Math.round((activatedUsers / usersWithSubmit) * 100)
        : 0;

    // Recent conversions 변환
    const formattedConversions = (recentConversions || []).map((u) => {
      const signedUp = new Date(u.created_at);
      const firstSubmit = new Date(u.last_submission_at);
      const diffHours = Math.round((firstSubmit.getTime() - signedUp.getTime()) / (1000 * 60 * 60));
      return {
        username: u.username,
        avatar_url: u.avatar_url,
        signed_up_at: u.created_at,
        first_submit_at: u.last_submission_at,
        time_to_submit_hours: Math.max(0, diffHours),
      };
    });

    const response: FunnelData = {
      summary: {
        totalSignups: totalSignups || 0,
        usersWithSubmit: usersWithSubmit || 0,
        signupToSubmitRate,
        activatedUsers,
        activationRate,
      },
      timeToFirstSubmit,
      dailyFunnel,
      recentConversions: formattedConversions,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Funnels API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch funnel data" }, { status: 500 });
  }
}
