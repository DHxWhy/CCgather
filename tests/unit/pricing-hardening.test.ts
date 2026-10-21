import { describe, it, expect } from "vitest";
import {
  computeDayCost,
  computeDayCostByModel,
  extractClaudePricing,
  fastModeMultiplier,
} from "@/lib/services/pricing";
import { validateSingleDay } from "@/lib/services/submit-validators";

const M = 1_000_000;
const zero = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };

describe("model names that shadow Object.prototype members", () => {
  it("never read a fast multiplier off the prototype", () => {
    for (const name of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(fastModeMultiplier(name), name).toBe(1);
    }
  });

  it("price at the default rate on both paths", () => {
    expect(computeDayCost(null, { model: "toString", ...zero, inputTokens: 1 * M })).toBe(3);
    expect(computeDayCost({}, { model: "constructor", ...zero, inputTokens: 1 * M })).toBe(3);
    const split = { ...zero, inputTokens: 1 * M };
    expect(
      computeDayCostByModel(
        {},
        {
          modelTokens: JSON.parse(
            '{"__proto__": {"inputTokens": 1000000, "outputTokens": 0, "cacheWriteTokens": 0, "cacheReadTokens": 0}}'
          ),
          declaredModels: JSON.parse('{"__proto__": 1000000}'),
          dayTotals: split,
        }
      )
    ).toBe(3);
  });
});

describe("non-finite prices fail closed", () => {
  it("returns null for the per-model path so the caller falls back", () => {
    const split = { ...zero, inputTokens: 1 * M };
    expect(
      computeDayCostByModel(
        { "claude-x": { input: Number.NaN, output: 1, cacheWrite: 1, cacheRead: 1 } },
        {
          modelTokens: { "claude-x": split },
          declaredModels: { "claude-x": 1 * M },
          dayTotals: split,
        }
      )
    ).toBeNull();
  });

  it("drops LiteLLM rows whose prices are not finite numbers", () => {
    const table = extractClaudePricing({
      "claude-y": { input_cost_per_token: "abc", output_cost_per_token: 1e-5 },
      "claude-z": { input_cost_per_token: 1e-6, output_cost_per_token: Number.POSITIVE_INFINITY },
    });
    expect(table["claude-y"]).toBeUndefined();
    expect(table["claude-z"]).toBeUndefined();
  });
});

describe("V10_fast_mode_share", () => {
  const day = { date: "2026-10-01", tokens: 3 * M, inputTokens: 2 * M, outputTokens: 1 * M };

  it("flags a day whose split claims fast-mode tokens, without changing its review status", () => {
    const flags = validateSingleDay(
      {
        ...day,
        modelTokens: {
          "claude-opus-4-6": {
            ...zero,
            inputTokens: 2 * M,
            outputTokens: 1 * M,
            fast: { ...zero, inputTokens: 1 * M },
          },
        },
      },
      "2026-10-22"
    );
    const fast = flags.find((f) => f.code === "V10_fast_mode_share");
    expect(fast?.severity).toBe("INFO");
    expect(fast?.detail).toBe("fast 1000000 of 3000000 tokens");
  });

  it("stays silent without a fast share", () => {
    const flags = validateSingleDay(
      {
        ...day,
        modelTokens: { "claude-opus-4-6": { ...zero, inputTokens: 2 * M, outputTokens: 1 * M } },
      },
      "2026-10-22"
    );
    expect(flags.some((f) => f.code === "V10_fast_mode_share")).toBe(false);
  });
});
