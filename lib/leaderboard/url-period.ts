import type { PeriodFilter } from "@/lib/types";
import { LEADERBOARD_DEFAULT_PERIOD } from "@/lib/leaderboard/initial-shared";

// A custom date range has no link of its own: it opens on the default period.
const LINKABLE_PERIODS: readonly string[] = ["1d", "7d", "30d", "all"] satisfies PeriodFilter[];

export function periodFromParam(value: string | null): PeriodFilter | null {
  return value !== null && LINKABLE_PERIODS.includes(value) ? (value as PeriodFilter) : null;
}

/** The query string with `period` set, other parameters kept; the default period is left out. */
export function searchWithPeriod(search: string, period: PeriodFilter): string {
  const params = new URLSearchParams(search);
  if (period === LEADERBOARD_DEFAULT_PERIOD || periodFromParam(period) === null) {
    params.delete("period");
  } else {
    params.set("period", period);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
