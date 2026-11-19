import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { periodFromParam, searchWithPeriod } from "@/lib/leaderboard/url-period";

const read = (rel: string) => readFileSync(join(__dirname, "../..", rel), "utf8");
// 포매터가 줄을 어떻게 나누든 같은 코드로 보도록 공백을 접는다
const flat = (src: string) => src.replace(/\s+/g, " ");

describe("리더보드 기간 주소 (?period=)", () => {
  it("링크로 열 수 있는 기간만 받는다", () => {
    expect(periodFromParam("all")).toBe("all");
    expect(periodFromParam("1d")).toBe("1d");
    expect(periodFromParam("7d")).toBe("7d");
    expect(periodFromParam("30d")).toBe("30d");
    expect(periodFromParam("custom")).toBeNull();
    expect(periodFromParam("ALL")).toBeNull();
    expect(periodFromParam("")).toBeNull();
    expect(periodFromParam(null)).toBeNull();
  });

  it("기간을 주소에 남기고 다른 인자는 그대로 둔다", () => {
    expect(searchWithPeriod("?u=DHxWhy", "all")).toBe("?u=DHxWhy&period=all");
    expect(searchWithPeriod("?period=7d&u=a", "all")).toBe("?period=all&u=a");
    expect(searchWithPeriod("", "1d")).toBe("?period=1d");
  });

  it("기본 기간(30일)과 사용자 지정 범위는 주소에서 뺀다", () => {
    expect(searchWithPeriod("?period=all", "30d")).toBe("");
    expect(searchWithPeriod("?u=a&period=all", "30d")).toBe("?u=a");
    expect(searchWithPeriod("?period=7d", "custom")).toBe("");
    expect(searchWithPeriod("", "30d")).toBe("");
  });

  it("클라이언트는 주소의 기간으로 시작하고, 그 기간이 SSR 기간일 때만 SSR 행을 쓴다", () => {
    const src = read("components/leaderboard/LeaderboardPageClient.tsx");
    expect(src).toMatch(
      /periodFromParam\(searchParams\.get\("period"\)\) \?\? LEADERBOARD_DEFAULT_PERIOD/
    );
    expect(src).toMatch(
      /initialLeaderboard\?\.period === initialPeriod \? initialLeaderboard : null/
    );
    expect(src).toMatch(/useState<PeriodFilter>\(initialPeriod\)/);
  });

  it("기간을 바꾸면 주소도 바꾼다", () => {
    const src = flat(read("components/leaderboard/LeaderboardPageClient.tsx"));
    expect(src).toMatch(/searchWithPeriod\(window\.location\.search, periodFilter\)/);
    expect(src).toContain(
      'window.history.replaceState( null, "", `${window.location.pathname}${search}${window.location.hash}` )'
    );
  });
});
