/**
 * Badge Context - All data needed to check badge conditions
 * This is the single source of truth for badge evaluation
 */
export interface BadgeContext {
  // User stats
  total_tokens: number;
  total_cost: number;
  global_rank: number;
  country_rank?: number;
  country_code?: string;
  referral_count?: number;

  // Streak data
  streak: number;

  // Model usage (percentage)
  model_usage?: {
    opus?: number; // percentage 0-100
    sonnet?: number;
    haiku?: number;
  };

  // Special conditions
  is_early_country_user?: boolean; // Top 10 earliest from country
  rank_gain_weekly?: number; // Rank improvement this week
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  praise: string;
  icon: string;
  category: "streak" | "tokens" | "rank" | "model" | "social";
  rarity: "common" | "rare" | "epic" | "legendary";

  /**
   * Condition function - returns true if badge should be awarded
   * All badge logic is co-located with the badge definition
   */
  condition: (ctx: BadgeContext) => boolean;
}

// Rarity order for sorting (higher = harder)
export const RARITY_ORDER: Record<Badge["rarity"], number> = {
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

export const BADGES: Badge[] = [
  // ═══════════════════════════════════════
  // 1. STREAK BADGES (연속 사용) - 6개
  // ═══════════════════════════════════════
  {
    id: "streak_180",
    name: "Half-Year Hero",
    description: "180 days consecutive usage",
    praise: "Six months of dedication! You're in the hall of fame.",
    icon: "👑",
    category: "streak",
    rarity: "legendary",
    condition: (ctx) => ctx.streak >= 180,
  },
  {
    id: "streak_90",
    name: "Quarter Master",
    description: "90 days consecutive usage",
    praise: "Three months of commitment! You're building something great.",
    icon: "🏔️",
    category: "streak",
    rarity: "epic",
    condition: (ctx) => ctx.streak >= 90,
  },
  {
    id: "streak_60",
    name: "Two-Month Titan",
    description: "60 days consecutive usage",
    praise: "Two months strong! You're unstoppable.",
    icon: "💪",
    category: "streak",
    rarity: "rare",
    condition: (ctx) => ctx.streak >= 60,
  },
  {
    id: "streak_30",
    name: "Monthly Warrior",
    description: "30 days consecutive usage",
    praise: "One month streak! You're on the right track.",
    icon: "🗓️",
    category: "streak",
    rarity: "rare",
    condition: (ctx) => ctx.streak >= 30,
  },
  {
    id: "streak_14",
    name: "Fortnight Fighter",
    description: "14 days consecutive usage",
    praise: "Two weeks of consistency! Great habits forming.",
    icon: "🔥",
    category: "streak",
    rarity: "common",
    condition: (ctx) => ctx.streak >= 14,
  },
  {
    id: "streak_7",
    name: "Week Starter",
    description: "7 days consecutive usage",
    praise: "First week done! The journey begins.",
    icon: "🌱",
    category: "streak",
    rarity: "common",
    condition: (ctx) => ctx.streak >= 7,
  },

  // ═══════════════════════════════════════
  // 2. TOKENS BADGES (토큰/비용) - 6개
  // ═══════════════════════════════════════
  {
    id: "10b_club",
    name: "10B Club",
    description: "Reached 10B+ total tokens",
    praise: "Absolutely legendary! 10 billion tokens of pure mastery.",
    icon: "💎",
    category: "tokens",
    rarity: "legendary",
    condition: (ctx) => ctx.total_tokens >= 10_000_000_000,
  },
  {
    id: "billion_club",
    name: "Billion Club",
    description: "Reached 1B+ total tokens",
    praise: "Welcome to the Billion Club! You're among the elite.",
    icon: "💠",
    category: "tokens",
    rarity: "epic",
    condition: (ctx) => ctx.total_tokens >= 1_000_000_000,
  },
  {
    id: "whale",
    name: "Whale",
    description: "Spent $10,000+ total",
    praise: "A true whale! Making waves in the Claude ocean.",
    icon: "🐋",
    category: "tokens",
    rarity: "epic",
    condition: (ctx) => ctx.total_cost >= 10_000,
  },
  {
    id: "hundred_million",
    name: "100M Club",
    description: "Reached 100M total tokens",
    praise: "One hundred million! You're getting serious.",
    icon: "💫",
    category: "tokens",
    rarity: "rare",
    condition: (ctx) => ctx.total_tokens >= 100_000_000,
  },
  {
    id: "big_spender",
    name: "Big Spender",
    description: "Spent $5,000+ total",
    praise: "Investing in AI excellence! Your commitment is remarkable.",
    icon: "💰",
    category: "tokens",
    rarity: "rare",
    condition: (ctx) => ctx.total_cost >= 5_000,
  },
  {
    id: "first_million",
    name: "First Million",
    description: "Reached 1M total tokens",
    praise: "Your first million! The journey begins.",
    icon: "🎯",
    category: "tokens",
    rarity: "common",
    condition: (ctx) => ctx.total_tokens >= 1_000_000,
  },

  // ═══════════════════════════════════════
  // 3. RANK BADGES (순위) - 6개
  // ═══════════════════════════════════════
  {
    id: "global_first",
    name: "Global Champion",
    description: "Reached #1 Worldwide",
    praise: "The absolute champion! You stand at the top of the world.",
    icon: "🥇",
    category: "rank",
    rarity: "legendary",
    condition: (ctx) => ctx.global_rank === 1,
  },
  {
    id: "top_3",
    name: "Podium",
    description: "Reached Global Top 3",
    praise: "On the podium! One of the top 3 in the world.",
    icon: "🏆",
    category: "rank",
    rarity: "legendary",
    condition: (ctx) => ctx.global_rank <= 3,
  },
  {
    id: "trailblazer",
    name: "Trailblazer",
    description: "Top 10 earliest users from your country",
    praise: "Pioneer of your nation! You opened the path for others.",
    icon: "🌅",
    category: "rank",
    rarity: "legendary",
    condition: (ctx) => ctx.is_early_country_user === true,
  },
  {
    id: "country_first",
    name: "National Champion",
    description: "Reached #1 in your country",
    praise: "National champion! You've conquered your homeland.",
    icon: "🇰🇷",
    category: "rank",
    rarity: "epic",
    condition: (ctx) => ctx.country_rank === 1,
  },
  {
    id: "top_50",
    name: "Global 50",
    description: "Reached Global Top 50",
    praise: "Top 50 worldwide! Elite competitor.",
    icon: "🏅",
    category: "rank",
    rarity: "rare",
    condition: (ctx) => ctx.global_rank <= 50,
  },
  {
    id: "rising_star",
    name: "Rising Star",
    description: "Gained 100+ ranks in a week",
    praise: "Shooting star! Your rise is inspiring everyone.",
    icon: "🚀",
    category: "rank",
    rarity: "rare",
    condition: (ctx) => (ctx.rank_gain_weekly || 0) >= 100,
  },

  // ═══════════════════════════════════════
  // 4. MODEL BADGES (모델 사용) - 4개
  // ═══════════════════════════════════════
  {
    id: "opus_lover",
    name: "Opus Connoisseur",
    description: "70%+ of tokens on Opus models",
    praise: "Only the finest for you! Opus is your weapon of choice.",
    icon: "🎭",
    category: "model",
    rarity: "epic",
    condition: (ctx) => (ctx.model_usage?.opus || 0) >= 70,
  },
  {
    id: "sonnet_master",
    name: "Sonnet Master",
    description: "70%+ of tokens on Sonnet models",
    praise: "Balance of power and efficiency! Sonnet suits you perfectly.",
    icon: "🎵",
    category: "model",
    rarity: "rare",
    condition: (ctx) => (ctx.model_usage?.sonnet || 0) >= 70,
  },
  {
    id: "model_explorer",
    name: "Model Explorer",
    description: "Used all available Claude models (100K+ each)",
    praise: "Versatile explorer! You've mastered the entire Claude family.",
    icon: "🧭",
    category: "model",
    rarity: "rare",
    condition: (ctx) => {
      const usage = ctx.model_usage;
      if (!usage) return false;
      // All three model types used with at least some percentage
      return (usage.opus || 0) > 0 && (usage.sonnet || 0) > 0 && (usage.haiku || 0) > 0;
    },
  },
  {
    id: "haiku_ninja",
    name: "Haiku Ninja",
    description: "70%+ of tokens on Haiku models",
    praise: "Speed demon! Quick and efficient like a true ninja.",
    icon: "⚡",
    category: "model",
    rarity: "common",
    condition: (ctx) => (ctx.model_usage?.haiku || 0) >= 70,
  },

  // ═══════════════════════════════════════
  // 5. SOCIAL BADGES (소셜/초대) - 5개
  // ═══════════════════════════════════════
  {
    id: "social_legend",
    name: "Social Legend",
    description: "Referred 50+ friends who joined",
    praise: "Legendary influencer! You built an army.",
    icon: "🦁",
    category: "social",
    rarity: "legendary",
    condition: (ctx) => (ctx.referral_count || 0) >= 50,
  },
  {
    id: "social_star",
    name: "Social Star",
    description: "Referred 30+ friends who joined",
    praise: "Star power! Your network is impressive.",
    icon: "🌟",
    category: "social",
    rarity: "epic",
    condition: (ctx) => (ctx.referral_count || 0) >= 30,
  },
  {
    id: "influencer",
    name: "Influencer",
    description: "Referred 20+ friends who joined",
    praise: "Community builder! You're a true ambassador.",
    icon: "📣",
    category: "social",
    rarity: "rare",
    condition: (ctx) => (ctx.referral_count || 0) >= 20,
  },
  {
    id: "networker",
    name: "Networker",
    description: "Referred 10+ friends who joined",
    praise: "Growing your network! Keep spreading the word.",
    icon: "🤝",
    category: "social",
    rarity: "rare",
    condition: (ctx) => (ctx.referral_count || 0) >= 10,
  },
  {
    id: "recruiter",
    name: "Recruiter",
    description: "Referred 5+ friends who joined",
    praise: "First recruits! Thanks for sharing.",
    icon: "📢",
    category: "social",
    rarity: "common",
    condition: (ctx) => (ctx.referral_count || 0) >= 5,
  },
];

export function getBadgeById(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}

export function getBadgesByCategory(category: Badge["category"]): Badge[] {
  return BADGES.filter((b) => b.category === category);
}

export function getBadgesByRarity(rarity: Badge["rarity"]): Badge[] {
  return BADGES.filter((b) => b.rarity === rarity);
}

export const RARITY_COLORS: Record<Badge["rarity"], string> = {
  common: "#A1A1AA",
  rare: "#3B82F6",
  epic: "#A855F7",
  legendary: "#FFD700",
};
