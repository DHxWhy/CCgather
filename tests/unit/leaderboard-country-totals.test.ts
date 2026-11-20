import { describe, expect, it } from "vitest";
import { countryTotalsFromAggregate } from "@/lib/leaderboard/country-totals";
import { getCountryName } from "@/lib/constants/countries";

describe("countryTotalsFromAggregate — 서버 집계를 첫 화면의 나라 순위 · 합계로", () => {
  it("집계가 없으면 빈 목록과 0", () => {
    expect(countryTotalsFromAggregate(null)).toEqual({ stats: [], tokens: 0, cost: 0 });
    expect(countryTotalsFromAggregate(undefined)).toEqual({ stats: [], tokens: 0, cost: 0 });
  });

  it("나라마다 이름을 붙이고 순서와 값은 서버 그대로, 합계는 서버 합계를 쓴다", () => {
    const totals = countryTotalsFromAggregate({
      totals: { tokens: 1_458_779_221_499, cost: 812_345.67 },
      countries: [
        { country_code: "US", tokens: 600, cost: 6 },
        { country_code: "KR", tokens: 300, cost: 3 },
        { country_code: "ZZ", tokens: 1, cost: 0 },
      ],
    });

    expect(totals.tokens).toBe(1_458_779_221_499);
    expect(totals.cost).toBe(812_345.67);
    expect(totals.stats).toEqual([
      { code: "US", name: getCountryName("US"), tokens: 600, cost: 6 },
      { code: "KR", name: getCountryName("KR"), tokens: 300, cost: 3 },
      { code: "ZZ", name: "ZZ", tokens: 1, cost: 0 },
    ]);
    expect(totals.stats[1]!.name).not.toBe("KR");
  });
});
