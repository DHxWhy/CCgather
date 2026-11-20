import { beforeEach, describe, expect, it, vi } from "vitest";

type Settle = (value: unknown) => unknown;

const db = vi.hoisted(() => ({ rpc: vi.fn(), count: vi.fn(), rows: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    rpc: db.rpc,
    from: () => {
      let headOnly = false;
      const builder = {
        select: (_columns: string, options?: { head?: boolean }) => {
          headOnly = Boolean(options?.head);
          return builder;
        },
        eq: () => builder,
        is: () => builder,
        then: (resolve: Settle, reject: Settle) =>
          Promise.resolve(headOnly ? db.count() : db.rows()).then(resolve, reject),
      };
      return builder;
    },
  }),
}));

import { getGlobalStats } from "@/lib/data/global-stats";

const ROW = {
  developers: 297,
  countries: 45,
  tokens_all_time: 7_480_795_150_564,
  cost_all_time: 4_652_762.77,
  tokens_30d: 1_457_815_525_100,
  countries_30d: 23,
  countries_24h: 11,
};

describe("getGlobalStats — 랜딩 숫자", () => {
  beforeEach(() => {
    db.rpc.mockReset();
    db.count.mockReset();
    db.rows.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("DB 함수 한 번으로 가입 수 · 나라 수 · 누적 토큰 · 비용과 30일 · 24시간 활동을 읽는다", async () => {
    db.rpc.mockResolvedValueOnce({ data: [ROW], error: null });

    expect(await getGlobalStats()).toEqual({
      totalUsers: 297,
      totalCountries: 45,
      totalTokens: 7_480_795_150_564,
      totalCost: 4_652_762.77,
      showStats: true,
      activity: { tokens30d: 1_457_815_525_100, countries30d: 23, countries24h: 11 },
    });
    expect(db.rpc).toHaveBeenCalledWith("get_live_activity");
    expect(db.count).not.toHaveBeenCalled();
    expect(db.rows).not.toHaveBeenCalled();
  });

  it("숫자가 문자열로 와도 읽는다", async () => {
    const asText = Object.fromEntries(
      Object.entries(ROW).map(([key, value]) => [key, String(value)])
    );
    db.rpc.mockResolvedValueOnce({ data: [asText], error: null });

    const stats = await getGlobalStats();

    expect(stats.totalTokens).toBe(7_480_795_150_564);
    expect(stats.activity).toEqual({
      tokens30d: 1_457_815_525_100,
      countries30d: 23,
      countries24h: 11,
    });
  });

  it("공개 기준(가입 100명 · 10개 나라 · 1,000억 토큰)에 못 미치면 숫자를 숨긴다", async () => {
    const atLine = { ...ROW, developers: 100, countries: 10, tokens_all_time: 100_000_000_000 };
    const cases: [Record<string, number>, boolean][] = [
      [atLine, true],
      [{ ...atLine, developers: 99 }, false],
      [{ ...atLine, countries: 9 }, false],
      [{ ...atLine, tokens_all_time: 99_999_999_999 }, false],
    ];
    for (const [row, shown] of cases) {
      db.rpc.mockResolvedValueOnce({ data: [row], error: null });
      expect((await getGlobalStats()).showStats, JSON.stringify(row)).toBe(shown);
    }
  });

  it("DB 함수가 실패하면 회원 행을 세는 옛 방식으로 돌아가고 활동 숫자는 없다", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "function not found" } });
    db.count.mockResolvedValueOnce({ count: 3, error: null });
    db.rows.mockResolvedValueOnce({
      data: [
        { country_code: "KR", total_tokens: 10, total_cost: 1.5 },
        { country_code: "US", total_tokens: 5, total_cost: 0.5 },
        { country_code: null, total_tokens: 0, total_cost: 0 },
      ],
      error: null,
    });

    expect(await getGlobalStats()).toEqual({
      totalUsers: 3,
      totalCountries: 2,
      totalTokens: 15,
      totalCost: 2,
      showStats: false,
    });
  });

  it("행 모양이 다르면(빠진 칸 · 음수 · 빈 결과) 옛 방식으로 센다", async () => {
    const { countries_24h: _dropped, ...missing } = ROW;
    for (const data of [[missing], [{ ...ROW, developers: -1 }], []]) {
      db.rpc.mockResolvedValueOnce({ data, error: null });
      db.count.mockResolvedValueOnce({ count: 1, error: null });
      db.rows.mockResolvedValueOnce({
        data: [{ country_code: "KR", total_tokens: 1, total_cost: 0 }],
        error: null,
      });

      const stats = await getGlobalStats();

      expect(stats.totalUsers, JSON.stringify(data)).toBe(1);
      expect(stats).not.toHaveProperty("activity");
    }
  });

  it("오류가 함께 오면 행이 있어도 믿지 않고 옛 방식으로 센다", async () => {
    db.rpc.mockResolvedValueOnce({ data: [ROW], error: { message: "statement timeout" } });
    db.count.mockResolvedValueOnce({ count: 1, error: null });
    db.rows.mockResolvedValueOnce({
      data: [{ country_code: "KR", total_tokens: 1, total_cost: 0 }],
      error: null,
    });

    const stats = await getGlobalStats();

    expect(stats.totalUsers).toBe(1);
    expect(stats).not.toHaveProperty("activity");
  });
});
