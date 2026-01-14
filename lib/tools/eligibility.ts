/**
 * Tool Suggestion Eligibility Checker
 *
 * Two paths to eligibility:
 * - Path 1: Level 7+ (Legend or higher) - Heavy users
 * - Path 2: 7+ unique data days - Consistent participants
 */

import type { TrustTier } from "@/types/tools";
import { getLevelByNumber } from "@/lib/constants/levels";

// =====================================================
// Constants
// =====================================================

/** Minimum level required via Path 1 */
export const MIN_SUGGEST_LEVEL = 7;

/** Minimum unique data days required via Path 2 */
export const MIN_UNIQUE_DATA_DAYS = 7;

/** Vote weight multipliers for each trust tier */
export const VOTE_WEIGHTS: Record<TrustTier, number> = {
  elite: 3.0,
  power_user: 2.0,
  verified: 1.5,
  member: 1.0,
};

// =====================================================
// Types
// =====================================================

export interface EligibilityCheckInput {
  current_level: number;
  unique_data_days: number;
}

export interface EligibilityResult {
  eligible: boolean;
  eligible_path: "level" | "data_days" | null;
  trust_tier: TrustTier;
  vote_weight: number;
  requirements: {
    level: { met: boolean; current: number; required: number; name: string };
    data_days: { met: boolean; current: number; required: number };
  };
  message: string;
}

export interface SuggesterInfo {
  id: string;
  username: string;
  avatar_url: string | null;
  current_level: number;
  trust_tier: TrustTier;
  vote_weight: number;
}

// =====================================================
// Core Functions
// =====================================================

/**
 * Calculate trust tier based on user level and optionally global rank
 * @param level - User's current level (1-10)
 * @param globalRank - Optional global rank (lower is better)
 */
export function calculateTrustTier(level: number, globalRank?: number | null): TrustTier {
  // Elite: top 100 global rank OR level 9+
  if (level >= 9 || (globalRank !== null && globalRank !== undefined && globalRank <= 100)) {
    return "elite";
  }
  // Power user: top 500 global rank OR level 7+
  if (level >= 7 || (globalRank !== null && globalRank !== undefined && globalRank <= 500)) {
    return "power_user";
  }
  // Verified: level 5+
  if (level >= 5) {
    return "verified";
  }
  // Member: everyone else
  return "member";
}

/**
 * Calculate vote weight based on trust tier
 */
export function calculateVoteWeight(tier: TrustTier): number {
  return VOTE_WEIGHTS[tier];
}

/**
 * Check if user is eligible to suggest tools
 * Two paths: Level 7+ OR 7+ unique data days
 */
export function checkSuggestionEligibility(user: EligibilityCheckInput): EligibilityResult {
  const levelInfo = getLevelByNumber(user.current_level);
  const trustTier = calculateTrustTier(user.current_level);
  const voteWeight = calculateVoteWeight(trustTier);

  // Path 1: Level-based
  const levelMet = user.current_level >= MIN_SUGGEST_LEVEL;

  // Path 2: Data days-based
  const dataDaysMet = user.unique_data_days >= MIN_UNIQUE_DATA_DAYS;

  // Either path grants eligibility
  const isEligible = levelMet || dataDaysMet;

  // Determine which path qualified
  let eligiblePath: "level" | "data_days" | null = null;
  if (isEligible) {
    eligiblePath = levelMet ? "level" : "data_days";
  }

  // Generate appropriate message
  let message: string;
  if (isEligible) {
    if (levelMet) {
      message = `You are eligible as a ${levelInfo.name} (Level ${user.current_level}).`;
    } else {
      message = `You are eligible with ${user.unique_data_days} days of usage data.`;
    }
  } else {
    message = `To suggest tools, reach Level ${MIN_SUGGEST_LEVEL}+ OR submit ${MIN_UNIQUE_DATA_DAYS}+ days of data.`;
  }

  return {
    eligible: isEligible,
    eligible_path: eligiblePath,
    trust_tier: trustTier,
    vote_weight: voteWeight,
    requirements: {
      level: {
        met: levelMet,
        current: user.current_level,
        required: MIN_SUGGEST_LEVEL,
        name: levelInfo.name,
      },
      data_days: {
        met: dataDaysMet,
        current: user.unique_data_days,
        required: MIN_UNIQUE_DATA_DAYS,
      },
    },
    message,
  };
}

/**
 * Build suggester info from user data
 */
export function buildSuggesterInfo(user: {
  id: string;
  username: string;
  avatar_url: string | null;
  current_level: number;
}): SuggesterInfo {
  const trustTier = calculateTrustTier(user.current_level);

  return {
    id: user.id,
    username: user.username,
    avatar_url: user.avatar_url,
    current_level: user.current_level,
    trust_tier: trustTier,
    vote_weight: calculateVoteWeight(trustTier),
  };
}

// =====================================================
// Utility Functions
// =====================================================

/**
 * Get trust tier display info
 */
export function getTrustTierDisplay(tier: TrustTier): {
  label: string;
  emoji: string;
  color: string;
} {
  const displays: Record<TrustTier, { label: string; emoji: string; color: string }> = {
    elite: { label: "Elite", emoji: "🏆", color: "gold" },
    power_user: { label: "Power User", emoji: "⚡", color: "coral" },
    verified: { label: "Verified", emoji: "✅", color: "emerald" },
    member: { label: "Member", emoji: "👤", color: "gray" },
  };
  return displays[tier];
}

/**
 * Get eligibility requirements summary for UI display
 */
export function getEligibilityRequirements(): Array<{
  key: string;
  label: string;
  description: string;
}> {
  const requiredLevel = getLevelByNumber(MIN_SUGGEST_LEVEL);

  return [
    {
      key: "level",
      label: `Level ${MIN_SUGGEST_LEVEL}+ (${requiredLevel.name})`,
      description: "Reach Legend level or higher",
    },
    {
      key: "data_days",
      label: `${MIN_UNIQUE_DATA_DAYS}+ Days of Data`,
      description: "Submit usage data for 7 or more unique days via npx ccgather",
    },
  ];
}
