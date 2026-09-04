/**
 * Badge Context - All data needed to check badge conditions
 * This is the single source of truth for badge evaluation
 */
export interface BadgeContext {
  // User stats
  total_tokens: number;
  total_cost: number;
  total_sessions: number;
  global_rank: number;
  country_rank?: number;
  country_code?: string;
  /** 같은 국가의 보드 등재 인원 — 국가 순위 배지는 3명 이상일 때만 발급 */
  country_user_count?: number;
  referral_count?: number;

  // Streak data
  streak: number;

  // Model usage
  /** 모델군별 토큰 비중 (0-100) */
  model_usage?: {
    opus?: number;
    sonnet?: number;
    haiku?: number;
    fable?: number;
  };
  /** 모델군별 누적 토큰 */
  model_tokens?: {
    opus?: number;
    sonnet?: number;
    haiku?: number;
    fable?: number;
  };
  /** Haiku 가 그날의 주 모델이었던 날 수 */
  haiku_primary_days?: number;

  // Settings / integrations
  auto_sync_enabled?: boolean;
  github_starred?: boolean;

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
  /** Static pin image base path (spike): `${image}-96.webp` / `${image}-192.webp` */
  image?: string;
  category: "streak" | "tokens" | "rank" | "model" | "journey" | "community";
  rarity: "common" | "rare" | "epic" | "legendary";

  /**
   * Condition function - returns true if badge should be awarded
   * All badge logic is co-located with the badge definition
   */
  condition: (ctx: BadgeContext) => boolean;
}

export const BADGES: Badge[] = [
  // ═══════════════════════════════════════
  // 1. STREAK BADGES (연속 사용) - 7개
  // ═══════════════════════════════════════
  {
    id: "streak_150",
    image: "/badges/v1/streak_150",
    name: "Unbroken",
    description: "150 days consecutive usage",
    praise: "Five months without a single gap. Almost nobody gets here.",
    icon: "🔥",
    category: "streak",
    rarity: "legendary",
    condition: (ctx) => ctx.streak >= 150,
  },
  {
    id: "streak_90",
    image: "/badges/v1/streak_90",
    name: "Quarter Master",
    description: "90 days consecutive usage",
    praise: "A full quarter of daily practice.",
    icon: "🔥",
    category: "streak",
    rarity: "epic",
    condition: (ctx) => ctx.streak >= 90,
  },
  {
    id: "streak_60",
    image: "/badges/v1/streak_60",
    name: "Two-Month Titan",
    description: "60 days consecutive usage",
    praise: "Two months straight — the habit is real now.",
    icon: "🔥",
    category: "streak",
    rarity: "epic",
    condition: (ctx) => ctx.streak >= 60,
  },
  {
    id: "streak_30",
    image: "/badges/v1/streak_30",
    name: "Monthly Warrior",
    description: "30 days consecutive usage",
    praise: "One month streak! You're on the right track.",
    icon: "🔥",
    category: "streak",
    rarity: "rare",
    condition: (ctx) => ctx.streak >= 30,
  },
  {
    id: "streak_14",
    image: "/badges/v1/streak_14",
    name: "Fortnight Fighter",
    description: "14 days consecutive usage",
    praise: "Two weeks in a row. It's sticking.",
    icon: "🔥",
    category: "streak",
    rarity: "common",
    condition: (ctx) => ctx.streak >= 14,
  },
  {
    id: "streak_7",
    image: "/badges/v1/streak_7",
    name: "Week Starter",
    description: "7 days consecutive usage",
    praise: "A full week of daily Claude Code.",
    icon: "🔥",
    category: "streak",
    rarity: "common",
    condition: (ctx) => ctx.streak >= 7,
  },
  {
    id: "streak_3",
    image: "/badges/v1/streak_3",
    name: "First Streak",
    description: "3 days consecutive usage",
    praise: "Three days in a row — the streak has begun.",
    icon: "🔥",
    category: "streak",
    rarity: "common",
    condition: (ctx) => ctx.streak >= 3,
  },
  // ═══════════════════════════════════════
  // 2. TOKEN BADGES (누적 토큰) - 7개
  // ═══════════════════════════════════════
  {
    id: "500b_club",
    image: "/badges/v1/500b_club",
    name: "500B Club",
    description: "Reached 500B+ total tokens",
    praise: "Five hundred billion tokens. Nobody has stood here before.",
    icon: "👑",
    category: "tokens",
    rarity: "legendary",
    condition: (ctx) => ctx.total_tokens >= 500_000_000_000,
  },
  {
    id: "200b_club",
    image: "/badges/v1/200b_club",
    name: "200B Club",
    description: "Reached 200B+ total tokens",
    praise: "Two hundred billion tokens. Rarefied air.",
    icon: "👑",
    category: "tokens",
    rarity: "legendary",
    condition: (ctx) => ctx.total_tokens >= 200_000_000_000,
  },
  {
    id: "100b_club",
    image: "/badges/v1/100b_club",
    name: "100B Club",
    description: "Reached 100B+ total tokens",
    praise: "One hundred billion tokens of pure mastery.",
    icon: "💎",
    category: "tokens",
    rarity: "legendary",
    condition: (ctx) => ctx.total_tokens >= 100_000_000_000,
  },
  {
    id: "50b_club",
    image: "/badges/v1/50b_club",
    name: "50B Club",
    description: "Reached 50B+ total tokens",
    praise: "Fifty billion tokens — deep in the top tier.",
    icon: "💎",
    category: "tokens",
    rarity: "epic",
    condition: (ctx) => ctx.total_tokens >= 50_000_000_000,
  },
  {
    id: "10b_club",
    image: "/badges/v1/10b_club",
    name: "10B Club",
    description: "Reached 10B+ total tokens",
    praise: "Ten billion tokens and counting.",
    icon: "💎",
    category: "tokens",
    rarity: "rare",
    condition: (ctx) => ctx.total_tokens >= 10_000_000_000,
  },
  {
    id: "3b_club",
    image: "/badges/v1/3b_club",
    name: "3B Club",
    description: "Reached 3B+ total tokens",
    praise: "Three billion tokens.",
    icon: "💎",
    category: "tokens",
    rarity: "common",
    condition: (ctx) => ctx.total_tokens >= 3_000_000_000,
  },
  {
    id: "billion_club",
    image: "/badges/v1/billion_club",
    name: "Billion Club",
    description: "Reached 1B+ total tokens",
    praise: "Welcome to the Billion Club.",
    icon: "💎",
    category: "tokens",
    rarity: "common",
    condition: (ctx) => ctx.total_tokens >= 1_000_000_000,
  },
  // ═══════════════════════════════════════
  // 3. RANK BADGES (순위 · All-Time 누적, 찍어본 적) - 7개
  // ═══════════════════════════════════════
  {
    id: "global_first",
    image: "/badges/v1/global_first",
    name: "Global Champion",
    description: "Reached #1 Worldwide",
    praise: "The top of the whole board. Only a handful ever have.",
    icon: "🏆",
    category: "rank",
    rarity: "legendary",
    condition: (ctx) => ctx.global_rank === 1,
  },
  {
    id: "top_3",
    image: "/badges/v1/top_3",
    name: "Podium",
    description: "Reached Global Top 3",
    praise: "On the podium — one of the top 3 in the world.",
    icon: "🏆",
    category: "rank",
    rarity: "epic",
    condition: (ctx) => ctx.global_rank <= 3,
  },
  {
    id: "global_10",
    image: "/badges/v1/global_10",
    name: "Global 10",
    description: "Reached Global Top 10",
    praise: "Top ten worldwide.",
    icon: "🏆",
    category: "rank",
    rarity: "epic",
    condition: (ctx) => ctx.global_rank <= 10,
  },
  {
    id: "trailblazer",
    image: "/badges/v1/trailblazer",
    name: "Trailblazer",
    description: "Top 10 earliest users from your country",
    praise: "One of the first from your country. No longer awarded.",
    icon: "🏆",
    category: "rank",
    rarity: "legendary",
    condition: () => false,
  },
  {
    id: "country_first",
    image: "/badges/v1/country_first",
    name: "National Champion",
    description: "Reached #1 in your country",
    praise: "Number one in your country.",
    icon: "🏆",
    category: "rank",
    rarity: "rare",
    condition: (ctx) => ctx.country_rank === 1 && (ctx.country_user_count ?? 0) >= 3,
  },
  {
    id: "national_podium",
    image: "/badges/v1/national_podium",
    name: "National Podium",
    description: "Reached Top 3 in your country",
    praise: "Top three in your country.",
    icon: "🏆",
    category: "rank",
    rarity: "rare",
    condition: (ctx) => (ctx.country_rank ?? Infinity) <= 3 && (ctx.country_user_count ?? 0) >= 3,
  },
  {
    id: "top_50",
    image: "/badges/v1/top_50",
    name: "Global 50",
    description: "Reached Global Top 50",
    praise: "Top 50 worldwide.",
    icon: "🏆",
    category: "rank",
    rarity: "common",
    condition: (ctx) => ctx.global_rank <= 50,
  },
  // ═══════════════════════════════════════
  // 4. MODEL BADGES (모델 숙련) - 7개
  // ═══════════════════════════════════════
  {
    id: "fable_monster",
    image: "/badges/v1/fable_monster",
    name: "Fable Monster",
    description: "50B+ tokens on Fable models",
    praise: "Fifty billion tokens on the most capable model there is.",
    icon: "🦊",
    category: "model",
    rarity: "legendary",
    condition: (ctx) => (ctx.model_tokens?.fable ?? 0) >= 50_000_000_000,
  },
  {
    id: "fable_master",
    image: "/badges/v1/fable_master",
    name: "Fable Master",
    description: "10B+ tokens on Fable models",
    praise: "Ten billion tokens on Fable.",
    icon: "🦊",
    category: "model",
    rarity: "epic",
    condition: (ctx) => (ctx.model_tokens?.fable ?? 0) >= 10_000_000_000,
  },
  {
    id: "model_maestro",
    image: "/badges/v1/model_maestro",
    name: "Model Maestro",
    description: "At least 5% each on Opus, Sonnet and Fable",
    praise: "You pick the right model for the job, not just the biggest one.",
    icon: "🎼",
    category: "model",
    rarity: "epic",
    condition: (ctx) =>
      (ctx.model_usage?.opus ?? 0) >= 5 &&
      (ctx.model_usage?.sonnet ?? 0) >= 5 &&
      (ctx.model_usage?.fable ?? 0) >= 5,
  },
  {
    id: "sonnet_master",
    image: "/badges/v1/sonnet_master",
    name: "Sonnet Master",
    description: "70%+ of tokens on Sonnet models",
    praise: "Sonnet is your workhorse.",
    icon: "✍️",
    category: "model",
    rarity: "epic",
    condition: (ctx) => (ctx.model_usage?.sonnet ?? 0) >= 70,
  },
  {
    id: "haiku_ninja",
    image: "/badges/v1/haiku_ninja",
    name: "Haiku Ninja",
    description: "Haiku was your main model on 5+ days",
    praise: "Fast and light, five days over.",
    icon: "🌸",
    category: "model",
    rarity: "epic",
    condition: (ctx) => (ctx.haiku_primary_days ?? 0) >= 5,
  },
  {
    id: "model_explorer",
    image: "/badges/v1/model_explorer",
    name: "Model Explorer",
    description: "100K+ tokens on each of the four model families",
    praise: "You've run all four families in earnest.",
    icon: "🧭",
    category: "model",
    rarity: "epic",
    condition: (ctx) => {
      const t = ctx.model_tokens;
      return (
        !!t &&
        (t.opus ?? 0) >= 100_000 &&
        (t.sonnet ?? 0) >= 100_000 &&
        (t.haiku ?? 0) >= 100_000 &&
        (t.fable ?? 0) >= 100_000
      );
    },
  },
  {
    id: "opus_lover",
    image: "/badges/v1/opus_lover",
    name: "Opus Connoisseur",
    description: "70%+ of tokens on Opus models",
    praise: "Opus is your default.",
    icon: "🎭",
    category: "model",
    rarity: "common",
    condition: (ctx) => (ctx.model_usage?.opus ?? 0) >= 70,
  },
  // ═══════════════════════════════════════
  // 5. JOURNEY BADGES (세션 · 지출) - 7개
  // ═══════════════════════════════════════
  {
    id: "unstoppable",
    image: "/badges/v1/unstoppable",
    name: "Unstoppable",
    description: "25,000+ sessions",
    praise: "Twenty-five thousand sessions. The tower has a beacon on it.",
    icon: "🗼",
    category: "journey",
    rarity: "legendary",
    condition: (ctx) => ctx.total_sessions >= 25_000,
  },
  {
    id: "deep_pockets",
    image: "/badges/v1/deep_pockets",
    name: "Deep Pockets",
    description: "Spent $50,000+ total",
    praise: "Fifty thousand dollars of compute.",
    icon: "🏦",
    category: "journey",
    rarity: "epic",
    condition: (ctx) => ctx.total_cost >= 50_000,
  },
  {
    id: "session_machine",
    image: "/badges/v1/session_machine",
    name: "Session Machine",
    description: "5,000+ sessions",
    praise: "Five thousand sessions.",
    icon: "🖥️",
    category: "journey",
    rarity: "epic",
    condition: (ctx) => ctx.total_sessions >= 5_000,
  },
  {
    id: "whale",
    image: "/badges/v1/whale",
    name: "Whale",
    description: "Spent $10,000+ total",
    praise: "Ten thousand dollars in.",
    icon: "🐋",
    category: "journey",
    rarity: "rare",
    condition: (ctx) => ctx.total_cost >= 10_000,
  },
  {
    id: "marathoner",
    image: "/badges/v1/marathoner",
    name: "Marathoner",
    description: "1,000+ sessions",
    praise: "A thousand sessions deep.",
    icon: "🏃",
    category: "journey",
    rarity: "rare",
    condition: (ctx) => ctx.total_sessions >= 1_000,
  },
  {
    id: "big_spender",
    image: "/badges/v1/big_spender",
    name: "Big Spender",
    description: "Spent $5,000+ total",
    praise: "Five thousand dollars of Claude Code.",
    icon: "💰",
    category: "journey",
    rarity: "common",
    condition: (ctx) => ctx.total_cost >= 5_000,
  },
  {
    id: "century",
    image: "/badges/v1/century",
    name: "Century",
    description: "100+ sessions",
    praise: "Your first hundred sessions.",
    icon: "💯",
    category: "journey",
    rarity: "common",
    condition: (ctx) => ctx.total_sessions >= 100,
  },
  // ═══════════════════════════════════════
  // 6. COMMUNITY BADGES (초대 · 참여) - 5개
  // ═══════════════════════════════════════
  {
    id: "influencer",
    image: "/badges/v1/influencer",
    name: "Influencer",
    description: "Referred 10+ friends who joined",
    praise: "Ten people joined because of you.",
    icon: "📣",
    category: "community",
    rarity: "rare",
    condition: (ctx) => (ctx.referral_count ?? 0) >= 10,
  },
  {
    id: "networker",
    image: "/badges/v1/networker",
    name: "Networker",
    description: "Referred 3+ friends who joined",
    praise: "Three friends joined through you.",
    icon: "🔗",
    category: "community",
    rarity: "rare",
    condition: (ctx) => (ctx.referral_count ?? 0) >= 3,
  },
  {
    id: "recruiter",
    image: "/badges/v1/recruiter",
    name: "Recruiter",
    description: "Referred a friend who joined",
    praise: "Someone joined because you asked.",
    icon: "✉️",
    category: "community",
    rarity: "common",
    condition: (ctx) => (ctx.referral_count ?? 0) >= 1,
  },
  {
    id: "stargazer",
    image: "/badges/v1/stargazer",
    name: "Stargazer",
    description: "Starred CCgather on GitHub",
    praise: "Thanks for the star.",
    icon: "⭐",
    category: "community",
    rarity: "common",
    condition: (ctx) => ctx.github_starred === true,
  },
  {
    id: "autopilot",
    image: "/badges/v1/autopilot",
    name: "Autopilot",
    description: "Turned on automatic sync",
    praise: "Your streak keeps itself alive now.",
    icon: "🛰️",
    category: "community",
    rarity: "common",
    condition: (ctx) => ctx.auto_sync_enabled === true,
  },
];

export function getBadgeById(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}
