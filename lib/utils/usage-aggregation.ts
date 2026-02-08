export interface AggregatedDay {
  date: string;
  tokens: number;
  cost: number;
}

/**
 * Aggregate rows by date, summing tokens and cost.
 * Handles null/undefined input, duplicate dates (multi-device), and returns sorted by date.
 */
export function aggregateByDate<T>(
  rows: T[] | null | undefined,
  getDate: (row: T) => string,
  getTokens: (row: T) => number,
  getCost: (row: T) => number
): AggregatedDay[] {
  const dailyMap = new Map<string, { tokens: number; cost: number }>();
  for (const row of rows || []) {
    const date = getDate(row);
    const existing = dailyMap.get(date);
    if (existing) {
      existing.tokens += getTokens(row);
      existing.cost += getCost(row);
    } else {
      dailyMap.set(date, { tokens: getTokens(row), cost: getCost(row) });
    }
  }
  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, tokens: data.tokens, cost: data.cost }));
}
