/**
 * Leaderboard API Types
 * ====================
 * Types for leaderboard page and related components
 */

export type PeriodFilter = "today" | "7d" | "30d" | "all";
export type ScopeFilter = "global" | "country";
export type SortByFilter = "tokens" | "cost";

// CCplan (subscription tier) - Now used for BADGE display only, not league placement
export type CCPlanFilter = "all" | "free" | "pro" | "max" | "team";

// CCplan configuration - For badge display only (v2.0)
export const CCPLAN_CONFIG: Record<
  Exclude<CCPlanFilter, "all">,
  { name: string; icon: string; color: string }
> = {
  max: { name: "Max", icon: "🚀", color: "#F59E0B" },
  pro: { name: "Pro", icon: "⚡", color: "#3B82F6" },
  team: { name: "Team", icon: "👥", color: "#8B5CF6" },
  free: { name: "Free", icon: "⚪", color: "#6B7280" },
};

// ═══════════════════════════════════════════════════════════════════════════
// V2.0: Level-Based League System
// League is determined by level (token usage), not subscription plan
// ═══════════════════════════════════════════════════════════════════════════

export type LevelLeagueFilter = "all" | "rookie" | "builder" | "master" | "legend";

// Level league configuration
export const LEVEL_LEAGUE_CONFIG: Record<
  Exclude<LevelLeagueFilter, "all">,
  { name: string; icon: string; color: string; levels: string; description: string }
> = {
  rookie: {
    name: "Rookie League",
    icon: "🌱",
    color: "#22C55E",
    levels: "Lv 1-3",
    description: "Rookie, Coder, Builder",
  },
  builder: {
    name: "Builder League",
    icon: "🔨",
    color: "#3B82F6",
    levels: "Lv 4-6",
    description: "Architect, Expert, Master",
  },
  master: {
    name: "Master League",
    icon: "⚔️",
    color: "#8B5CF6",
    levels: "Lv 7-9",
    description: "Grandmaster, Legend, Titan",
  },
  legend: {
    name: "Legend League",
    icon: "🏆",
    color: "#F59E0B",
    levels: "Lv 10",
    description: "Immortal",
  },
};

// Level thresholds (tokens required)
export const LEVEL_THRESHOLDS = [
  { level: 1, min: 0, max: 10_000_000, name: "Rookie", icon: "🌱" },
  { level: 2, min: 10_000_000, max: 50_000_000, name: "Coder", icon: "⚡" },
  { level: 3, min: 50_000_000, max: 200_000_000, name: "Builder", icon: "🔨" },
  { level: 4, min: 200_000_000, max: 500_000_000, name: "Architect", icon: "🏗️" },
  { level: 5, min: 500_000_000, max: 1_000_000_000, name: "Expert", icon: "💎" },
  { level: 6, min: 1_000_000_000, max: 3_000_000_000, name: "Master", icon: "🔥" },
  { level: 7, min: 3_000_000_000, max: 10_000_000_000, name: "Grandmaster", icon: "⚔️" },
  { level: 8, min: 10_000_000_000, max: 30_000_000_000, name: "Legend", icon: "👑" },
  { level: 9, min: 30_000_000_000, max: 100_000_000_000, name: "Titan", icon: "🌟" },
  { level: 10, min: 100_000_000_000, max: Infinity, name: "Immortal", icon: "🏆" },
] as const;

/**
 * Calculate level from total tokens
 */
export function calculateLevel(totalTokens: number): number {
  for (const threshold of LEVEL_THRESHOLDS) {
    if (totalTokens >= threshold.min && totalTokens < threshold.max) {
      return threshold.level;
    }
  }
  return 1; // Default to level 1
}

/**
 * Get level league from level number
 * - Lv 1-3: rookie
 * - Lv 4-6: builder
 * - Lv 7-9: master
 * - Lv 10: legend
 */
export function getLevelLeague(level: number): Exclude<LevelLeagueFilter, "all"> {
  if (level <= 3) return "rookie";
  if (level <= 6) return "builder";
  if (level <= 9) return "master";
  return "legend";
}

// Social links structure
export interface SocialLinks {
  github?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
}

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
  // V2.0: Level-based league (for ranking)
  level_league?: LevelLeagueFilter | null;
  level_league_rank?: number | null;
  // CCplan fields (for badge display only, not ranking)
  ccplan?: CCPlanFilter | null;
  ccplan_rank?: number | null; // Deprecated - use level_league_rank
  // Opus badge
  has_opus_usage?: boolean;
  // Social links
  social_links?: SocialLinks | null;
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
  // V2.0: Level-based league info
  level_league: LevelLeagueFilter;
  level_league_info?: {
    name: string;
    icon: string;
    levels: string;
    total_users: number;
  };
  // CCplan info (for badge display only)
  ccplan?: CCPlanFilter;
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
