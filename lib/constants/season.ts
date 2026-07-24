/**
 * Season boundary contract — MUST stay in sync with
 * supabase/migrations/074_season_sprint.sql
 *   current_season_start() : date_trunc('month', now() AT TIME ZONE 'UTC')
 *   season_finalized(m)    : m + 1 month + GRACE_DAYS days + FINALIZE_MINUTE minutes
 * A ticking countdown cannot round-trip to the DB every second, so the same
 * two constants exist here. Changing one without the other silently splits the
 * live board from the frozen record.
 */
export const SEASON_FINALIZE_GRACE_DAYS = 3;
export const SEASON_FINALIZE_MINUTE = 5;
export const SEASON_ONE_MONTH = "2026-07-01";

export function currentSeasonStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function previousSeasonStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}

export function seasonEndAt(monthStart: Date): Date {
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
}

export function monthKeyToDate(monthKey: string): Date {
  return new Date(`${monthKey}T00:00:00Z`);
}

export function seasonFinalizeAt(monthStart: Date): Date {
  return new Date(
    Date.UTC(
      monthStart.getUTCFullYear(),
      monthStart.getUTCMonth() + 1,
      1 + SEASON_FINALIZE_GRACE_DAYS,
      0,
      SEASON_FINALIZE_MINUTE
    )
  );
}

export function isSeasonFinalized(monthStart: Date, now: Date = new Date()): boolean {
  return now.getTime() >= seasonFinalizeAt(monthStart).getTime();
}

export function toMonthKey(monthStart: Date): string {
  return monthStart.toISOString().slice(0, 10);
}

export function seasonLabel(monthStart: Date): string {
  return monthStart.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
