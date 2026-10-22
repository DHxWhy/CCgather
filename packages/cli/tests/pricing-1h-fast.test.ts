import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("fs", () => ({
  existsSync: () => false,
  readFileSync: () => {
    throw new Error("no cache");
  },
  writeFileSync: () => {},
  mkdirSync: () => {},
}));

const LITELLM_PAYLOAD = {
  "claude-test-1h": {
    input_cost_per_token: 4e-6,
    output_cost_per_token: 20e-6,
    cache_creation_input_token_cost: 5e-6,
    cache_creation_input_token_cost_above_1hr: 9e-6,
    cache_read_input_token_cost: 0.2e-6,
  },
  "claude-test-broken": {
    input_cost_per_token: 1e-6,
    output_cost_per_token: 5e-6,
    cache_creation_input_token_cost: "x",
    cache_read_input_token_cost: -1e-7,
  },
  "claude-test-negative": {
    input_cost_per_token: -1e-6,
    output_cost_per_token: 5e-6,
  },
};

const M = 1_000_000;
const none = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => LITELLM_PAYLOAD }))
  );
});

describe("estimateCostRaw without LiteLLM (built-in table)", () => {
  it("prices 1-hour cache writes at twice the input rate", async () => {
    const { estimateCostRaw } = await import("../src/lib/pricing");
    const opus55 = (cacheWrite1hTokens: number) =>
      estimateCostRaw("claude-opus-5-5", { ...none, cacheWriteTokens: M, cacheWrite1hTokens });
    expect(opus55(M)).toBe(8);
    expect(opus55(600_000)).toBeCloseTo(6.8, 10);
    expect(opus55(0)).toBe(5);
  });

  it("adds the fast premium on the fast part only", async () => {
    const { estimateCostRaw } = await import("../src/lib/pricing");
    const both = { ...none, inputTokens: M, outputTokens: M };
    const half = { ...none, inputTokens: M / 2, outputTokens: M / 2 };
    expect(estimateCostRaw("claude-opus-4-6", { ...both, fast: both })).toBe(180);
    expect(estimateCostRaw("claude-opus-4-6", { ...both, fast: half })).toBe(105);
    expect(estimateCostRaw("claude-opus-4-8", { ...both, fast: both })).toBe(60);
    expect(estimateCostRaw("claude-sonnet-4-6", { ...both, fast: both })).toBe(18);
  });

  it("keeps sub-cent costs: rounding is the caller's, once", async () => {
    const { estimateCost, estimateCostRaw } = await import("../src/lib/pricing");
    expect(estimateCostRaw("claude-haiku-4-5", { ...none, inputTokens: 4000 })).toBeCloseTo(
      0.004,
      12
    );
    expect(estimateCost("claude-haiku-4-5", 4000, 0, 0, 0)).toBe(0);
  });

  it("knows the fast multipliers, whatever the id's case, prefix or suffix", async () => {
    const { fastModeMultiplier } = await import("../src/lib/pricing");
    expect(fastModeMultiplier("Claude-Opus-4-6")).toBe(6);
    expect(fastModeMultiplier("anthropic.claude-opus-4-6-v1:0")).toBe(6);
    expect(fastModeMultiplier("claude-opus-5-20261001")).toBe(2);
    expect(fastModeMultiplier("claude-sonnet-4-6")).toBe(1);
    for (const name of ["constructor", "__proto__", "Constructor"]) {
      expect(fastModeMultiplier(name), name).toBe(1);
    }
  });
});

describe("estimateCostRaw with LiteLLM data loaded", () => {
  it("uses a listed 1-hour price as it is", async () => {
    const { initPricing, estimateCostRaw } = await import("../src/lib/pricing");
    await initPricing();
    expect(
      estimateCostRaw("claude-test-1h", { ...none, cacheWriteTokens: M, cacheWrite1hTokens: M })
    ).toBe(9);
  });

  it("replaces a broken cache price with the standard ratio and drops a negative row", async () => {
    const { initPricing, estimateCost } = await import("../src/lib/pricing");
    await initPricing();
    expect(estimateCost("claude-test-broken", 0, 0, M, M)).toBe(1.35);
    expect(estimateCost("claude-test-negative", M, 0, 0, 0)).toBe(3);
  });

  it("never reads a price off Object.prototype for a model named like a member", async () => {
    const { initPricing, estimateCost } = await import("../src/lib/pricing");
    await initPricing();
    for (const name of ["constructor", "toString", "hasOwnProperty"]) {
      expect(estimateCost(name, M, 0, 0, 0), name).toBe(3);
    }
  });
});
