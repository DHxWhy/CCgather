import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CCPLAN_CONFIG,
  LEVEL_LEAGUE_CONFIG,
  type CCPlanFilter,
  type LevelLeagueFilter,
} from "@/lib/types/leaderboard";

type Period = "today" | "7d" | "30d" | "all";

function getPeriodDateRange(period: Period): { startDate: string; endDate: string } | null {
  if (period === "all") return null;

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
  // V2.0: level_league is the primary filter for ranking
  const levelLeague = (searchParams.get("level_league") || "all") as LevelLeagueFilter;
  // ccplan is kept for backward compatibility but now only used for badge display
  const ccplan = (searchParams.get("ccplan") || "all") as CCPlanFilter;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = (page - 1) * limit;
  const findUser = searchParams.get("findUser") || null; // Username to find

  const supabase = await createClient();
  const dateRange = getPeriodDateRange(period);

  // If findUser is provided, return the user's rank info
  if (findUser && !dateRange) {
    let rankQuery = supabase
      .from("users")
      .select(
        "id, username, global_rank, country_rank, country_code, ccplan_rank, level_league, level_league_rank"
      )
      .eq("onboarding_completed", true)
      .gt("total_tokens", 0)
      .ilike("username", findUser)
      .single();

    const { data: foundUser, error: findError } = await rankQuery;

    if (findError || !foundUser) {
      return NextResponse.json({ found: false });
    }

    // Get the appropriate rank based on filters
    // V2.0: level_league is primary, ccplan is secondary (backward compat)
    let rank = foundUser.global_rank;
    if (levelLeague !== "all") {
      rank = foundUser.level_league_rank;
    } else if (ccplan !== "all") {
      rank = foundUser.ccplan_rank;
    } else if (country) {
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
        level_league: foundUser.level_league,
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
        ccplan_rank,
        level_league,
        level_league_rank,
        has_opus_usage,
        social_links
      `,
        { count: "exact" }
      )
      .eq("onboarding_completed", true)
      .gt("total_tokens", 0); // Only show users who have submitted usage data

    // V2.0: Apply level_league filter (primary)
    if (levelLeague !== "all") {
      query = query.eq("level_league", levelLeague);
    }

    // Apply ccplan filter (backward compatibility, for badge filtering)
    if (ccplan !== "all") {
      query = query.eq("ccplan", ccplan);
    }

    if (country) {
      query = query.eq("country_code", country.toUpperCase());
    }

    // Always order by total_tokens for consistent real-time ranking
    // This ensures accurate ranking across all filter combinations:
    // - Global: all users sorted by tokens
    // - Country: filtered users sorted by tokens
    // - Level League: filtered users sorted by tokens
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

    // V2.0: Build level_league_info if filtering by specific league
    const levelLeagueInfo =
      levelLeague !== "all"
        ? {
            name: LEVEL_LEAGUE_CONFIG[levelLeague].name,
            icon: LEVEL_LEAGUE_CONFIG[levelLeague].icon,
            levels: LEVEL_LEAGUE_CONFIG[levelLeague].levels,
            total_users: count || 0,
          }
        : undefined;

    // Build ccplan_info if filtering by specific tier (backward compat)
    const ccplanInfo =
      ccplan !== "all"
        ? {
            name: CCPLAN_CONFIG[ccplan].name,
            icon: CCPLAN_CONFIG[ccplan].icon,
            total_users: count || 0,
          }
        : undefined;

    return NextResponse.json({
      users: users || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      period,
      level_league: levelLeague,
      level_league_info: levelLeagueInfo,
      ccplan,
      ccplan_info: ccplanInfo,
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
      level_league: levelLeague,
      ccplan,
    });
  }

  // Fetch user details (always include total_tokens for level calculation)
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
      ccplan_rank,
      level_league,
      level_league_rank,
      has_opus_usage,
      social_links
    `
    )
    .in("id", userIds)
    .eq("onboarding_completed", true);

  // V2.0: Apply level_league filter (primary)
  if (levelLeague !== "all") {
    usersQuery = usersQuery.eq("level_league", levelLeague);
  }

  // Apply ccplan filter (backward compatibility)
  if (ccplan !== "all") {
    usersQuery = usersQuery.eq("ccplan", ccplan);
  }

  if (country) {
    usersQuery = usersQuery.eq("country_code", country.toUpperCase());
  }

  const { data: usersData, error: usersError } = await usersQuery;

  if (usersError) {
    console.error("Users query error:", usersError);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  // Combine user data with period aggregates and sort
  // Secondary sort by created_at for deterministic ordering of tied users
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
      // Secondary: earlier signup wins (created_at not available here, use id as proxy)
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

  // V2.0: Build level_league_info if filtering by specific league
  const levelLeagueInfo =
    levelLeague !== "all"
      ? {
          name: LEVEL_LEAGUE_CONFIG[levelLeague].name,
          icon: LEVEL_LEAGUE_CONFIG[levelLeague].icon,
          levels: LEVEL_LEAGUE_CONFIG[levelLeague].levels,
          total_users: total,
        }
      : undefined;

  // Build ccplan_info if filtering by specific tier (backward compat)
  const ccplanInfo =
    ccplan !== "all"
      ? {
          name: CCPLAN_CONFIG[ccplan].name,
          icon: CCPLAN_CONFIG[ccplan].icon,
          total_users: total,
        }
      : undefined;

  return NextResponse.json({
    users: paginatedUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    period,
    level_league: levelLeague,
    level_league_info: levelLeagueInfo,
    ccplan,
    ccplan_info: ccplanInfo,
  });
}
