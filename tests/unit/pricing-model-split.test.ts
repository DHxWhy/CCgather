import { describe, it, expect } from "vitest";
import {
  computeDayCost,
  computeDayCostByModel,
  fastModeMultiplier,
} from "../../lib/services/pricing";

const M = 1_000_000;

const HAIKU_DAY = {
  inputTokens: 1 * M,
  outputTokens: 1 * M,
  cacheWriteTokens: 0,
  cacheReadTokens: 198 * M,
};

function split(day: typeof HAIKU_DAY) {
  return { ...day };
}

describe("computeDayCostByModel", () => {
  describe("prices each model separately", () => {
    it("a mixed day costs more than pricing everything at the cheaper primary model", () => {
      const dayTotals = {
        inputTokens: 2 * M,
        outputTokens: 2 * M,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      };
      const perModel = computeDayCostByModel(null, {
        modelTokens: {
          "claude-sonnet-4-5": {
            inputTokens: 1 * M,
            outputTokens: 1 * M,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
          "claude-opus-5": {
            inputTokens: 1 * M,
            outputTokens: 1 * M,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
        },
        declaredModels: { "claude-sonnet-4-5": 2 * M, "claude-opus-5": 2 * M },
        dayTotals,
      });
      const primaryOnly = computeDayCost(null, { model: "claude-sonnet-4-5", ...dayTotals });

      expect(perModel).toBe(18 + 30);
      expect(primaryOnly).toBe(36);
    });

    it("a single-model day matches the primary-model result exactly", () => {
      const perModel = computeDayCostByModel(null, {
        modelTokens: { "claude-haiku-4-5": split(HAIKU_DAY) },
        declaredModels: { "claude-haiku-4-5": 200 * M },
        dayTotals: HAIKU_DAY,
      });
      expect(perModel).toBe(computeDayCost(null, { model: "claude-haiku-4-5", ...HAIKU_DAY }));
      expect(perModel).toBe(25.8);
    });

    it("sums unrounded so sub-cent models are not dropped", () => {
      const modelTokens: Record<string, unknown> = {};
      const declaredModels: Record<string, number> = {};
      const one = {
        inputTokens: 2_000,
        outputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      };
      for (let i = 0; i < 5; i++) {
        modelTokens[`claude-haiku-4-5-v${i}`] = { ...one };
        declaredModels[`claude-haiku-4-5-v${i}`] = 2_000;
      }
      const dayTotals = {
        inputTokens: 10_000,
        outputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      };

      expect(computeDayCost(null, { model: "claude-haiku-4-5-v0", ...one })).toBe(0);
      expect(computeDayCostByModel(null, { modelTokens, declaredModels, dayTotals })).toBe(0.01);
    });
  });

  describe("rejects a split that is not a refinement of the declared models", () => {
    it("billing declared haiku tokens to opus is rejected", () => {
      expect(
        computeDayCostByModel(null, {
          modelTokens: { "claude-opus-4-20250514": split(HAIKU_DAY) },
          declaredModels: { "claude-haiku-4-5": 200 * M },
          dayTotals: HAIKU_DAY,
        })
      ).toBeNull();
    });

    it("a per-model total that disagrees with day.models is rejected", () => {
      expect(
        computeDayCostByModel(null, {
          modelTokens: { "claude-haiku-4-5": split(HAIKU_DAY) },
          declaredModels: { "claude-haiku-4-5": 199 * M },
          dayTotals: HAIKU_DAY,
        })
      ).toBeNull();
    });

    it.each(["inputTokens", "outputTokens", "cacheWriteTokens", "cacheReadTokens"] as const)(
      "a day total that disagrees on %s alone is rejected",
      (field) => {
        const declared = {
          inputTokens: 10,
          outputTokens: 20,
          cacheWriteTokens: 30,
          cacheReadTokens: 40,
        };
        expect(
          computeDayCostByModel(null, {
            modelTokens: { "claude-haiku-4-5": { ...declared } },
            declaredModels: { "claude-haiku-4-5": 100 },
            dayTotals: { ...declared, [field]: declared[field] + 1 },
          })
        ).toBeNull();
      }
    );
  });

  describe("rejects malformed input", () => {
    it.each(["inputTokens", "outputTokens", "cacheWriteTokens", "cacheReadTokens"] as const)(
      "a negative %s is rejected even when every sum still reconciles",
      (field) => {
        const zero = {
          inputTokens: 0,
          outputTokens: 0,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
        };
        // -1 on one model and +1 on the other, with a positive carrier in a
        // different field: every per-model total and day total still reconciles,
        // so only the field-level guard can reject. The carrier must not be the
        // field under test or it would overwrite the negative.
        const carrier = field === "inputTokens" ? "outputTokens" : "inputTokens";
        expect(
          computeDayCostByModel(null, {
            modelTokens: {
              "claude-haiku-4-5": { ...zero, [carrier]: 2, [field]: -1 },
              "claude-sonnet-4-5": { ...zero, [field]: 1 },
            },
            declaredModels: { "claude-haiku-4-5": 1, "claude-sonnet-4-5": 1 },
            dayTotals: { ...zero, [carrier]: 2, [field]: 0 },
          })
        ).toBeNull();
      }
    );

    it("a declared total that overflows to Infinity is rejected", () => {
      const HUGE = 1.5e308;
      expect(
        computeDayCostByModel(null, {
          modelTokens: {
            "claude-haiku-4-5": {
              inputTokens: HUGE,
              outputTokens: HUGE,
              cacheWriteTokens: 0,
              cacheReadTokens: 0,
            },
          },
          declaredModels: { "claude-haiku-4-5": Infinity },
          dayTotals: {
            inputTokens: HUGE,
            outputTokens: HUGE,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
        })
      ).toBeNull();
    });

    it("a null modelTokens is rejected rather than throwing", () => {
      expect(
        computeDayCostByModel(null, {
          modelTokens: null,
          declaredModels: { "claude-haiku-4-5": 1 },
          dayTotals: { inputTokens: 1, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 },
        })
      ).toBeNull();
    });

    it("a non-finite token count is rejected even when every sum reconciles", () => {
      expect(
        computeDayCostByModel(null, {
          modelTokens: {
            "claude-haiku-4-5": {
              inputTokens: Infinity,
              outputTokens: 0,
              cacheWriteTokens: 0,
              cacheReadTokens: 0,
            },
          },
          declaredModels: { "claude-haiku-4-5": Infinity },
          dayTotals: {
            inputTokens: Infinity,
            outputTokens: 0,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
        })
      ).toBeNull();
    });

    it("a null split value is rejected rather than throwing", () => {
      expect(
        computeDayCostByModel(null, {
          modelTokens: { "claude-haiku-4-5": null },
          declaredModels: { "claude-haiku-4-5": 1 },
          dayTotals: { inputTokens: 1, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 },
        })
      ).toBeNull();
    });

    it("a non-empty array modelTokens is rejected", () => {
      expect(
        computeDayCostByModel(null, {
          modelTokens: [
            { inputTokens: 1, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 },
          ],
          declaredModels: { "0": 1 },
          dayTotals: { inputTokens: 1, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 },
        })
      ).toBeNull();
    });

    it("an empty modelTokens is rejected rather than priced as zero", () => {
      expect(
        computeDayCostByModel(null, {
          modelTokens: {},
          declaredModels: { "claude-haiku-4-5": 0 },
          dayTotals: { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 },
        })
      ).toBeNull();
    });

    it("a null declaredModels is rejected", () => {
      expect(
        computeDayCostByModel(null, {
          modelTokens: {
            "claude-haiku-4-5": {
              inputTokens: 1,
              outputTokens: 0,
              cacheWriteTokens: 0,
              cacheReadTokens: 0,
            },
          },
          declaredModels: null,
          dayTotals: { inputTokens: 1, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 },
        })
      ).toBeNull();
    });

    it("an over-long model key is rejected", () => {
      const key = `claude-${"x".repeat(200)}`;
      expect(
        computeDayCostByModel(null, {
          modelTokens: {
            [key]: { inputTokens: 1, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 },
          },
          declaredModels: { [key]: 1 },
          dayTotals: { inputTokens: 1, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 },
        })
      ).toBeNull();
    });

    it("more declared models than the per-day limit is rejected", () => {
      const modelTokens: Record<string, unknown> = {};
      const declaredModels: Record<string, number> = {};
      for (let i = 0; i < 51; i++) {
        modelTokens[`claude-haiku-4-5-v${i}`] = {
          inputTokens: 1,
          outputTokens: 0,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
        };
        declaredModels[`claude-haiku-4-5-v${i}`] = 1;
      }
      expect(
        computeDayCostByModel(null, {
          modelTokens,
          declaredModels,
          dayTotals: { inputTokens: 51, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 },
        })
      ).toBeNull();
    });
  });

  describe("the clamp ceiling spans only the models actually billed", () => {
    const SPLIT_PEAKS = {
      "cheap-in-pricey-out": { input: 1, output: 100, cacheWrite: 1, cacheRead: 1 },
      "pricey-in-cheap-out": { input: 100, output: 1, cacheWrite: 1, cacheRead: 1 },
      "declared-but-unused": { input: 1000, output: 1000, cacheWrite: 1000, cacheRead: 1000 },
    };

    it("a model declared with zero tokens cannot raise the ceiling", () => {
      const dayTotals = {
        inputTokens: 1 * M,
        outputTokens: 1 * M,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      };
      const capped = computeDayCostByModel(SPLIT_PEAKS, {
        modelTokens: {
          "cheap-in-pricey-out": {
            inputTokens: 0,
            outputTokens: 1 * M,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
          "pricey-in-cheap-out": {
            inputTokens: 1 * M,
            outputTokens: 0,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
        },
        declaredModels: {
          "cheap-in-pricey-out": 1 * M,
          "pricey-in-cheap-out": 1 * M,
          "declared-but-unused": 0,
        },
        dayTotals,
      });

      expect(capped).toBe(101);
    });
  });

  describe("clamps when no single model is priciest on every token type", () => {
    const SPLIT_PEAKS = {
      "cheap-in-pricey-out": { input: 1, output: 100, cacheWrite: 1, cacheRead: 1 },
      "pricey-in-cheap-out": { input: 100, output: 1, cacheWrite: 1, cacheRead: 1 },
    };

    it("caps the split at the priciest single-model reading of the same day", () => {
      const dayTotals = {
        inputTokens: 1 * M,
        outputTokens: 1 * M,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      };
      const declaredModels = { "cheap-in-pricey-out": 1 * M, "pricey-in-cheap-out": 1 * M };

      const clamped = computeDayCostByModel(SPLIT_PEAKS, {
        modelTokens: {
          "cheap-in-pricey-out": {
            inputTokens: 0,
            outputTokens: 1 * M,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
          "pricey-in-cheap-out": {
            inputTokens: 1 * M,
            outputTokens: 0,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
        },
        declaredModels,
        dayTotals,
      });

      const ceiling = Math.max(
        ...Object.keys(declaredModels).map((model) =>
          computeDayCost(SPLIT_PEAKS, { model, ...dayTotals })
        )
      );

      expect(ceiling).toBe(101);
      expect(clamped).toBe(101);
    });
  });

  describe("clamps to the priciest declared single-model reading", () => {
    it("never exceeds what declaring one expensive model already allows", () => {
      const dayTotals = {
        inputTokens: 1 * M,
        outputTokens: 1 * M,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      };
      const declaredModels = { "claude-haiku-4-5": 1 * M, "claude-opus-5": 1 * M };
      const perModel = computeDayCostByModel(null, {
        modelTokens: {
          "claude-haiku-4-5": {
            inputTokens: 0,
            outputTokens: 1 * M,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
          "claude-opus-5": {
            inputTokens: 1 * M,
            outputTokens: 0,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
        },
        declaredModels,
        dayTotals,
      });
      const ceiling = Math.max(
        ...Object.keys(declaredModels).map((model) => computeDayCost(null, { model, ...dayTotals }))
      );
      expect(perModel).not.toBeNull();
      expect(perModel!).toBeLessThanOrEqual(ceiling);
    });
  });
});

describe("1-hour cache writes and fast mode", () => {
  const zero = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };

  function oneModelDay(model: string, split: Record<string, unknown>) {
    const base = { ...zero, ...split } as typeof zero;
    const declared =
      base.inputTokens + base.outputTokens + base.cacheWriteTokens + base.cacheReadTokens;
    return computeDayCostByModel(null, {
      modelTokens: { [model]: split },
      declaredModels: { [model]: declared },
      dayTotals: {
        inputTokens: base.inputTokens,
        outputTokens: base.outputTokens,
        cacheWriteTokens: base.cacheWriteTokens,
        cacheReadTokens: base.cacheReadTokens,
      },
    });
  }

  it("prices 1-hour cache writes at the 1h rate", () => {
    expect(
      oneModelDay("claude-opus-5-5", {
        ...zero,
        cacheWriteTokens: 1 * M,
        cacheWrite1hTokens: 1 * M,
      })
    ).toBe(8);
  });

  it("splits a day's cache writes between the 5m and 1h rates", () => {
    expect(
      oneModelDay("claude-opus-5-5", {
        ...zero,
        cacheWriteTokens: 1 * M,
        cacheWrite1hTokens: 600_000,
      })
    ).toBe(6.8);
  });

  it("prices a split without the new fields exactly as before", () => {
    expect(oneModelDay("claude-opus-5-5", { ...zero, cacheWriteTokens: 1 * M })).toBe(5);
  });

  it("multiplies fast-mode tokens by the model's fast multiplier", () => {
    const tokens = { ...zero, inputTokens: 1 * M, outputTokens: 1 * M };
    expect(oneModelDay("claude-opus-5-5", { ...tokens, fast: tokens })).toBe(48);
    expect(oneModelDay("claude-opus-4-6", { ...tokens, fast: tokens })).toBe(180);
    expect(oneModelDay("claude-sonnet-4-6", { ...tokens, fast: tokens })).toBe(18);
  });

  it("adds the fast premium only on the fast part of a model's tokens", () => {
    const tokens = { ...zero, inputTokens: 1 * M, outputTokens: 1 * M };
    const half = { ...zero, inputTokens: 500_000, outputTokens: 500_000 };
    expect(oneModelDay("claude-opus-5-5", { ...tokens, fast: half })).toBe(36);
  });

  it("knows the official fast multipliers", () => {
    expect(fastModeMultiplier("claude-opus-5-5")).toBe(2);
    expect(fastModeMultiplier("claude-opus-5")).toBe(2);
    expect(fastModeMultiplier("claude-opus-4-8")).toBe(2);
    expect(fastModeMultiplier("claude-opus-4-7")).toBe(6);
    expect(fastModeMultiplier("anthropic.claude-opus-4-6-v1:0")).toBe(6);
    expect(fastModeMultiplier("claude-opus-5-20261001")).toBe(2);
    expect(fastModeMultiplier("claude-sonnet-5-5")).toBe(1);
  });

  it("rejects a 1h share larger than the model's cache writes", () => {
    expect(
      oneModelDay("claude-opus-5-5", { ...zero, cacheWriteTokens: 100, cacheWrite1hTokens: 101 })
    ).toBeNull();
  });

  it("rejects a fast share larger than the model's tokens", () => {
    const tokens = { ...zero, inputTokens: 1 * M, outputTokens: 1 * M };
    expect(
      oneModelDay("claude-opus-5-5", { ...tokens, fast: { ...tokens, inputTokens: 2 * M } })
    ).toBeNull();
  });

  it("rejects a fast 1h share larger than the model's 1h share", () => {
    const tokens = { ...zero, cacheWriteTokens: 1 * M, cacheWrite1hTokens: 100 };
    expect(
      oneModelDay("claude-opus-5-5", {
        ...tokens,
        fast: { ...zero, cacheWriteTokens: 1 * M, cacheWrite1hTokens: 200 },
      })
    ).toBeNull();
  });

  it("still clamps a fast premium to the priciest single-model reading of the day", () => {
    const fastDay = { ...zero, inputTokens: 1 * M, outputTokens: 1 * M };
    const cost = computeDayCostByModel(null, {
      modelTokens: {
        "claude-opus-4-6": { ...fastDay, fast: fastDay },
        "claude-haiku-4-5": { ...zero, inputTokens: 1 * M },
      },
      declaredModels: { "claude-opus-4-6": 2 * M, "claude-haiku-4-5": 1 * M },
      dayTotals: { ...zero, inputTokens: 2 * M, outputTokens: 1 * M },
    });
    expect(cost).toBe(180 + 1);
  });
});
