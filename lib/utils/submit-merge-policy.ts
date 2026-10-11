/**
 * Merge-policy helpers for /api/cli/submit.
 *
 * A resubmitted date may only move its stored row "up". Tokens are guarded in
 * the route itself: a lower total skips the row. Sessions need a separate rule.
 * The CLI's session definition changed (PR #33: subagent transcripts are no
 * longer counted as sessions, a session with subagents counts once), so a
 * re-scan of an old date legitimately carries a *lower* sessions value while
 * its tokens stay the same or rise. Such rows must still be written for the
 * tokens, but the stored session count is kept so history does not shrink.
 */

/**
 * Raise `sessions` to the stored count wherever the stored count is higher.
 * Records that need no change are returned as the same object.
 */
export function floorSessionsToStored<T extends { date: string; sessions: number }>(
  records: readonly T[],
  storedSessionsFor: (date: string) => number
): T[] {
  return records.map((record) => {
    const stored = storedSessionsFor(record.date);
    return stored > record.sessions ? { ...record, sessions: stored } : record;
  });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Earliest well-formed `YYYY-MM-DD` among the submitted dates, or `fallback`
 * when none is usable. Used to bound the stored-row prefetch to the dates a
 * submission can touch; malformed entries are rejected later by the route's
 * own validation and must not widen or break the query here.
 */
export function earliestSubmittedDate(dates: readonly unknown[], fallback: string): string {
  let earliest: string | null = null;
  for (const d of dates) {
    if (typeof d !== "string" || !ISO_DATE.test(d)) continue;
    if (earliest === null || d < earliest) earliest = d;
  }
  return earliest ?? fallback;
}
