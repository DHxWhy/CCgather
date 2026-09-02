import { describe, it, expect } from "vitest";
import { estimateCost } from "../src/lib/pricing";

const M = 1_000_000;

describe("estimateCost fallback tier (no LiteLLM data)", () => {
  describe("Opus 5+ resolves to the current $5/$25 tier", () => {
    it.each([
      "claude-opus-5",
      "claude-opus-5-20260101",
      "anthropic.claude-opus-5",
      "us.anthropic.claude-opus-5",
      "claude-opus-6",
    ])("%s => $30 for 1M in + 1M out", (model) => {
      expect(estimateCost(model, M, M, 0, 0)).toBe(30);
    });

    it("claude-opus-5 cache tokens use $6.25 write / $0.50 read", () => {
      expect(estimateCost("claude-opus-5", 0, 0, M, M)).toBe(6.75);
    });
  });

  describe("Opus 4.5–4.19 stay on the $5/$25 tier", () => {
    it.each(["claude-opus-4-5", "claude-opus-4-8", "claude-opus-4-10"])("%s => $30", (model) => {
      expect(estimateCost(model, M, M, 0, 0)).toBe(30);
    });
  });

  describe("Legacy Opus 4 / 4.1 / 3 stay on the $15/$75 tier", () => {
    it.each(["claude-opus-4-20250514", "claude-opus-4-1", "claude-3-opus-20240229"])(
      "%s => $90",
      (model) => {
        expect(estimateCost(model, M, M, 0, 0)).toBe(90);
      }
    );
  });

  describe("Fable 5 / Mythos 5 / Mythos Preview: $10/$50, cache read $1 (0.1x)", () => {
    it.each(["claude-fable-5", "claude-mythos-5", "claude-mythos-preview"])(
      "%s => $60 in+out, $13.50 cache",
      (model) => {
        expect(estimateCost(model, M, M, 0, 0)).toBe(60);
        expect(estimateCost(model, 0, 0, M, M)).toBe(13.5);
      }
    );
  });

  describe("Fable 5.1 / Mythos 5.1: same $10/$50 but cache read $0.25 (0.025x)", () => {
    it.each([
      "claude-fable-5-1",
      "claude-mythos-5-1",
      "anthropic.claude-fable-5-1",
      "claude-fable-5-10",
    ])("%s => $60 in+out, $12.75 cache", (model) => {
      expect(estimateCost(model, M, M, 0, 0)).toBe(60);
      expect(estimateCost(model, 0, 0, M, M)).toBe(12.75);
    });
  });

  describe("Sonnet 5 is $2/$10; Sonnet 4.x / 3.x stay $3/$15", () => {
    it("claude-sonnet-5 => $12 in+out, $2.70 cache", () => {
      expect(estimateCost("claude-sonnet-5", M, M, 0, 0)).toBe(12);
      expect(estimateCost("claude-sonnet-5", 0, 0, M, M)).toBe(2.7);
    });
    it.each([
      "claude-sonnet-4-6",
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-4-20250514",
      "claude-3-7-sonnet-20250219",
    ])("%s => $18", (model) => {
      expect(estimateCost(model, M, M, 0, 0)).toBe(18);
    });
  });

  describe("Haiku", () => {
    it("claude-haiku-4-5 => $6 ($1/$5)", () => {
      expect(estimateCost("claude-haiku-4-5", M, M, 0, 0)).toBe(6);
    });
  });
});
