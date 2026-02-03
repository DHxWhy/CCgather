/**
 * Leaderboard API Types
 * ====================
 * Types for leaderboard page and related components
 */

export type PeriodFilter = "1d" | "7d" | "30d" | "all" | "custom";
export type ScopeFilter = "global" | "country";
export type SortByFilter = "tokens" | "cost";

// CCplan (subscription tier) - Now used for BADGE display only, not league placement
// Known plans for filter dropdown
export type CCPlanFilter = "all" | "free" | "pro" | "max" | "team" | "enterprise" | "api";

// CCplan badge configuration
interface CCPlanBadgeConfig {
  name: string;
  icon: string;
  color: string;
}

// Known CCplan configurations - For badge display only (v2.0)
export const CCPLAN_CONFIG: Record<string, CCPlanBadgeConfig> = {
  free: { name: "Free", icon: "⚪", color: "#6B7280" },
  pro: { name: "Pro", icon: "⚡", color: "#3B82F6" },
  max: { name: "Max", icon: "🚀", color: "#F59E0B" },
  team: { name: "Team", icon: "👥", color: "#8B5CF6" },
  enterprise: { name: "Enterprise", icon: "🏢", color: "#10B981" },
  api: { name: "API", icon: "🔑", color: "#EC4899" },
};

// Fallback config for unknown plans
export const CCPLAN_FALLBACK: CCPlanBadgeConfig = {
  name: "Unknown",
  icon: "❓",
  color: "#9CA3AF",
};

/**
 * Get CCplan badge config with fallback for unknown plans
 * Supports variants like "max_20x" → falls back to "max" if exact match not found
 */
export function getCCPlanConfig(ccplan: string | null | undefined): CCPlanBadgeConfig | null {
  if (!ccplan) return null;

  const normalized = ccplan.toLowerCase();

  // Exact match
  if (CCPLAN_CONFIG[normalized]) {
    return CCPLAN_CONFIG[normalized];
  }

  // Return fallback for unknown plans
  return {
    ...CCPLAN_FALLBACK,
    name: ccplan.toUpperCase(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Level System (V2.0)
// Simple level progression based on total token usage
// ═══════════════════════════════════════════════════════════════════════════

// Level thresholds (tokens required) - Synced with CLI v2.0.31
export const LEVEL_THRESHOLDS = [
  { level: 1, min: 0, max: 50_000_000, name: "Novice", icon: "🌱" },
  { level: 2, min: 50_000_000, max: 200_000_000, name: "Apprentice", icon: "⚡" },
  { level: 3, min: 200_000_000, max: 500_000_000, name: "Journeyman", icon: "🔨" },
  { level: 4, min: 500_000_000, max: 1_000_000_000, name: "Expert", icon: "🏗️" },
  { level: 5, min: 1_000_000_000, max: 3_000_000_000, name: "Master", icon: "💎" },
  { level: 6, min: 3_000_000_000, max: 10_000_000_000, name: "Grandmaster", icon: "🔥" },
  { level: 7, min: 10_000_000_000, max: 30_000_000_000, name: "Legend", icon: "👑" },
  { level: 8, min: 30_000_000_000, max: 50_000_000_000, name: "Mythic", icon: "⚔️" },
  { level: 9, min: 50_000_000_000, max: 100_000_000_000, name: "Immortal", icon: "🌟" },
  { level: 10, min: 100_000_000_000, max: Infinity, name: "Transcendent", icon: "🏆" },
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
 * Get level info from level number
 */
export function getLevelInfo(level: number) {
  const threshold = LEVEL_THRESHOLDS.find((t) => t.level === level);
  return threshold || LEVEL_THRESHOLDS[0];
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
  custom_avatar_url?: string | null; // DiceBear custom avatar (takes priority over avatar_url)
  country_code: string | null;
  current_level: number;
  global_rank: number | null;
  country_rank: number | null;
  total_tokens: number;
  total_cost: number;
  total_sessions?: number;
  // Period-specific fields (when filtered by period)
  period_tokens?: number;
  period_cost?: number;
  period_rank?: number;
  period_country_rank?: number;
  // CCplan fields (for badge display only) - TEXT type, any value allowed
  ccplan?: string | null;
  // Opus badge
  has_opus_usage?: boolean;
  // Social links
  social_links?: SocialLinks | null;
  // Post count for community
  post_count?: number;
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
