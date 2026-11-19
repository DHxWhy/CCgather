import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveNumbers } from "@/lib/seo/llms";

const live = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/seo/live-numbers", () => ({ getLiveNumbers: live.get }));

import { GET } from "@/app/api/stats/badge/route";

const LIVE: LiveNumbers = {
  asOf: "2026-11-19",
  developers: 296,
  countries: 45,
  tokensAllTime: 7_424_227_228_738,
  tokens30d: 1_459_614_687_101,
};

const call = (metric: string) =>
  GET(new Request(`https://ccgather.com/api/stats/badge?metric=${metric}`));

describe("README 숫자 배지 (shields.io endpoint)", () => {
  beforeEach(() => live.get.mockReset());

  it.each([
    ["developers", "developers", "296 in 45 countries"],
    ["tokens", "Claude Code tokens logged", "7.42T"],
    ["tokens30d", "tokens, last 30 days", "1.46T"],
  ])("%s", async (metric, label, message) => {
    live.get.mockResolvedValueOnce(LIVE);
    const res = await call(metric);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      schemaVersion: 1,
      label,
      message,
      color: "da7756",
      cacheSeconds: 3600,
    });
    expect(res.headers.get("cache-control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=60"
    );
  });

  it("모르는 metric 은 400 과 isError", async () => {
    const res = await call("secret");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ schemaVersion: 1, isError: true });
    expect(live.get).not.toHaveBeenCalled();
  });

  it("숫자를 못 얻으면 200 과 isError — shields 가 '접속 불가' 대신 이 글자를 보여 준다", async () => {
    live.get.mockRejectedValueOnce(new Error("db down"));
    const res = await call("tokens");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      schemaVersion: 1,
      message: "unavailable",
      isError: true,
    });
  });

  it("값이 0 이거나 빠져 있으면 숫자 대신 unavailable", async () => {
    live.get.mockResolvedValueOnce({ asOf: "2026-11-19", developers: 0, countries: 0 });
    const res = await call("developers");
    expect(await res.json()).toMatchObject({ message: "unavailable", isError: true });
  });
});
