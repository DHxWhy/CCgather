import { NextResponse } from 'next/server';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'usage' | 'rank' | 'special' | 'model';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

// All available badges
const BADGES: Badge[] = [
  // Usage badges
  {
    id: 'first-sync',
    name: 'First Steps',
    description: 'Synced usage data for the first time',
    icon: '🚀',
    category: 'usage',
    rarity: 'common',
  },
  {
    id: 'token-1k',
    name: 'Getting Started',
    description: 'Used 1,000 tokens',
    icon: '🌱',
    category: 'usage',
    rarity: 'common',
  },
  {
    id: 'token-10k',
    name: 'Active User',
    description: 'Used 10,000 tokens',
    icon: '⚡',
    category: 'usage',
    rarity: 'uncommon',
  },
  {
    id: 'token-100k',
    name: 'Power User',
    description: 'Used 100,000 tokens',
    icon: '💪',
    category: 'usage',
    rarity: 'rare',
  },
  {
    id: 'token-1m',
    name: 'Token Millionaire',
    description: 'Used 1,000,000 tokens',
    icon: '💎',
    category: 'usage',
    rarity: 'epic',
  },
  {
    id: 'token-10m',
    name: 'Token Billionaire',
    description: 'Used 10,000,000 tokens',
    icon: '🏆',
    category: 'usage',
    rarity: 'legendary',
  },

  // Rank badges
  {
    id: 'top-100',
    name: 'Top 100',
    description: 'Ranked in the top 100',
    icon: '🏅',
    category: 'rank',
    rarity: 'rare',
  },
  {
    id: 'top-10',
    name: 'Top 10',
    description: 'Ranked in the top 10',
    icon: '🥇',
    category: 'rank',
    rarity: 'epic',
  },
  {
    id: 'number-one',
    name: 'Champion',
    description: 'Achieved #1 rank',
    icon: '👑',
    category: 'rank',
    rarity: 'legendary',
  },

  // Model badges
  {
    id: 'opus-user',
    name: 'Opus Enthusiast',
    description: 'Used 10,000+ tokens on Claude Opus',
    icon: '🎭',
    category: 'model',
    rarity: 'uncommon',
  },
  {
    id: 'sonnet-user',
    name: 'Sonnet Maestro',
    description: 'Used 100,000+ tokens on Claude Sonnet',
    icon: '🎵',
    category: 'model',
    rarity: 'uncommon',
  },

  // Special badges
  {
    id: 'early-adopter',
    name: 'Early Adopter',
    description: 'Joined in the first month',
    icon: '🌟',
    category: 'special',
    rarity: 'rare',
  },
  {
    id: 'big-spender',
    name: 'Big Spender',
    description: 'Spent $100+ on API usage',
    icon: '💰',
    category: 'special',
    rarity: 'rare',
  },
];

export async function GET() {
  return NextResponse.json({
    badges: BADGES,
    categories: ['usage', 'rank', 'model', 'special'],
    rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
  });
}
