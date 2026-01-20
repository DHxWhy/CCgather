import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Period = "today" | "7d" | "30d" | "all" | "custom";

function getPeriodDateRange(
  period: Period,
  customStart?: string | null,
  customEnd?: string | null
): { startDate: string; endDate: string } | null {
  if (period === "all") return null;

  // Custom date range
  if (period === "custom" && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }

  const now = new Date();
  const endDate = now.toISOString().split("T")[0] ?? "";

  let startDate: string;

  switch (period) {
    case "today":
      startDate = endDate;
      break;
    case "7d": {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString().split("T")[0] ?? "";
      break;
    }
    case "30d": {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      startDate = monthAgo.toISOString().split("T")[0] ?? "";
      break;
    }
    default:
      return null;
  }

  return { startDate, endDate };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const period = (searchParams.get("period") || "all") as Period;
  const country = searchParams.get("country") || null;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = (page - 1) * limit;
  const findUser = searchParams.get("findUser") || null;
  // Custom date range parameters
  const customStart = searchParams.get("startDate");
  const customEnd = searchParams.get("endDate");

  const supabase = await createClient();
  const dateRange = getPeriodDateRange(period, customStart, customEnd);

  // If findUser is provided, return the user's rank info
  if (findUser && !dateRange) {
    const rankQuery = supabase
      .from("users")
      .select("id, username, global_rank, country_rank, country_code")
      .eq("onboarding_completed", true)
      .gt("total_tokens", 0)
      .ilike("username", findUser)
      .single();

    const { data: foundUser, error: findError } = await rankQuery;

    if (findError || !foundUser) {
      return NextResponse.json({ found: false });
    }

    // Get the appropriate rank based on filters
    let rank = foundUser.global_rank;
    if (country) {
      rank = foundUser.country_rank;
    }

    const userPage = Math.ceil((rank || 1) / limit);

    return NextResponse.json({
      found: true,
      user: {
        id: foundUser.id,
        username: foundUser.username,
        rank,
        page: userPage,
      },
    });
  }

  // If period is 'all', use existing simple query
  if (!dateRange) {
    let query = supabase
      .from("users")
      .select(
        `
        id,
        username,
        display_name,
        avatar_url,
        country_code,
        current_level,
        global_rank,
        country_rank,
        total_tokens,
        total_cost,
        ccplan,
        has_opus_usage,
        social_links
      `,
        { count: "exact" }
      )
      .eq("onboarding_completed", true)
      .gt("total_tokens", 0);

    if (country) {
      query = query.eq("country_code", country.toUpperCase());
    }

    // Order by total_tokens for consistent ranking
    // Secondary sort by created_at for deterministic ordering of tied users
    query = query
      .order("total_tokens", { ascending: false })
      .order("created_at", { ascending: true });

    query = query.range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) {
      console.error("Leaderboard query error:", error);
      return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
    }

    return NextResponse.json({
      users: users || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      period,
    });
  }

  // For period-based queries, aggregate from usage_stats
  const { startDate, endDate } = dateRange;

  // First, get aggregated usage for the period
  const { data: periodStats, error: statsError } = await supabase
    .from("usage_stats")
    .select("user_id, total_tokens, cost_usd")
    .gte("date", startDate)
    .lte("date", endDate);

  if (statsError) {
    console.error("Usage stats query error:", statsError);
    return NextResponse.json({ error: "Failed to fetch usage stats" }, { status: 500 });
  }

  // Aggregate by user
  const userAggregates = new Map<string, { tokens: number; cost: number }>();
  for (const stat of periodStats || []) {
    const existing = userAggregates.get(stat.user_id) || { tokens: 0, cost: 0 };
    existing.tokens += stat.total_tokens || 0;
    existing.cost += stat.cost_usd || 0;
    userAggregates.set(stat.user_id, existing);
  }

  // Get user IDs with usage in this period
  const userIds = Array.from(userAggregates.keys());

  if (userIds.length === 0) {
    return NextResponse.json({
      users: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
      period,
    });
  }

  // Fetch user details
  let usersQuery = supabase
    .from("users")
    .select(
      `
      id,
      username,
      display_name,
      avatar_url,
      country_code,
      current_level,
      total_tokens,
      total_cost,
      ccplan,
      has_opus_usage,
      social_links
    `
    )
    .in("id", userIds)
    .eq("onboarding_completed", true);

  if (country) {
    usersQuery = usersQuery.eq("country_code", country.toUpperCase());
  }

  const { data: usersData, error: usersError } = await usersQuery;

  if (usersError) {
    console.error("Users query error:", usersError);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  // Combine user data with period aggregates and sort
  const combinedUsers = (usersData || [])
    .map((user) => {
      const aggregate = userAggregates.get(user.id) || { tokens: 0, cost: 0 };
      return {
        ...user,
        period_tokens: aggregate.tokens,
        period_cost: aggregate.cost,
      };
    })
    .sort((a, b) => {
      // Primary: tokens descending
      if (b.period_tokens !== a.period_tokens) {
        return b.period_tokens - a.period_tokens;
      }
      // Secondary: use id as proxy for deterministic ordering
      return a.id.localeCompare(b.id);
    });

  // Calculate period ranks
  const rankedUsers = combinedUsers.map((user, index) => ({
    ...user,
    period_rank: index + 1,
  }));

  // Paginate
  const total = rankedUsers.length;
  const paginatedUsers = rankedUsers.slice(offset, offset + limit);

  return NextResponse.json({
    users: paginatedUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    period,
  });
}
