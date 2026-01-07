export interface Level {
  level: number;
  name: string;
  icon: string;
  minTokens: number;
  maxTokens: number;
  color: string;
}

export const LEVELS: Level[] = [
  {
    level: 1,
    name: 'Rookie',
    icon: '🌱',
    minTokens: 0,
    maxTokens: 10_000_000,
    color: '#22C55E',
  },
  {
    level: 2,
    name: 'Coder',
    icon: '⚡',
    minTokens: 10_000_000,
    maxTokens: 50_000_000,
    color: '#3B82F6',
  },
  {
    level: 3,
    name: 'Builder',
    icon: '🔨',
    minTokens: 50_000_000,
    maxTokens: 200_000_000,
    color: '#8B5CF6',
  },
  {
    level: 4,
    name: 'Architect',
    icon: '🏗️',
    minTokens: 200_000_000,
    maxTokens: 500_000_000,
    color: '#EC4899',
  },
  {
    level: 5,
    name: 'Expert',
    icon: '💎',
    minTokens: 500_000_000,
    maxTokens: 1_000_000_000,
    color: '#06B6D4',
  },
  {
    level: 6,
    name: 'Master',
    icon: '🔥',
    minTokens: 1_000_000_000,
    maxTokens: 3_000_000_000,
    color: '#F97316',
  },
  {
    level: 7,
    name: 'Grandmaster',
    icon: '⚔️',
    minTokens: 3_000_000_000,
    maxTokens: 10_000_000_000,
    color: '#EF4444',
  },
  {
    level: 8,
    name: 'Legend',
    icon: '👑',
    minTokens: 10_000_000_000,
    maxTokens: 30_000_000_000,
    color: '#EAB308',
  },
  {
    level: 9,
    name: 'Titan',
    icon: '🌟',
    minTokens: 30_000_000_000,
    maxTokens: 100_000_000_000,
    color: '#A855F7',
  },
  {
    level: 10,
    name: 'Immortal',
    icon: '🏆',
    minTokens: 100_000_000_000,
    maxTokens: Infinity,
    color: '#FFD700',
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

  const progress =
    ((tokens - current.minTokens) / (next.minTokens - current.minTokens)) * 100;
  return Math.min(Math.max(progress, 0), 100);
}
