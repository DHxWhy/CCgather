import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ global: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/global-stats", () => ({ getGlobalStats: mocks.global }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }));

import { getLiveNumbers } from "@/lib/seo/live-numbers";

const NOW = new Date("2026-11-19T06:00:00Z");
const GLOBAL = {
  totalUsers: 296,
  totalCountries: 45,
  totalTokens: 7_424_227_228_738,
  totalCost: 4_631_452,
  showStats: true,
};

describe("getLiveNumbers — 랜딩 · /stats 와 같은 숫자", () => {
  beforeEach(() => {
    mocks.global.mockReset();
    mocks.rpc.mockReset();
  });

  it("DB 함수의 활동 숫자가 있으면 30일 토큰 · 30일 나라 · 24시간 나라를 거기서 쓰고 /stats 요약은 부르지 않는다", async () => {
    mocks.global.mockResolvedValueOnce({
      ...GLOBAL,
      activity: { tokens30d: 1_457_815_525_100, countries30d: 23, countries24h: 11 },
    });

    expect(await getLiveNumbers(NOW)).toEqual({
      asOf: "2026-11-19",
      developers: 296,
      countries: 45,
      tokensAllTime: 7_424_227_228_738,
      tokens30d: 1_457_815_525_100,
      countries30d: 23,
      countries24h: 11,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("활동 숫자 가운데 0 인 것은 뺀다", async () => {
    mocks.global.mockResolvedValueOnce({
      ...GLOBAL,
      activity: { tokens30d: 5, countries30d: 0, countries24h: 0 },
    });

    expect(await getLiveNumbers(NOW)).toEqual({
      asOf: "2026-11-19",
      developers: 296,
      countries: 45,
      tokensAllTime: 7_424_227_228_738,
      tokens30d: 5,
    });
  });

  it("DB 함수 값이 없으면 랜딩의 누적 · 가입 수와 /stats 요약의 30일 토큰을 쓴다", async () => {
    mocks.global.mockResolvedValueOnce(GLOBAL);
    mocks.rpc.mockResolvedValueOnce({ data: [{ tokens_30d: "1459614687101" }], error: null });

    expect(await getLiveNumbers(NOW)).toEqual({
      asOf: "2026-11-19",
      developers: 296,
      countries: 45,
      tokensAllTime: 7_424_227_228_738,
      tokens30d: 1_459_614_687_101,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_public_stats_summary");
  });

  it("랜딩이 숫자를 숨기는 상태(조회 실패 · 기준 미달)면 그 숫자는 빼고 0 으로 보내지 않는다", async () => {
    mocks.global.mockResolvedValueOnce({ ...GLOBAL, showStats: false });
    mocks.rpc.mockResolvedValueOnce({ data: [{ tokens_30d: 5 }], error: null });

    expect(await getLiveNumbers(NOW)).toEqual({ asOf: "2026-11-19", tokens30d: 5 });
  });

  it("30일 합계를 못 읽거나 0 이면 그 숫자만 뺀다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.global.mockResolvedValue(GLOBAL);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "timeout" } });
    expect(await getLiveNumbers(NOW)).not.toHaveProperty("tokens30d");

    mocks.rpc.mockResolvedValueOnce({ data: [{ tokens_30d: 0 }], error: null });
    expect(await getLiveNumbers(NOW)).not.toHaveProperty("tokens30d");
  });
});
