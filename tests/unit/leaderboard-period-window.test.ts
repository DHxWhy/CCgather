import { describe, it, expect } from "vitest";
import { PERIOD_DAYS, getPeriodDateRange } from "../../lib/config/leaderboard-period";

function dayCount(range: { startDate: string; endDate: string }): number {
  const start = Date.parse(`${range.startDate}T00:00:00Z`);
  const end = Date.parse(`${range.endDate}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

describe("getPeriodDateRange", () => {
  it("라벨과 같은 일수를 반환한다 (오늘 포함)", () => {
    for (const period of ["1d", "7d", "30d"] as const) {
      const range = getPeriodDateRange(period, null, null, "UTC");
      expect(range).not.toBeNull();
      expect(dayCount(range!)).toBe(PERIOD_DAYS[period]);
    }
  });

  it("all 은 범위 없음(전체 누적)", () => {
    expect(getPeriodDateRange("all", null, null, "UTC")).toBeNull();
  });

  it("custom 은 받은 날짜를 그대로, 불완전하면 null", () => {
    expect(getPeriodDateRange("custom", "2026-01-01", "2026-02-01", "UTC")).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-02-01",
    });
    expect(getPeriodDateRange("custom", "2026-01-01", null, "UTC")).toBeNull();
  });

  it("잘못된 타임존은 UTC 로 폴백하고 일수를 유지한다", () => {
    const range = getPeriodDateRange("30d", null, null, "Not/AZone");
    expect(range).not.toBeNull();
    expect(dayCount(range!)).toBe(PERIOD_DAYS["30d"]);
  });

  it("타임존별 경계가 달라도 창 길이는 같다", () => {
    for (const tz of ["UTC", "Asia/Seoul", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      expect(dayCount(getPeriodDateRange("7d", null, null, tz)!)).toBe(PERIOD_DAYS["7d"]);
    }
  });
});
