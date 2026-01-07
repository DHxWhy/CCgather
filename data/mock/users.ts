/**
 * Mock Data for Development
 * ========================
 * This entire folder can be deleted when connecting to real API.
 * Simply remove the `data/mock` directory and update imports.
 */

export interface MockUser {
  id: string;
  rank: number;
  username: string;
  avatarUrl: string | null;
  country: string;
  totalTokens: number;
  totalSpent: number;
  badges: string[];
  isCurrentUser?: boolean;
  createdAt: string;
  lastSyncAt: string;
}

// Country distribution with realistic weights
const COUNTRIES = [
  { code: 'US', weight: 25 },
  { code: 'KR', weight: 15 },
  { code: 'JP', weight: 12 },
  { code: 'DE', weight: 10 },
  { code: 'GB', weight: 8 },
  { code: 'CN', weight: 8 },
  { code: 'FR', weight: 5 },
  { code: 'CA', weight: 5 },
  { code: 'AU', weight: 4 },
  { code: 'IN', weight: 4 },
  { code: 'BR', weight: 2 },
  { code: 'SG', weight: 2 },
];


// Username prefixes for variety
const USERNAME_PREFIXES = [
  'dev', 'code', 'tech', 'ai', 'ml', 'data', 'cloud', 'cyber', 'web', 'app',
  'ninja', 'guru', 'master', 'pro', 'elite', 'super', 'mega', 'ultra', 'hyper',
  'pixel', 'byte', 'bit', 'node', 'react', 'next', 'vue', 'rust', 'go', 'py',
];

const USERNAME_SUFFIXES = [
  'coder', 'dev', 'hacker', 'builder', 'maker', 'creator', 'wizard', 'sage',
  '42', '99', '2024', '101', 'x', 'io', 'lab', 'hub', 'ops', 'eng',
];

// Seeded random for consistent data
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

function pickWeighted<T extends { weight: number }>(items: T[], random: () => number): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let r = random() * totalWeight;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1]!;
}

function generateUsername(index: number, random: () => number): string {
  const prefix = USERNAME_PREFIXES[Math.floor(random() * USERNAME_PREFIXES.length)]!;
  const suffix = USERNAME_SUFFIXES[Math.floor(random() * USERNAME_SUFFIXES.length)]!;
  // Use index to ensure unique usernames
  const num = index + Math.floor(random() * 100);

  // Variety in username formats
  const formats = [
    `${prefix}${suffix}${num}`,
    `${prefix}_${suffix}${num}`,
    `${prefix}${num}`,
    `the_${prefix}${num}`,
    `${prefix}.${suffix}${num}`,
  ];

  return formats[index % formats.length]!;
}

function generateBadges(rank: number, tokens: number, random: () => number): string[] {
  const badges: string[] = [];

  // Rank-based badges
  if (rank === 1) badges.push('number-one', 'top-10');
  else if (rank <= 10) badges.push('top-10');
  else if (rank <= 100) badges.push('top-100');

  // Token-based badges
  if (tokens >= 10_000_000_000) badges.push('token-10b');
  else if (tokens >= 1_000_000_000) badges.push('token-1b');
  else if (tokens >= 100_000_000) badges.push('token-100m');
  else if (tokens >= 10_000_000) badges.push('token-10m');
  else if (tokens >= 1_000_000) badges.push('token-1m');

  // Random badges
  if (random() > 0.7) badges.push('opus-user');
  if (random() > 0.8) badges.push('sonnet-user');
  if (random() > 0.9) badges.push('early-adopter');

  badges.push('first-sync');

  return badges;
}

function generateDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

// Generate mock users with realistic distribution
export function generateMockUsers(count: number = 100, seed: number = 12345): MockUser[] {
  const random = seededRandom(seed);
  const users: MockUser[] = [];

  // Token distribution follows power law (top users have much more)
  const baseTokens = 15_000_000_000; // 15B for rank 1

  for (let i = 0; i < count; i++) {
    const rank = i + 1;
    const country = pickWeighted(COUNTRIES, random);

    // Power law distribution: tokens decrease exponentially with rank
    // With some randomness for realism
    const rankFactor = Math.pow(0.92, rank - 1); // Exponential decay
    const randomFactor = 0.7 + random() * 0.6; // 0.7 to 1.3

    const totalTokens = Math.round(baseTokens * rankFactor * randomFactor);

    // Cost in $10,000 range max (e.g., $500 to $50,000)
    // Top user ~$50,000, lower ranks scale down proportionally
    const baseCost = 50000; // Max cost for rank 1
    const costFactor = Math.pow(0.93, rank - 1); // Similar decay to tokens
    const costRandomFactor = 0.6 + random() * 0.8; // 0.6 to 1.4
    const totalSpent = Math.round(baseCost * costFactor * costRandomFactor);

    const username = generateUsername(i, random);
    const badges = generateBadges(rank, totalTokens, random);

    users.push({
      id: `user-${rank}-${username}`,
      rank,
      username,
      avatarUrl: random() > 0.3 ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}` : null,
      country: country.code,
      totalTokens,
      totalSpent,
      badges,
      isCurrentUser: rank === 42, // Mark rank 42 as current user for demo
      createdAt: generateDate(Math.floor(random() * 365)),
      lastSyncAt: generateDate(Math.floor(random() * 7)),
    });
  }

  // Sort by tokens descending and reassign ranks
  users.sort((a, b) => b.totalTokens - a.totalTokens);
  users.forEach((user, index) => {
    user.rank = index + 1;
  });

  return users;
}

// All badge IDs for special user (updated to match new badge system)
const ALL_BADGE_IDS = [
  // Streak (6)
  'streak_180', 'streak_90', 'streak_60', 'streak_30', 'streak_14', 'streak_7',
  // Tokens (6)
  '10b_club', 'billion_club', 'whale', 'hundred_million', 'big_spender', 'first_million',
  // Rank (6)
  'global_first', 'top_3', 'trailblazer', 'country_first', 'top_50', 'rising_star',
  // Model (4)
  'opus_lover', 'sonnet_master', 'model_explorer', 'haiku_ninja',
  // Social (5)
  'social_legend', 'social_star', 'influencer', 'networker', 'recruiter'
];

// Special user pyx673 with all badges
const SPECIAL_USER: MockUser = {
  id: 'user-special-pyx673',
  rank: 1,
  username: 'pyx673',
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=pyx673',
  country: 'KR',
  totalTokens: 20_000_000_000, // 20B tokens - highest
  totalSpent: 75000,
  badges: ALL_BADGE_IDS,
  isCurrentUser: false,
  createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  lastSyncAt: new Date().toISOString(),
};

// Pre-generated data for consistent development experience
const generatedUsers = generateMockUsers(99); // Generate 99 + 1 special = 100 total
// Add special user and re-sort
generatedUsers.push(SPECIAL_USER);
generatedUsers.sort((a, b) => b.totalTokens - a.totalTokens);
generatedUsers.forEach((user, index) => {
  user.rank = index + 1;
});

export const MOCK_USERS: MockUser[] = generatedUsers;

// Get users filtered by country
export function getMockUsersByCountry(country: string): MockUser[] {
  if (country === 'all') return MOCK_USERS;
  return MOCK_USERS.filter(user => user.country === country);
}


// Search users by username
export function searchMockUsers(query: string): MockUser[] {
  if (!query) return MOCK_USERS;
  const lowercaseQuery = query.toLowerCase();
  return MOCK_USERS.filter(user =>
    user.username.toLowerCase().includes(lowercaseQuery)
  );
}

// Get paginated users
export function getPaginatedMockUsers(
  page: number = 1,
  perPage: number = 20,
  filters?: {
    country?: string;
    search?: string;
  }
): { users: MockUser[]; total: number; totalPages: number } {
  let filtered = [...MOCK_USERS];

  if (filters?.country && filters.country !== 'all') {
    filtered = filtered.filter(u => u.country === filters.country);
  }


  if (filters?.search) {
    const query = filters.search.toLowerCase();
    filtered = filtered.filter(u => u.username.toLowerCase().includes(query));
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const users = filtered.slice(start, start + perPage);

  return { users, total, totalPages };
}
