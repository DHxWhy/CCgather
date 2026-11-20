import { getCountryName } from "@/lib/constants/countries";
import type { ServerAggregate } from "@/lib/leaderboard/initial-shared";

export interface CountryTotals {
  stats: Array<{ code: string; name: string; tokens: number; cost: number }>;
  tokens: number;
  cost: number;
}

export function countryTotalsFromAggregate(
  aggregate: ServerAggregate | null | undefined
): CountryTotals {
  if (!aggregate) return { stats: [], tokens: 0, cost: 0 };
  return {
    stats: aggregate.countries.map((country) => ({
      code: country.country_code,
      name: getCountryName(country.country_code),
      tokens: country.tokens,
      cost: country.cost,
    })),
    tokens: aggregate.totals.tokens,
    cost: aggregate.totals.cost,
  };
}
