import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEADERBOARD_DEFAULT_PERIOD,
  LEADERBOARD_PAGE_SIZE,
  SSR_ROW_COUNT,
  toDisplayUsers,
} from "@/lib/leaderboard/initial-shared";
import type { LeaderboardUser } from "@/lib/types";

const read = (p: string) => readFileSync(path.resolve(__dirname, "../../", p), "utf-8");

const user = (over: Partial<LeaderboardUser>): LeaderboardUser => ({
  id: "u",
  username: "alice",
  display_name: null,
  avatar_url: null,
  country_code: "KR",
  current_level: 1,
  global_rank: null,
  country_rank: null,
  total_tokens: 10,
  total_cost: 1,
  ...over,
});

describe("toDisplayUsers", () => {
  it("기간 필터면 period_rank 를, 없으면 페이지 오프셋 순번을 쓴다", () => {
    const rows = toDisplayUsers([user({ period_rank: 7 }), user({ id: "v" })], 2, "30d", null);
    expect(rows[0]!.rank).toBe(7);
    expect(rows[1]!.rank).toBe(LEADERBOARD_PAGE_SIZE + 2);
  });

  it("all 은 항상 페이지 오프셋 순번, period 값이 없으면 total 로 대체", () => {
    const [row] = toDisplayUsers([user({ period_rank: 7, total_tokens: 99 })], 1, "all", null);
    expect(row!.rank).toBe(1);
    expect(row!.periodTokens).toBe(99);
  });

  it("isCurrentUser 는 대소문자 무시, 로그인 전(null)엔 항상 false", () => {
    expect(toDisplayUsers([user({})], 1, "30d", "ALICE")[0]!.isCurrentUser).toBe(true);
    expect(toDisplayUsers([user({})], 1, "30d", null)[0]!.isCurrentUser).toBe(false);
  });
});

describe("리더보드 SSR 배선", () => {
  it("page.tsx 는 서버 컴포넌트로 초기 데이터를 받아 클라이언트에 넘긴다", () => {
    const src = read("app/(main)/leaderboard/page.tsx");
    expect(src).not.toContain('"use client"');
    expect(src).toContain("x-vercel-ip-timezone");
    expect(src).toMatch(/fetchInitialLeaderboard\(/);
    expect(src).toMatch(/<LeaderboardPageClient initialLeaderboard=\{initialLeaderboard\}/);
  });

  it("클라이언트는 SSR 데이터로 초기 상태를 만들고 가상 테이블에 SSR 행 수를 준다", () => {
    const src = read("components/leaderboard/LeaderboardPageClient.tsx");
    expect(src).toMatch(/useState\(!ssr\)/);
    expect(src).toMatch(/skipMountFetchRef/);
    expect(src).toMatch(/initialItemCount=\{Math\.min\(users\.length, SSR_ROW_COUNT\)\}/);
    expect(SSR_ROW_COUNT).toBeLessThanOrEqual(LEADERBOARD_PAGE_SIZE);
    expect(LEADERBOARD_DEFAULT_PERIOD).toBe("30d");
  });

  it("initial-shared 는 런타임 import 가 없다", () => {
    const src = read("lib/leaderboard/initial-shared.ts");
    expect(src.match(/^import (?!type )/gm)).toBeNull();
  });

  it("지구본은 유휴 시점에 마운트한다", () => {
    const src = read("components/leaderboard/GlobeStatsSection.tsx");
    expect(src).toContain("requestIdleCallback");
    expect(src).toMatch(/\{!loading && idle && \(/);
  });
});
