import { describe, it, expect } from "vitest";
import { computeDayCost } from "@/lib/services/pricing";

// Expected values are the official per-MTok rates
// (platform.claude.com/docs/en/about-claude/pricing, verified 2026-09-02),
// evaluated with 1M tokens of each type — not copied from the fallback table.
const M = 1_000_000;
const inOut = (model: string) => ({
  model,
  inputTokens: M,
  outputTokens: M,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
});
const cache = (model: string) => ({
  model,
  inputTokens: 0,
  outputTokens: 0,
  cacheWriteTokens: M,
  cacheReadTokens: M,
});

describe("fallback pricing (no LiteLLM data)", () => {
  describe("Fable 5.1 / Mythos 5.1: $10/$50, cache write $12.50, cache read $0.25 (0.025x)", () => {
    it.each([
      "claude-fable-5-1",
      "claude-mythos-5-1",
      "anthropic.claude-fable-5-1",
      "claude-fable-5-10",
    ])("%s", (model) => {
      expect(computeDayCost(null, inOut(model))).toBe(60);
      expect(computeDayCost(null, cache(model))).toBe(12.75);
    });
  });

  describe("Fable 5 / Mythos 5 / Mythos Preview: cache read stays $1 (0.1x)", () => {
    it.each(["claude-fable-5", "claude-mythos-5", "claude-mythos-preview"])("%s", (model) => {
      expect(computeDayCost(null, inOut(model))).toBe(60);
      expect(computeDayCost(null, cache(model))).toBe(13.5);
    });
  });

  describe("Sonnet 5: $2/$10, cache write $2.50, cache read $0.20", () => {
    it("claude-sonnet-5", () => {
      expect(computeDayCost(null, inOut("claude-sonnet-5"))).toBe(12);
      expect(computeDayCost(null, cache("claude-sonnet-5"))).toBe(2.7);
    });
  });

  describe("Sonnet 4.x / 3.x stay $3/$15", () => {
    it.each([
      "claude-sonnet-4-6",
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-4-20250514",
      "claude-3-7-sonnet-20250219",
    ])("%s", (model) => {
      expect(computeDayCost(null, inOut(model))).toBe(18);
      expect(computeDayCost(null, cache(model))).toBe(4.05);
    });
  });

  describe("Opus tiers unchanged", () => {
    it.each(["claude-opus-5", "claude-opus-4-8", "claude-opus-4-5-20251101"])(
      "%s => $5/$25",
      (model) => {
        expect(computeDayCost(null, inOut(model))).toBe(30);
      }
    );
    it.each(["claude-opus-4-1-20250805", "claude-opus-4-20250514"])(
      "%s => legacy $15/$75",
      (model) => {
        expect(computeDayCost(null, inOut(model))).toBe(90);
      }
    );
  });

  it("claude-haiku-4-5-20251001 => $1/$5", () => {
    expect(computeDayCost(null, inOut("claude-haiku-4-5-20251001"))).toBe(6);
  });
});

describe("LiteLLM table present but id unlisted — family guard beats fuzzy prefix match", () => {
  // Only the previous minor is listed; a startsWith match would inherit its $1 cache read.
  const table = {
    "claude-mythos-5": { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1 },
    "claude-fable-5": { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1 },
  };

  it("claude-mythos-5-1 gets the 5.1 cache-read rate, not Mythos 5's", () => {
    expect(computeDayCost(table, cache("claude-mythos-5-1"))).toBe(12.75);
  });

  it("claude-fable-5 with an exact entry still uses the table", () => {
    expect(computeDayCost(table, cache("claude-fable-5"))).toBe(13.5);
  });
});
