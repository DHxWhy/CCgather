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

  describe("Fable 5 / Mythos 5 use the premium $10/$50 tier", () => {
    it.each(["claude-fable-5", "claude-mythos-5"])("%s => $60", (model) => {
      expect(estimateCost(model, M, M, 0, 0)).toBe(60);
    });
  });

  describe("Non-Opus families are unaffected", () => {
    it("claude-sonnet-5 => $18 ($3/$15)", () => {
      expect(estimateCost("claude-sonnet-5", M, M, 0, 0)).toBe(18);
    });
    it("claude-haiku-4-5 => $6 ($1/$5)", () => {
      expect(estimateCost("claude-haiku-4-5", M, M, 0, 0)).toBe(6);
    });
  });
});
