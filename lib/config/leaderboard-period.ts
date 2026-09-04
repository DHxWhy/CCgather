import { formatInTimeZone } from "date-fns-tz";
import { subDays } from "date-fns";

export type LeaderboardPeriod = "1d" | "7d" | "30d" | "all" | "custom";

export interface PeriodDateRange {
  startDate: string;
  endDate: string;
}

// 오늘 포함 N일 (SSOT). 공개 /stats RPC(get_public_stats_summary = CURRENT_DATE - 29)와 창 길이 일치
export const PERIOD_DAYS = { "1d": 1, "7d": 7, "30d": 30 } as const;

export function getPeriodDateRange(
  period: LeaderboardPeriod,
  customStart?: string | null,
  customEnd?: string | null,
  timezone?: string | null
): PeriodDateRange | null {
  if (period === "all") return null;

  if (period === "custom") {
    return customStart && customEnd ? { startDate: customStart, endDate: customEnd } : null;
  }

  const days = PERIOD_DAYS[period];
  if (!days) return null;

  const now = new Date();
  const inZone = (tz: string): PeriodDateRange => ({
    startDate: formatInTimeZone(subDays(now, days - 1), tz, "yyyy-MM-dd"),
    endDate: formatInTimeZone(now, tz, "yyyy-MM-dd"),
  });

  try {
    return inZone(timezone || "UTC");
  } catch {
    return inZone("UTC");
  }
}
