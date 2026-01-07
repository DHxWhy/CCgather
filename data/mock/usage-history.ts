/**
 * Mock Usage History Data
 * =======================
 * Delete this folder when connecting to real API.
 */

export interface MockUsagePoint {
  date: string;
  tokens: number;
  cost: number;
  modelBreakdown: Record<string, number>;
}

export interface MockUserUsageHistory {
  userId: string;
  history: MockUsagePoint[];
}

// Model distribution
const MODELS = [
  { name: 'claude-3-5-sonnet-20241022', weight: 40 },
  { name: 'claude-3-5-haiku-20241022', weight: 30 },
  { name: 'claude-3-opus-20240229', weight: 15 },
  { name: 'claude-3-sonnet-20240229', weight: 10 },
  { name: 'claude-3-haiku-20240307', weight: 5 },
];

function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

function generateModelBreakdown(totalTokens: number, random: () => number): Record<string, number> {
  const breakdown: Record<string, number> = {};
  let remaining = totalTokens;

  for (let i = 0; i < MODELS.length - 1; i++) {
    const model = MODELS[i]!;
    const fraction = (model.weight / 100) * (0.5 + random());
    const tokens = Math.round(remaining * fraction);
    if (tokens > 0) {
      breakdown[model.name] = tokens;
      remaining -= tokens;
    }
  }

  // Last model gets remaining
  if (remaining > 0) {
    breakdown[MODELS[MODELS.length - 1]!.name] = remaining;
  }

  return breakdown;
}

export function generateUsageHistory(
  userId: string,
  totalTokens: number,
  days: number = 30,
  seed?: number
): MockUsagePoint[] {
  const random = seededRandom(seed ?? userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  const history: MockUsagePoint[] = [];

  const today = new Date();

  // Average daily tokens based on total
  const avgDailyTokens = totalTokens / days;

  // Generate history for each day with realistic variation
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayOfWeek = date.getDay();

    // Weekend factor (less usage on weekends)
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.4 + random() * 0.4 : 0.8 + random() * 0.6;

    // Random daily variation (0.3 to 2.0 of average)
    const variationFactor = 0.3 + random() * 1.7;

    // Occasional spike days (10% chance of 2-4x usage)
    const spikeFactor = random() > 0.9 ? 2 + random() * 2 : 1;

    // Occasional low days (15% chance of very low usage)
    const lowFactor = random() > 0.85 ? 0.1 + random() * 0.3 : 1;

    // Calculate daily tokens
    let dayTokens = Math.round(avgDailyTokens * weekendFactor * variationFactor * spikeFactor * lowFactor);

    // Ensure minimum visible tokens (at least 5% of average)
    dayTokens = Math.max(dayTokens, Math.round(avgDailyTokens * 0.05));

    // Cost calculation (blended rate ~$0.036 per 1000 tokens)
    const cost = Math.round(dayTokens * 0.000036 * 100) / 100;

    history.push({
      date: date.toISOString().split('T')[0]!,
      tokens: dayTokens,
      cost,
      modelBreakdown: generateModelBreakdown(dayTokens, random),
    });
  }

  return history;
}

// Pre-generate some user histories for demo
export const MOCK_USER_HISTORIES: Map<string, MockUsagePoint[]> = new Map();

// This will be populated on demand
export function getMockUserHistory(userId: string, totalTokens: number, days: number = 90): MockUsagePoint[] {
  const cacheKey = `${userId}-${totalTokens}-${days}`;
  if (!MOCK_USER_HISTORIES.has(cacheKey)) {
    MOCK_USER_HISTORIES.set(cacheKey, generateUsageHistory(userId, totalTokens, days));
  }
  return MOCK_USER_HISTORIES.get(cacheKey)!;
}
