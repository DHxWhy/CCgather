import { describe, it, expect } from "vitest";
import { computeDayCost, computeDayCostByModel } from "../../lib/services/pricing";

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
    it("a negative token count is rejected even when every sum still reconciles", () => {
      expect(
        computeDayCostByModel(null, {
          modelTokens: {
            "claude-haiku-4-5": {
              inputTokens: -1,
              outputTokens: 2,
              cacheWriteTokens: 0,
              cacheReadTokens: 0,
            },
            "claude-sonnet-4-5": {
              inputTokens: 1,
              outputTokens: 0,
              cacheWriteTokens: 0,
              cacheReadTokens: 0,
            },
          },
          declaredModels: { "claude-haiku-4-5": 1, "claude-sonnet-4-5": 1 },
          dayTotals: { inputTokens: 0, outputTokens: 2, cacheWriteTokens: 0, cacheReadTokens: 0 },
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
