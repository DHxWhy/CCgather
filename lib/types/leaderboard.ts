/**
 * Leaderboard API Types
 * ====================
 * Types for leaderboard page and related components
 */

export type PeriodFilter = 'today' | '7d' | '30d' | 'all';
export type ScopeFilter = 'global' | 'country';
export type SortByFilter = 'tokens' | 'cost';

export interface LeaderboardUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country_code: string | null;
  current_level: number;
  global_rank: number | null;
  country_rank: number | null;
  total_tokens: number;
  total_cost: number;
  // Period-specific fields (when filtered by period)
  period_tokens?: number;
  period_cost?: number;
  period_rank?: number;
}

export interface LeaderboardResponse {
  users: LeaderboardUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  period: PeriodFilter;
}

export interface UsageHistoryPoint {
  date: string;
  tokens: number;
  cost: number;
}

export interface UserHistoryResponse {
  history: UsageHistoryPoint[];
  user: {
    id: string;
    username: string;
    total_tokens: number;
    total_cost: number;
  };
}

export interface UserBadge {
  badge_type: string;
  earned_at: string;
}

export interface UserProfileResponse {
  user: LeaderboardUser;
  badges: UserBadge[];
  history: UsageHistoryPoint[];
}
