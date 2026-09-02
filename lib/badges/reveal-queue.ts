import { BADGES } from "@/lib/constants/badges";

export const REVEAL_SEEN_KEY = "ccg.badgeReveal.seenAt";

export interface EarnedBadgeRow {
  badge_type: string;
  earned_at: string;
}

const KNOWN_IDS = new Set(BADGES.filter((b) => b.image).map((b) => b.id));

export function selectUnseenBadgeIds(rows: EarnedBadgeRow[], seenAt: string | null): string[] {
  if (seenAt === null) return [];
  const seenMs = Date.parse(seenAt);
  return rows
    .filter((r) => KNOWN_IDS.has(r.badge_type) && Date.parse(r.earned_at) > seenMs)
    .sort((a, b) => Date.parse(a.earned_at) - Date.parse(b.earned_at))
    .map((r) => r.badge_type);
}

export function latestEarnedAt(rows: EarnedBadgeRow[], fallback: string): string {
  let latest = fallback;
  for (const r of rows) if (Date.parse(r.earned_at) > Date.parse(latest)) latest = r.earned_at;
  return latest;
}

export function readSeenAt(storage: Pick<Storage, "getItem">): string | null {
  try {
    const v = storage.getItem(REVEAL_SEEN_KEY);
    return v && !Number.isNaN(Date.parse(v)) ? v : null;
  } catch {
    return null;
  }
}

export function writeSeenAt(storage: Pick<Storage, "setItem">, iso: string): void {
  try {
    storage.setItem(REVEAL_SEEN_KEY, iso);
  } catch (err) {
    console.warn("[badgeReveal] failed to persist seenAt:", err);
  }
}
