import { describe, expect, it } from "vitest";
import {
  latestEarnedAt,
  readSeenAt,
  REVEAL_SEEN_KEY,
  selectUnseenBadgeIds,
  writeSeenAt,
} from "@/lib/badges/reveal-queue";
import { BADGES } from "@/lib/constants/badges";

// 카탈로그에서 실제 id 를 가져온다 — 배지가 바뀌어도 픽스처가 썩지 않도록
const [known1, known2, known3] = BADGES.map((b) => b.id);

const rows = [
  { badge_type: known1!, earned_at: "2026-09-01T10:00:00Z" },
  { badge_type: known2!, earned_at: "2026-09-02T10:00:00Z" },
  { badge_type: "unknown_badge", earned_at: "2026-09-03T10:00:00Z" },
  { badge_type: known3!, earned_at: "2026-09-03T09:00:00Z" },
];

describe("selectUnseenBadgeIds", () => {
  it("첫 방문(seenAt 없음)에는 아무것도 띄우지 않는다 — 과거 배지 폭주 방지", () => {
    expect(selectUnseenBadgeIds(rows, null)).toEqual([]);
  });

  it("seenAt 이후에 얻은 알려진 배지만, 오래된 것부터 순서대로 돌려준다", () => {
    expect(selectUnseenBadgeIds(rows, "2026-09-01T12:00:00Z")).toEqual([known2, known3]);
  });

  it("카탈로그에 없는 badge_type 은 제외한다", () => {
    expect(selectUnseenBadgeIds(rows, "2026-09-03T09:30:00Z")).toEqual([]);
  });
});

describe("latestEarnedAt", () => {
  it("가장 최근 earned_at 을 돌려주고, 없으면 fallback 을 쓴다", () => {
    expect(latestEarnedAt(rows, "2020-01-01T00:00:00Z")).toBe("2026-09-03T10:00:00Z");
    expect(latestEarnedAt([], "2020-01-01T00:00:00Z")).toBe("2020-01-01T00:00:00Z");
  });
});

describe("seenAt storage", () => {
  it("유효한 ISO 만 읽고, 깨진 값·예외는 null 로 처리한다", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    expect(readSeenAt(storage)).toBeNull();
    writeSeenAt(storage, "2026-09-03T00:00:00Z");
    expect(store.get(REVEAL_SEEN_KEY)).toBe("2026-09-03T00:00:00Z");
    expect(readSeenAt(storage)).toBe("2026-09-03T00:00:00Z");
    store.set(REVEAL_SEEN_KEY, "not-a-date");
    expect(readSeenAt(storage)).toBeNull();
    expect(
      readSeenAt({
        getItem: () => {
          throw new Error("blocked");
        },
      })
    ).toBeNull();
  });
});
