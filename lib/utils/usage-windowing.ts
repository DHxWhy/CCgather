import type { UsageHistoryPoint } from "@/lib/types";

export interface ChartPoint {
  label: string;
  tokens: number;
}

export interface UsageStats {
  total: number;
  avgDaily: number;
  activeDays: number;
}

export interface MonthBounds {
  min: string;
  max: string;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function getAvailableYears(history: UsageHistoryPoint[]): number[] {
  const years = new Set<number>();
  for (const d of history) years.add(Number(d.date.slice(0, 4)));
  return Array.from(years).sort((a, b) => b - a);
}

export function getYearPoints(history: UsageHistoryPoint[], year: number): ChartPoint[] {
  const prefix = String(year);
  return history
    .filter((d) => d.date.startsWith(prefix))
    .map((d) => ({ label: d.date.slice(5), tokens: d.tokens }));
}

export function getMonthBounds(history: UsageHistoryPoint[]): MonthBounds | null {
  if (history.length === 0) return null;
  let min = history[0]!.date.slice(0, 7);
  let max = min;
  for (const d of history) {
    const month = d.date.slice(0, 7);
    if (month < min) min = month;
    if (month > max) max = month;
  }
  return { min, max };
}

export function shiftMonth(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const total = year * 12 + monthIndex + delta;
  const newYear = Math.floor(total / 12);
  const newMonthIndex = ((total % 12) + 12) % 12;
  return `${newYear}-${String(newMonthIndex + 1).padStart(2, "0")}`;
}

export function getMonthWindow(bounds: MonthBounds, focus: string): string[] {
  const candidates = [shiftMonth(focus, -1), focus, shiftMonth(focus, 1)];
  return candidates.filter((m) => m >= bounds.min && m <= bounds.max);
}

export function daysInMonth(month: string): number {
  const year = Number(month.slice(0, 4));
  const monthNum = Number(month.slice(5, 7));
  return new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
}

export function getMonthPoints(history: UsageHistoryPoint[], month: string): ChartPoint[] {
  const byDay = new Map<string, number>();
  for (const d of history) {
    if (d.date.startsWith(month)) byDay.set(d.date.slice(8, 10), d.tokens);
  }
  const total = daysInMonth(month);
  const points: ChartPoint[] = [];
  for (let day = 1; day <= total; day++) {
    const dd = String(day).padStart(2, "0");
    points.push({ label: String(day), tokens: byDay.get(dd) ?? 0 });
  }
  return points;
}

export function computeStats(points: ReadonlyArray<{ tokens: number }>): UsageStats {
  let total = 0;
  let activeDays = 0;
  for (const p of points) {
    total += p.tokens;
    if (p.tokens > 0) activeDays += 1;
  }
  return {
    total,
    avgDaily: activeDays > 0 ? Math.round(total / activeDays) : 0,
    activeDays,
  };
}

export function formatMonthLabel(month: string, opts?: { withYear?: boolean }): string {
  const year = month.slice(0, 4);
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const name = MONTH_NAMES[monthIndex] ?? month.slice(5, 7);
  return opts?.withYear ? `${name} ${year}` : name;
}
