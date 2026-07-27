import { describe, it, expect } from "vitest";
import {
  PER_MODEL_COST_START_DATE,
  computeDayCost,
  resolveDayCost,
} from "../../lib/services/pricing";

const M = 1_000_000;

const DAY_TOTALS = {
  inputTokens: 2 * M,
  outputTokens: 2 * M,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
};

const VALID_SPLIT = {
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
};

const DECLARED = { "claude-sonnet-4-5": 2 * M, "claude-opus-5": 2 * M };

function beforeCutoff() {
  const [y, m, d] = PER_MODEL_COST_START_DATE.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! - 1)).toISOString().slice(0, 10);
}

describe("resolveDayCost", () => {
  it("applies the per-model split on/after the cutoff", () => {
    const r = resolveDayCost(null, {
      date: PER_MODEL_COST_START_DATE,
      primaryModel: "claude-haiku-4-5",
      modelTokens: VALID_SPLIT,
      declaredModels: DECLARED,
      dayTotals: DAY_TOTALS,
    });
    expect(r.perModelApplied).toBe(true);
    expect(r.splitRejected).toBe(false);
    expect(r.cost).toBe(18 + 30);
  });

  it("keeps the primary-model method before the cutoff", () => {
    const r = resolveDayCost(null, {
      date: beforeCutoff(),
      primaryModel: "claude-haiku-4-5",
      modelTokens: VALID_SPLIT,
      declaredModels: DECLARED,
      dayTotals: DAY_TOTALS,
    });
    expect(r.perModelApplied).toBe(false);
    expect(r.cost).toBe(computeDayCost(null, { model: "claude-haiku-4-5", ...DAY_TOTALS }));
  });

  it("does not report a rejected split for a pre-cutoff day that carried one", () => {
    const r = resolveDayCost(null, {
      date: beforeCutoff(),
      primaryModel: "claude-haiku-4-5",
      modelTokens: VALID_SPLIT,
      declaredModels: DECLARED,
      dayTotals: DAY_TOTALS,
    });
    expect(r.splitRejected).toBe(false);
  });

  it("does not report a rejected split when the client sent none", () => {
    const r = resolveDayCost(null, {
      date: PER_MODEL_COST_START_DATE,
      primaryModel: "claude-haiku-4-5",
      modelTokens: undefined,
      declaredModels: DECLARED,
      dayTotals: DAY_TOTALS,
    });
    expect(r.splitRejected).toBe(false);
    expect(r.perModelApplied).toBe(false);
  });

  it("reports a rejected split only when an in-scope split failed the guards", () => {
    const r = resolveDayCost(null, {
      date: PER_MODEL_COST_START_DATE,
      primaryModel: "claude-haiku-4-5",
      modelTokens: { "claude-opus-4-20250514": { ...DAY_TOTALS } },
      declaredModels: DECLARED,
      dayTotals: DAY_TOTALS,
    });
    expect(r.splitRejected).toBe(true);
    expect(r.perModelApplied).toBe(false);
    expect(r.cost).toBe(computeDayCost(null, { model: "claude-haiku-4-5", ...DAY_TOTALS }));
  });
});
