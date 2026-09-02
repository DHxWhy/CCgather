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
  // Only the previous Mythos minor is listed — the 5.1 id must NOT inherit its $1 cache read.
  "claude-mythos-5": {
    input_cost_per_token: 10e-6,
    output_cost_per_token: 50e-6,
    cache_creation_input_token_cost: 12.5e-6,
    cache_read_input_token_cost: 1e-6,
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

describe("estimateCost with LiteLLM data loaded (family tier guard)", () => {
  it("unlisted Fable/Mythos 5.1 minor gets the $0.25 cache read, not the listed Mythos 5 rate", async () => {
    const { initPricing, estimateCost } = await import("../src/lib/pricing");
    await initPricing();
    expect(estimateCost("claude-mythos-5-1", 0, 0, 0, M)).toBe(0.25);
    expect(estimateCost("claude-mythos-5", 0, 0, 0, M)).toBe(1);
  });

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
