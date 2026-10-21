import { describe, it, expect } from "vitest";
import { cacheWrite1hRate, extractClaudePricing, getModelPricing } from "@/lib/services/pricing";

// 1-hour cache writes cost 2x the base input price; 5-minute writes cost 1.25x
// (platform.claude.com/docs/en/about-claude/pricing, "Prompt caching").
describe("1-hour cache write rate", () => {
  it("comes from the official snapshot when the model is listed", () => {
    expect(cacheWrite1hRate(getModelPricing("claude-opus-5-5", null))).toBe(8);
    expect(cacheWrite1hRate(getModelPricing("claude-fable-5-1", null))).toBe(20);
  });

  it("is twice the input price for a model only the fallback table knows", () => {
    expect(cacheWrite1hRate(getModelPricing("claude-opus-4-9", null))).toBe(10);
    expect(cacheWrite1hRate(getModelPricing("some-unknown-model", null))).toBe(6);
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
});
