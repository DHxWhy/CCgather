import { describe, expect, it } from "vitest";
import { FAST_MODE_MULTIPLIERS as SERVER } from "@/lib/services/fast-mode";
import { cacheWrite1hRate as serverRate } from "@/lib/services/pricing";
import { FAST_MODE_MULTIPLIERS as CLI } from "../../packages/cli/src/lib/fast-mode";
import { cacheWrite1hRate as cliRate } from "../../packages/cli/src/lib/pricing";

describe("fast-mode multipliers", () => {
  it("the CLI's copy equals the server's table", () => {
    expect(CLI).toEqual(SERVER);
  });
});

describe("1-hour cache write rate", () => {
  it("the CLI and the server agree on every listed or broken 1h price", () => {
    const base = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 };
    for (const cacheWrite1h of [undefined, 9, 8, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const price = { ...base, cacheWrite1h };
      expect(cliRate(price), String(cacheWrite1h)).toBe(serverRate(price));
    }
    expect(cliRate({ ...base, cacheWrite1h: 0 })).toBe(8);
    expect(cliRate({ ...base, cacheWrite1h: 9 })).toBe(9);
  });
});
