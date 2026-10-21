import { describe, it, expect } from "vitest";
import { cacheWrite1hRate, extractClaudePricing, getModelPricing } from "@/lib/services/pricing";
import type { PricingTable } from "@/lib/services/official-pricing";
import snapshot from "@/lib/constants/claude-pricing.json";

// 1-hour cache writes cost 2x the base input price; 5-minute writes cost 1.25x
// (platform.claude.com/docs/en/about-claude/pricing, "Prompt caching").
describe("1-hour cache write rate", () => {
  // Compared with the snapshot entry, not a copied number: the hourly sync rewrites the
  // snapshot when the official table changes, and a pinned price would fail that gate.
  it("comes from the official snapshot when the model is listed", () => {
    const listed = (snapshot.models as PricingTable)["claude-opus-5-5"];
    expect(listed?.cacheWrite1h).toBeDefined();
    expect(getModelPricing("claude-opus-5-5", null)).toEqual(listed);
  });

  it("uses a listed price as it is, even when it is not twice the input", () => {
    expect(
      cacheWrite1hRate({ input: 4, output: 20, cacheWrite: 5, cacheWrite1h: 9, cacheRead: 0.2 })
    ).toBe(9);
  });

  it("is twice the input price for a model only the fallback table knows", () => {
    expect(cacheWrite1hRate(getModelPricing("anthropic.claude-opus-5-18-20991231", null))).toBe(8);
    expect(cacheWrite1hRate(getModelPricing("claude-opus-5-19", null))).toBe(8);
    expect(cacheWrite1hRate(getModelPricing("claude-opus-4-9", null))).toBe(10);
    expect(cacheWrite1hRate(getModelPricing("some-unknown-model", null))).toBe(6);
  });

  it("falls back to twice the input price when a table lists 0 or a non-number", () => {
    expect(
      cacheWrite1hRate({ input: 4, output: 20, cacheWrite: 5, cacheWrite1h: 0, cacheRead: 0.2 })
    ).toBe(8);
    expect(
      cacheWrite1hRate({
        input: 4,
        output: 20,
        cacheWrite: 5,
        cacheWrite1h: Number.NaN,
        cacheRead: 0.2,
      })
    ).toBe(8);
  });

  it("is read from LiteLLM's above_1hr field", () => {
    const table = extractClaudePricing({
      "claude-opus-5-5-preview": {
        input_cost_per_token: 4e-6,
        output_cost_per_token: 2e-5,
        cache_creation_input_token_cost: 5e-6,
        cache_creation_input_token_cost_above_1hr: 8e-6,
        cache_read_input_token_cost: 2e-7,
      },
    });
    expect(table["claude-opus-5-5-preview"]?.cacheWrite1h).toBe(8);
  });

  it("leaves the 1h price unset when LiteLLM has no above_1hr field", () => {
    const table = extractClaudePricing({
      "claude-opus-5-5-preview": { input_cost_per_token: 4e-6, output_cost_per_token: 2e-5 },
    });
    const price = table["claude-opus-5-5-preview"];
    expect(price?.cacheWrite1h).toBeUndefined();
    expect(price && cacheWrite1hRate(price)).toBe(8);
  });
});
