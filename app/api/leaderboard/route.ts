import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatInTimeZone } from "date-fns-tz";
import { subDays } from "date-fns";

type Period = "today" | "7d" | "30d" | "all" | "custom";

/**
 * Get date range for period filter, respecting user's timezone
 * - Handles DST automatically via date-fns-tz
 * - Falls back to UTC if invalid timezone
 */
function getPeriodDateRange(
  period: Period,
  customStart?: string | null,
  customEnd?: string | null,
  timezone?: string | null
): { startDate: string; endDate: string } | null {
  if (period === "all") return null;

  // Custom date range (already in user's intended dates)
  if (period === "custom" && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }

  // Validate and use timezone, fallback to UTC
  const tz = timezone || "UTC";
  const now = new Date();

  let endDate: string;
  let startDate: string;

  try {
    // Get today's date in user's timezone (handles DST)
    endDate = formatInTimeZone(now, tz, "yyyy-MM-dd");

    switch (period) {
      case "today":
        startDate = endDate;
        break;
      case "7d":
        startDate = formatInTimeZone(subDays(now, 7), tz, "yyyy-MM-dd");
        break;
      case "30d":
        startDate = formatInTimeZone(subDays(now, 30), tz, "yyyy-MM-dd");
        break;
      default:
        return null;
    }
  } catch {
    // Invalid timezone - fall back to UTC
    endDate = formatInTimeZone(now, "UTC", "yyyy-MM-dd");
    switch (period) {
      case "today":
        startDate = endDate;
        break;
      case "7d":
        startDate = formatInTimeZone(subDays(now, 7), "UTC", "yyyy-MM-dd");
        break;
      case "30d":
        startDate = formatInTimeZone(subDays(now, 30), "UTC", "yyyy-MM-dd");
        break;
      default:
        return null;
    }
  }

  return { startDate, endDate };
}

// ============ TEST MOCK DATA FLAG ============
const USE_MOCK_DATA = false; // Set to true for testing with mock data
const MOCK_TOTAL_USERS = 1600; // For testing bidirectional scroll

// Generate mock users for testing
function generateMockUsers(page: number, limit: number, total: number) {
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, total);
  const users = [];

  const countries = ["KR", "US", "JP", "DE", "GB", "FR", "CA", "AU", "BR", "IN"];
  const levels = [1, 2, 3, 4, 5, 6];

  for (let i = startIndex; i < endIndex; i++) {
    const rank = i + 1;
    const tokens = Math.floor(10000000000 / (rank * 0.8 + 1)); // Decreasing tokens
    const cost = tokens * 0.000003;

    users.push({
      id: `mock-user-${rank}`,
      username: `testuser${rank}`,
      display_name: `Test User ${rank}`,
      avatar_url: null,
      country_code: countries[i % countries.length],
      current_level: levels[Math.min(Math.floor(6 - rank / 30), 5)],
      global_rank: rank,
      country_rank: Math.floor(rank / 10) + 1,
      total_tokens: tokens,
      total_cost: cost,
      total_sessions: Math.floor(100 - rank / 2),
      ccplan: rank <= 10 ? "max" : "pro",
      has_opus_usage: rank <= 20,
      social_links: null,
    });
  }

  return users;
}
// ============ END TEST MOCK DATA ============

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
  // User's timezone (e.g., "Asia/Seoul", "America/Los_Angeles")
  const timezone = searchParams.get("tz");

  // ============ TEST: Return mock data ============
  if (USE_MOCK_DATA) {
    // Handle findUser for mock data
    if (findUser) {
      const match = findUser.match(/testuser(\d+)/i);
      if (match && match[1]) {
        const rank = parseInt(match[1], 10);
        const userPage = Math.ceil(rank / limit);
        return NextResponse.json({
          found: true,
          user: { id: `mock-user-${rank}`, username: `testuser${rank}`, rank, page: userPage },
        });
      }
      return NextResponse.json({ found: false });
    }

    // Handle findCurrentUserId for mock data
    const findCurrentUserId = searchParams.get("findCurrentUserId");
    if (findCurrentUserId) {
      // Mock: assume current user is at rank 75 (page 2 with limit 50)
      const rank = 75;
      const userPage = Math.ceil(rank / limit);
      return NextResponse.json({
        found: true,
        currentUser: {
          rank,
          page: userPage,
          total: MOCK_TOTAL_USERS,
          totalPages: Math.ceil(MOCK_TOTAL_USERS / limit),
        },
      });
    }

    // Return paginated mock users
    const mockUsers = generateMockUsers(page, limit, MOCK_TOTAL_USERS);
    return NextResponse.json({
      users: mockUsers,
      pagination: {
        page,
        limit,
        total: MOCK_TOTAL_USERS,
        totalPages: Math.ceil(MOCK_TOTAL_USERS / limit),
      },
      period,
    });
  }
  // ============ END TEST ============

  const supabase = await createClient();
  const dateRange = getPeriodDateRange(period, customStart, customEnd, timezone);

  // If findUser is provided, return the user's rank info
  if (findUser && !dateRange) {
    const rankQuery = supabase
      .from("users")
      .select("id, username, global_rank, country_rank, country_code")
      .eq("onboarding_completed", true)
      .is("deleted_at", null)
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

  // Find current user's position (for direct jump feature)
  const findCurrentUserId = searchParams.get("findCurrentUserId") || null;
  if (findCurrentUserId && !dateRange) {
    // Get total count first
    const { count: totalCount } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("onboarding_completed", true)
      .is("deleted_at", null)
      .gt("total_tokens", 0);

    // Find user's rank by counting users with more tokens
    let rankQuery = supabase
      .from("users")
      .select("total_tokens")
      .eq("id", findCurrentUserId)
      .single();

    const { data: currentUserData } = await rankQuery;

    if (!currentUserData) {
      return NextResponse.json({ found: false });
    }

    // Count users with more tokens (their rank - 1 = users ahead)
    let countQuery = supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("onboarding_completed", true)
      .is("deleted_at", null)
      .gt("total_tokens", currentUserData.total_tokens);

    if (country) {
      countQuery = countQuery.eq("country_code", country.toUpperCase());
    }

    const { count: usersAhead } = await countQuery;
    const rank = (usersAhead || 0) + 1;
    const userPage = Math.ceil(rank / limit);

    return NextResponse.json({
      found: true,
      currentUser: {
        rank,
        page: userPage,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
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
        total_sessions,
        ccplan,
        has_opus_usage,
        social_links
      `,
        { count: "exact" }
      )
      .eq("onboarding_completed", true)
      .is("deleted_at", null)
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

    // Fetch post counts for users
    const userIds = (users || []).map((u) => u.id);
    let usersWithPostCount = users || [];

    if (userIds.length > 0) {
      const { data: postCounts } = await supabase
        .from("posts")
        .select("author_id")
        .in("author_id", userIds)
        .is("deleted_at", null);

      if (postCounts) {
        const countMap = new Map<string, number>();
        for (const post of postCounts) {
          countMap.set(post.author_id, (countMap.get(post.author_id) || 0) + 1);
        }
        usersWithPostCount = (users || []).map((user) => ({
          ...user,
          post_count: countMap.get(user.id) || 0,
        }));
      }
    }

    return NextResponse.json(
      {
        users: usersWithPostCount,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
        period,
      },
      {
        headers: {
          // CDN 캐싱: 5분간 캐시, 1분간 stale 허용
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
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
      global_rank,
      country_rank,
      total_tokens,
      total_cost,
      total_sessions,
      ccplan,
      has_opus_usage,
      social_links
    `
    )
    .in("id", userIds)
    .eq("onboarding_completed", true)
    .is("deleted_at", null);

  if (country) {
    usersQuery = usersQuery.eq("country_code", country.toUpperCase());
  }

  const { data: usersData, error: usersError } = await usersQuery;

  if (usersError) {
    console.error("Users query error:", usersError);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  // Fetch post counts for users
  const periodUserIds = (usersData || []).map((u) => u.id);
  const postCountMap = new Map<string, number>();

  if (periodUserIds.length > 0) {
    const { data: postCounts } = await supabase
      .from("posts")
      .select("author_id")
      .in("author_id", periodUserIds)
      .is("deleted_at", null);

    if (postCounts) {
      for (const post of postCounts) {
        postCountMap.set(post.author_id, (postCountMap.get(post.author_id) || 0) + 1);
      }
    }
  }

  // Combine user data with period aggregates and sort
  const combinedUsers = (usersData || [])
    .map((user) => {
      const aggregate = userAggregates.get(user.id) || { tokens: 0, cost: 0 };
      return {
        ...user,
        period_tokens: aggregate.tokens,
        period_cost: aggregate.cost,
        post_count: postCountMap.get(user.id) || 0,
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

  return NextResponse.json(
    {
      users: paginatedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      period,
    },
    {
      headers: {
        // CDN 캐싱: 5분간 캐시, 1분간 stale 허용
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    }
  );
}
