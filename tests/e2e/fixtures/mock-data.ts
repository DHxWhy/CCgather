// Mock data for E2E tests

export const mockUsers = Array.from({ length: 50 }, (_, i) => ({
  id: `user-${i + 1}`,
  username: `testuser${i + 1}`,
  display_name:
    i === 0 ? "Top Player" : i === 1 ? "Second Best" : i === 2 ? "Bronze Star" : `Player ${i + 1}`,
  avatar_url: i % 3 === 0 ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}` : null,
  country_code: ["KR", "US", "JP", "CN", "DE"][i % 5],
  current_level: Math.min(10, Math.floor(i / 5) + 1),
  global_rank: i + 1,
  country_rank: Math.floor(i / 5) + 1,
  total_tokens: 10000000000 - i * 100000000,
  total_cost: 50000 - i * 500,
  total_sessions: 100 - i,
  ccplan: i < 10 ? "max" : "pro",
  has_opus_usage: i < 20,
  social_links: null,
}));

export function createLeaderboardResponse(page = 1, limit = 20, period = "all") {
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedUsers = mockUsers.slice(start, end);

  return {
    users: paginatedUsers.map((user, idx) => ({
      ...user,
      period_tokens: period === "all" ? user.total_tokens : Math.floor(user.total_tokens / 10),
      period_cost: period === "all" ? user.total_cost : Math.floor(user.total_cost / 10),
      period_rank: start + idx + 1,
    })),
    pagination: {
      page,
      limit,
      total: mockUsers.length,
      totalPages: Math.ceil(mockUsers.length / limit),
    },
    period,
  };
}

export function createUserHistoryResponse(userId: string) {
  const days = 365;
  const daily = Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - i - 1));
    return {
      date: date.toISOString().split("T")[0],
      tokens: Math.floor(Math.random() * 1000000) + 100000,
      cost: Math.floor(Math.random() * 100) + 10,
    };
  });

  // New format: usage-summary API response
  const totalTokens = daily.reduce((sum, d) => sum + d.tokens, 0);
  const totalCost = daily.reduce((sum, d) => sum + d.cost, 0);
  const activeDays = daily.filter((d) => d.tokens > 0).length;

  return {
    daily,
    totals: {
      tokens: totalTokens,
      cost: totalCost,
      sessions: 100,
    },
    averages: {
      dailyTokens: Math.round(totalTokens / activeDays),
      dailyCost: totalCost / activeDays,
    },
    streaks: {
      current: 7,
      longest: 30,
    },
    // Keep history for backwards compatibility with any tests still using old format
    history: daily,
  };
}

export function createUserBadgesResponse() {
  return {
    badges: [
      { badge_type: "streak_7", earned_at: "2024-01-01" },
      { badge_type: "tokens_1m", earned_at: "2024-02-01" },
      { badge_type: "rank_top_100", earned_at: "2024-03-01" },
    ],
  };
}

export function createMeResponse() {
  // Page expects data.user.username format
  return {
    user: {
      id: "user-15",
      username: "currentuser",
      display_name: "Current User",
      avatar_url: null,
      country_code: "KR",
      timezone: "Asia/Seoul",
      current_level: 5,
      global_rank: 15,
      country_rank: 3,
      total_tokens: 5000000000,
      total_cost: 25000,
      onboarding_completed: true,
      is_admin: false,
      social_links: {},
      referral_code: "abc12",
      hide_profile_on_invite: false,
      ccplan: null,
      created_at: "2024-01-01T00:00:00Z",
    },
  };
}
