import { describe, it, expect } from "vitest";
import {
  cacheWrite1hRate,
  computeDayCost,
  computeDayCostByModel,
  fastModeMultiplier,
  resolveDayCost,
} from "../../lib/services/pricing";
import type { OfficialModelPricing, PricingTable } from "../../lib/services/official-pricing";
import snapshot from "../../lib/constants/claude-pricing.json";

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

  describe("prices each model at its own rates, like ccusage", () => {
    const SPLIT_PEAKS = {
      "cheap-in-pricey-out": { input: 1, output: 100, cacheWrite: 1, cacheRead: 1 },
      "pricey-in-cheap-out": { input: 100, output: 1, cacheWrite: 1, cacheRead: 1 },
      "declared-but-unused": { input: 1000, output: 1000, cacheWrite: 1000, cacheRead: 1000 },
    };
    const dayTotals = {
      inputTokens: 1 * M,
      outputTokens: 1 * M,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    };
    const modelTokens = {
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
    };

    it("even when no single model is priciest on every token type", () => {
      // 1M output at $100 + 1M input at $100. The single-model clamp removed on
      // 2026-10-22 would have cut this day to its priciest one-model reading, $101.
      const cost = computeDayCostByModel(SPLIT_PEAKS, {
        modelTokens,
        declaredModels: { "cheap-in-pricey-out": 1 * M, "pricey-in-cheap-out": 1 * M },
        dayTotals,
      });
      expect(cost).toBe(200);
    });

    it("a model declared with zero tokens bills nothing, listed in the split or not", () => {
      const declaredModels = {
        "cheap-in-pricey-out": 1 * M,
        "pricey-in-cheap-out": 1 * M,
        "declared-but-unused": 0,
      };
      expect(computeDayCostByModel(SPLIT_PEAKS, { modelTokens, declaredModels, dayTotals })).toBe(
        200
      );
      const withZeroEntry = {
        ...modelTokens,
        "declared-but-unused": {
          inputTokens: 0,
          outputTokens: 0,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
        },
      };
      expect(
        computeDayCostByModel(SPLIT_PEAKS, {
          modelTokens: withZeroEntry,
          declaredModels,
          dayTotals,
        })
      ).toBe(200);
    });
  });
});

describe("1-hour cache writes and fast mode", () => {
  const zero = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };
  const cents = (usd: number) => Math.round(usd * 100) / 100;

  // Listed models are priced from the snapshot, not from copied numbers: the hourly
  // sync rewrites it when the official table changes, and a pinned price would fail
  // that gate. Fast multipliers are policy and stay literal. The claude-test-* ids
  // are not in the official table, so TABLE prices them.
  function listed(id: string): OfficialModelPricing {
    const price = (snapshot.models as PricingTable)[id];
    if (!price) throw new Error(`${id} is not in the official snapshot`);
    return price;
  }
  const TABLE = {
    "claude-test-1h": { input: 4, output: 20, cacheWrite: 5, cacheWrite1h: 9, cacheRead: 0.2 },
    "claude-test-cheap": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
    "claude-test-pricey-out": { input: 1, output: 1000, cacheWrite: 1, cacheRead: 1 },
  };

  function oneModelDay(model: string, split: Record<string, unknown>) {
    const base = { ...zero, ...split } as typeof zero;
    const declared =
      base.inputTokens + base.outputTokens + base.cacheWriteTokens + base.cacheReadTokens;
    return computeDayCostByModel(TABLE, {
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

  it("prices 1-hour cache writes at the listed 1h rate", () => {
    expect(
      oneModelDay("claude-test-1h", { ...zero, cacheWriteTokens: 1 * M, cacheWrite1hTokens: 1 * M })
    ).toBe(9);
  });

  it("splits a day's cache writes between the 5m and 1h rates", () => {
    expect(
      oneModelDay("claude-test-1h", {
        ...zero,
        cacheWriteTokens: 1 * M,
        cacheWrite1hTokens: 600_000,
      })
    ).toBe(7.4);
  });

  it("prices a listed model's 1h writes at its snapshot rate", () => {
    const rate = listed("claude-opus-5-5").cacheWrite1h;
    expect(rate).toBeGreaterThan(0);
    expect(
      oneModelDay("claude-opus-5-5", {
        ...zero,
        cacheWriteTokens: 1 * M,
        cacheWrite1hTokens: 1 * M,
      })
    ).toBe(cents(rate ?? 0));
  });

  it("prices a split without the new fields exactly as before", () => {
    expect(oneModelDay("claude-test-1h", { ...zero, cacheWriteTokens: 1 * M })).toBe(5);
  });

  it("multiplies fast-mode tokens by the model's fast multiplier", () => {
    const tokens = { ...zero, inputTokens: 1 * M, outputTokens: 1 * M };
    const inOut = (id: string) => listed(id).input + listed(id).output;
    expect(oneModelDay("claude-opus-5-5", { ...tokens, fast: tokens })).toBe(
      cents(inOut("claude-opus-5-5") * 2)
    );
    expect(oneModelDay("claude-opus-4-6", { ...tokens, fast: tokens })).toBe(
      cents(inOut("claude-opus-4-6") * 6)
    );
    expect(oneModelDay("claude-sonnet-4-6", { ...tokens, fast: tokens })).toBe(
      cents(inOut("claude-sonnet-4-6"))
    );
  });

  it("adds the fast premium only on the fast part of a model's tokens", () => {
    const tokens = { ...zero, inputTokens: 1 * M, outputTokens: 1 * M };
    const half = { ...zero, inputTokens: 500_000, outputTokens: 500_000 };
    const p = listed("claude-opus-5-5");
    expect(oneModelDay("claude-opus-5-5", { ...tokens, fast: half })).toBe(
      cents((p.input + p.output) * 1.5)
    );
  });

  it("adds no premium to a fast-capable model that reports no fast share", () => {
    const p = listed("claude-opus-4-6");
    expect(
      oneModelDay("claude-opus-4-6", { ...zero, inputTokens: 1 * M, outputTokens: 1 * M })
    ).toBe(cents(p.input + p.output));
  });

  it("knows the official fast multipliers", () => {
    expect(fastModeMultiplier("claude-opus-5-5")).toBe(2);
    expect(fastModeMultiplier("claude-opus-5")).toBe(2);
    expect(fastModeMultiplier("claude-opus-4-8")).toBe(2);
    expect(fastModeMultiplier("claude-opus-4-7")).toBe(6);
    expect(fastModeMultiplier("anthropic.claude-opus-4-6-v1:0")).toBe(6);
    expect(fastModeMultiplier("claude-opus-5-20261001")).toBe(2);
    expect(fastModeMultiplier("Claude-Opus-4-6")).toBe(6);
    expect(fastModeMultiplier("claude-sonnet-5-5")).toBe(1);
  });

  it("prices an old-format day as the plain per-model sum, whatever the model names", () => {
    for (const name of ["CONSTRUCTOR", "Constructor", "__PROTO__", "Anthropic.Constructor"]) {
      const cost = computeDayCostByModel(TABLE, {
        modelTokens: {
          [name]: { ...zero, outputTokens: 1 * M },
          "claude-test-cheap": { ...zero, inputTokens: 1 * M },
        },
        declaredModels: { [name]: 1 * M, "claude-test-cheap": 1 * M },
        dayTotals: { ...zero, inputTokens: 1 * M, outputTokens: 1 * M },
      });
      // An unknown name prices at the default $3 / $15 → 15 + 1.
      expect(cost, name).toBe(16);
    }
  });

  it("rejects a 1h share larger than the model's cache writes", () => {
    expect(
      oneModelDay("claude-test-1h", { ...zero, cacheWriteTokens: 100, cacheWrite1hTokens: 101 })
    ).toBeNull();
  });

  it.each([-1, "5", null, Number.NaN])("rejects a 1h share of %s", (bad) => {
    expect(
      oneModelDay("claude-test-1h", { ...zero, cacheWriteTokens: 1 * M, cacheWrite1hTokens: bad })
    ).toBeNull();
  });

  it.each(["inputTokens", "outputTokens", "cacheWriteTokens", "cacheReadTokens"] as const)(
    "rejects a fast share larger than the model's own %s",
    (field) => {
      const tokens = {
        inputTokens: 1 * M,
        outputTokens: 1 * M,
        cacheWriteTokens: 1 * M,
        cacheReadTokens: 1 * M,
      };
      const split = { ...tokens, fast: { ...tokens, [field]: tokens[field] + 1 } };
      expect(oneModelDay("claude-opus-4-6", split)).toBeNull();
      const resolved = resolveDayCost(TABLE, {
        date: "2026-10-01",
        primaryModel: "claude-opus-4-6",
        modelTokens: { "claude-opus-4-6": split },
        declaredModels: { "claude-opus-4-6": 4 * M },
        dayTotals: tokens,
      });
      expect(resolved.splitRejected).toBe(true);
    }
  );

  it.each([null, 5, "x", {}, { ...zero, inputTokens: -1 }])("rejects a fast share of %o", (bad) => {
    const tokens = { ...zero, inputTokens: 1 * M };
    expect(oneModelDay("claude-opus-4-6", { ...tokens, fast: bad })).toBeNull();
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

  it("adds the fast premium in full", () => {
    const fastDay = { ...zero, inputTokens: 1 * M, outputTokens: 1 * M };
    const opus = listed("claude-opus-4-6");
    const cost = computeDayCostByModel(TABLE, {
      modelTokens: {
        "claude-opus-4-6": { ...fastDay, fast: fastDay },
        "claude-test-cheap": { ...zero, inputTokens: 1 * M },
      },
      declaredModels: { "claude-opus-4-6": 2 * M, "claude-test-cheap": 1 * M },
      dayTotals: { ...zero, inputTokens: 2 * M, outputTokens: 1 * M },
    });
    expect(cost).toBe(cents((opus.input + opus.output) * 6 + 1));
  });

  it("bills a fast premium in full even above any single-model reading, like ccusage", () => {
    const opus = listed("claude-opus-4-6");
    const cost = computeDayCostByModel(TABLE, {
      modelTokens: {
        "claude-test-pricey-out": { ...zero, outputTokens: 1 * M },
        "claude-opus-4-6": { ...zero, inputTokens: 1 * M, fast: { ...zero, inputTokens: 1 * M } },
      },
      declaredModels: { "claude-test-pricey-out": 1 * M, "claude-opus-4-6": 1 * M },
      dayTotals: { ...zero, inputTokens: 1 * M, outputTokens: 1 * M },
    });
    // 1000 + Opus 4.6 input x6; the removed clamp would have capped it at 1001.
    expect(cost).toBe(cents(1000 + opus.input * 6));
  });

  it("reaches, and never exceeds, each type at its priciest declared rate x fast multiplier", () => {
    type Field = "inputTokens" | "outputTokens" | "cacheWriteTokens" | "cacheReadTokens";
    const fields: Field[] = ["inputTokens", "outputTokens", "cacheWriteTokens", "cacheReadTokens"];
    const declared = [
      { id: "claude-opus-4-6", price: listed("claude-opus-4-6"), k: 6 },
      { id: "claude-test-pricey-out", price: TABLE["claude-test-pricey-out"], k: 1 },
    ];
    // Cache writes are counted at the 1h rate: the dearer of the two write rates.
    const rate = (price: OfficialModelPricing, field: Field) =>
      field === "inputTokens"
        ? price.input
        : field === "outputTokens"
          ? price.output
          : field === "cacheWriteTokens"
            ? cacheWrite1hRate(price)
            : price.cacheRead;
    const day = {
      inputTokens: 1 * M,
      outputTokens: 1 * M,
      cacheWriteTokens: 1 * M,
      cacheReadTokens: 1 * M,
    };

    // Funnel: every type to the model that bills it highest, all of it 1h and fast.
    const shares = new Map(declared.map((m) => [m.id, { ...zero }]));
    let bound = 0;
    for (const field of fields) {
      const top = declared.reduce((a, b) =>
        rate(b.price, field) * b.k > rate(a.price, field) * a.k ? b : a
      );
      shares.get(top.id)![field] = 1 * M;
      bound += rate(top.price, field) * top.k;
    }
    const modelTokens: Record<string, unknown> = {};
    const declaredModels: Record<string, number> = {};
    for (const m of declared) {
      const own = shares.get(m.id)!;
      const share = { ...own, cacheWrite1hTokens: own.cacheWriteTokens };
      modelTokens[m.id] = m.k > 1 ? { ...share, fast: share } : share;
      declaredModels[m.id] = fields.reduce((n, field) => n + own[field], 0);
    }
    expect(computeDayCostByModel(TABLE, { modelTokens, declaredModels, dayTotals: day })).toBe(
      cents(bound)
    );

    // Any other honest-looking split of the same day stays at or under it.
    const misaligned = computeDayCostByModel(TABLE, {
      modelTokens: {
        "claude-opus-4-6": {
          ...zero,
          outputTokens: 1 * M,
          cacheReadTokens: 1 * M,
          fast: { ...zero, outputTokens: 500_000 },
        },
        "claude-test-pricey-out": {
          ...zero,
          inputTokens: 1 * M,
          cacheWriteTokens: 1 * M,
          cacheWrite1hTokens: 400_000,
        },
      },
      declaredModels: { "claude-opus-4-6": 2 * M, "claude-test-pricey-out": 2 * M },
      dayTotals: day,
    });
    expect(misaligned).not.toBeNull();
    expect(misaligned!).toBeLessThanOrEqual(bound);
  });
});
