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
  "claude-opus-4-20250514": {
    input_cost_per_token: 15e-6,
    output_cost_per_token: 75e-6,
    cache_creation_input_token_cost: 18.75e-6,
    cache_read_input_token_cost: 1.5e-6,
  },
  "claude-opus-4-5": {
    input_cost_per_token: 5e-6,
    output_cost_per_token: 25e-6,
    cache_creation_input_token_cost: 6.25e-6,
    cache_read_input_token_cost: 0.5e-6,
  },
  "claude-sonnet-4-5": {
    input_cost_per_token: 3e-6,
    output_cost_per_token: 15e-6,
  },
};

const M = 1_000_000;

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => LITELLM_PAYLOAD }))
  );
});

describe("estimateCost with LiteLLM data loaded (opus tier guard)", () => {
  it("current-gen minor absent from the table resolves to $5/$25, not the synthetic legacy key", async () => {
    const { initPricing, estimateCost } = await import("../src/lib/pricing");
    await initPricing();
    expect(estimateCost("claude-opus-4-8", M, M, 0, 0)).toBe(30);
    expect(estimateCost("claude-opus-4-10", M, M, 0, 0)).toBe(30);
    expect(estimateCost("claude-opus-5", M, M, 0, 0)).toBe(30);
  });

  it("legacy Opus 4 with an exact table entry stays $15/$75", async () => {
    const { initPricing, estimateCost } = await import("../src/lib/pricing");
    await initPricing();
    expect(estimateCost("claude-opus-4-20250514", M, M, 0, 0)).toBe(90);
  });

  it("a model with an exact table entry uses the table price", async () => {
    const { initPricing, estimateCost } = await import("../src/lib/pricing");
    await initPricing();
    expect(estimateCost("claude-opus-4-5", M, M, 0, 0)).toBe(30);
    expect(estimateCost("claude-sonnet-4-5", M, M, 0, 0)).toBe(18);
  });
});
