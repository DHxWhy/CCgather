export interface Level {
  level: number;
  name: string;
  icon: string;
  minTokens: number;
  maxTokens: number;
  color: string;
}

// Level thresholds - synced with CLI (packages/cli/src/lib/ui.ts)
// Max user benchmark: ~1B tokens per 3 days
export const LEVELS: Level[] = [
  {
    level: 1,
    name: "Novice",
    icon: "🌱",
    minTokens: 0,
    maxTokens: 50_000_000,
    color: "#6B7280", // Gray
  },
  {
    level: 2,
    name: "Apprentice",
    icon: "📚",
    minTokens: 50_000_000,
    maxTokens: 200_000_000,
    color: "#71717A", // Muted
  },
  {
    level: 3,
    name: "Journeyman",
    icon: "⚡",
    minTokens: 200_000_000,
    maxTokens: 500_000_000,
    color: "#06B6D4", // Cyan
  },
  {
    level: 4,
    name: "Expert",
    icon: "💎",
    minTokens: 500_000_000,
    maxTokens: 1_000_000_000,
    color: "#3B82F6", // Blue
  },
  {
    level: 5,
    name: "Master",
    icon: "🔥",
    minTokens: 1_000_000_000,
    maxTokens: 3_000_000_000,
    color: "#F59E0B", // Amber
  },
  {
    level: 6,
    name: "Grandmaster",
    icon: "👑",
    minTokens: 3_000_000_000,
    maxTokens: 10_000_000_000,
    color: "#EAB308", // Gold
  },
  {
    level: 7,
    name: "Legend",
    icon: "🌟",
    minTokens: 10_000_000_000,
    maxTokens: 30_000_000_000,
    color: "#DA7756", // Coral
  },
  {
    level: 8,
    name: "Mythic",
    icon: "🏆",
    minTokens: 30_000_000_000,
    maxTokens: 50_000_000_000,
    color: "#F97316", // Orange
  },
  {
    level: 9,
    name: "Immortal",
    icon: "💫",
    minTokens: 50_000_000_000,
    maxTokens: 100_000_000_000,
    color: "#8B5CF6", // Purple
  },
  {
    level: 10,
    name: "Transcendent",
    icon: "🌌",
    minTokens: 100_000_000_000,
    maxTokens: Infinity,
    color: "#FFFFFF", // White
  },
];

export function getLevelByTokens(tokens: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    const level = LEVELS[i];
    if (level && tokens >= level.minTokens) {
      return level;
    }
  }
  return LEVELS[0]!;
}

export function getLevelByNumber(levelNum: number): Level {
  return LEVELS[levelNum - 1] ?? LEVELS[0]!;
}

export function getProgressToNextLevel(tokens: number): number {
  const current = getLevelByTokens(tokens);
  if (current.level === 10) return 100;

  const next = LEVELS[current.level];
  if (!next) return 100;

  const progress = ((tokens - current.minTokens) / (next.minTokens - current.minTokens)) * 100;
  return Math.min(Math.max(progress, 0), 100);
}
