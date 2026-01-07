/**
 * Leaderboard API Types
 * ====================
 * Types for leaderboard page and related components
 */

export type PeriodFilter = "today" | "7d" | "30d" | "all";
export type ScopeFilter = "global" | "country";
export type SortByFilter = "tokens" | "cost";

// CCplan (subscription tier) filter
export type CCPlanFilter = "all" | "free" | "pro" | "max" | "team";

// CCplan configuration
export const CCPLAN_CONFIG: Record<
  Exclude<CCPlanFilter, "all">,
  { name: string; icon: string; color: string }
> = {
  max: { name: "Max League", icon: "🚀", color: "#F59E0B" },
  pro: { name: "Pro League", icon: "⚡", color: "#3B82F6" },
  team: { name: "Team League", icon: "👥", color: "#8B5CF6" },
  free: { name: "Free League", icon: "⚪", color: "#6B7280" },
};

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
  // CCplan fields
  ccplan?: CCPlanFilter | null;
  ccplan_rank?: number | null;
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
  // CCplan info
  ccplan: CCPlanFilter;
  ccplan_info?: {
    name: string;
    icon: string;
    total_users: number;
  };
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
