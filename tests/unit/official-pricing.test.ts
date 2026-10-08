import { describe, it, expect } from "vitest";
import {
  checkSnapshot,
  MIN_MODELS,
  modelNameToId,
  parseOfficialPricing,
  type PricingTable,
} from "@/lib/services/official-pricing";
import { computeDayCost } from "@/lib/services/pricing";
import snapshot from "@/lib/constants/claude-pricing.json";

// Rows copied from the live page (2026-09-24), including the link / <sup> noise.
const PAGE = `
## Model pricing

| Model | Base input tokens | 5m cache writes | 1h cache writes | Cache hits and refreshes | Output tokens |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Claude Fable 5.1 | $10 / MTok | $12.50 / MTok | $20 / MTok | $0.25 / MTok<sup>1</sup> | $50 / MTok |
| Claude Mythos 5 ([limited availability](https://anthropic.com/glasswing)) | $10 / MTok | $12.50 / MTok | $20 / MTok | $1 / MTok | $50 / MTok |
| Claude Opus 5.5 | $4 / MTok | $5 / MTok | $8 / MTok | $0.20 / MTok<sup>2</sup> | $20 / MTok |
| Claude Opus 4.1 ([retired, except on Bedrock and Google Cloud](https://x/y)) | $15 / MTok | $18.75 / MTok | $30 / MTok | $1.50 / MTok | $75 / MTok |
| Claude Sonnet 5 | $2 / MTok<sup>3</sup> | $2.50 / MTok | $4 / MTok | $0.20 / MTok | $10 / MTok<sup>3</sup> |
| Claude Haiku 5.5 (for prompts up to 100,000 tokens) | $0.10 / MTok | $0.125 / MTok | $0.20 / MTok | $0.01 / MTok | $0.50 / MTok |
| Claude Haiku 5.5 (for prompts over 100,000 tokens) | $0.50 / MTok | $0.625 / MTok | $1 / MTok | $0.05 / MTok | $2.50 / MTok |
| Claude Haiku 3.5 ([retired](https://x)) | $0.80 / MTok | $1 / MTok | $1.60 / MTok | $0.08 / MTok | $4 / MTok |

## Cloud platform pricing

| Claude Opus 9 | $999 / MTok | $1 | $1 | $1 | $1 |
`;

describe("parseOfficialPricing", () => {
  const t = parseOfficialPricing(PAGE);

  it("maps display names to API ids and strips links / footnotes", () => {
    expect(Object.keys(t)).toEqual([
      "claude-fable-5-1",
      "claude-mythos-5",
      "claude-opus-5-5",
      "claude-opus-4-1",
      "claude-sonnet-5",
      "claude-haiku-5-5",
      "claude-haiku-3-5",
    ]);
  });

  it("reads the per-model cache-read exceptions from the table itself", () => {
    expect(t["claude-opus-5-5"]).toEqual({ input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 });
    expect(t["claude-fable-5-1"]?.cacheRead).toBe(0.25);
    expect(t["claude-haiku-3-5"]).toEqual({
      input: 0.8,
      output: 4,
      cacheWrite: 1,
      cacheRead: 0.08,
    });
  });

  it("keeps the first row when a model is split by prompt length (Haiku 5.5 tiers)", () => {
    // The page lists Haiku 5.5 twice (≤100K and >100K tokens). The first row is the
    // standard tier and matches LiteLLM/ccusage; the later row must not overwrite it.
    expect(t["claude-haiku-5-5"]).toEqual({
      input: 0.1,
      output: 0.5,
      cacheWrite: 0.125,
      cacheRead: 0.01,
    });
  });

  it("ignores tables outside the Model pricing section", () => {
    expect(t["claude-opus-9"]).toBeUndefined();
  });

  it("modelNameToId rejects non-model rows", () => {
    expect(modelNameToId(" Model ")).toBeNull();
    expect(modelNameToId(" :---- ")).toBeNull();
  });
});

describe("checkSnapshot", () => {
  const base: PricingTable = Object.fromEntries(
    Array.from({ length: MIN_MODELS }, (_, i) => [
      `claude-opus-4-${i + 5}`,
      { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
    ])
  );

  it("accepts a new model", () => {
    const next = {
      ...base,
      "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
    };
    expect(checkSnapshot(base, next, null).ok).toBe(true);
  });

  it("blocks a truncated parse", () => {
    const one = { "claude-opus-4-5": base["claude-opus-4-5"]! };
    expect(checkSnapshot(one, one, null).blockers).toEqual([
      `parsed only 1 models (< ${MIN_MODELS})`,
    ]);
  });

  it("blocks a removed model", () => {
    const next = { ...base };
    delete next["claude-opus-4-5"];
    next["claude-opus-5-5"] = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 };
    expect(checkSnapshot(base, next, null).blockers).toContain(
      "claude-opus-4-5: removed from the official table"
    );
  });

  it("blocks a >50% price swing but allows a small one", () => {
    const swing = {
      ...base,
      "claude-opus-4-5": { input: 50, output: 250, cacheWrite: 62.5, cacheRead: 5 },
    };
    expect(checkSnapshot(base, swing, null).ok).toBe(false);
    const small = {
      ...base,
      "claude-opus-4-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.4 },
    };
    expect(checkSnapshot(base, small, null).ok).toBe(true);
  });

  it("warns on a new family and on LiteLLM disagreement without blocking", () => {
    const next = {
      ...base,
      "claude-lyric-1": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
    };
    const litellm = { "claude-opus-4-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 1 } };
    const r = checkSnapshot(base, next, litellm);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes('new model family "lyric"'))).toBe(true);
    expect(r.warnings).toContain("claude-opus-4-5.cacheRead: official 0.5 vs LiteLLM 1");
  });
});

describe("committed snapshot", () => {
  it("passes its own safety checks", () => {
    const models = snapshot.models as PricingTable;
    expect(checkSnapshot(models, models, null).blockers).toEqual([]);
  });

  it("wins over a wrong LiteLLM price", () => {
    const wrong = { "claude-opus-5-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 } };
    const day = {
      model: "claude-opus-5-5",
      inputTokens: 1e6,
      outputTokens: 1e6,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    };
    expect(computeDayCost(wrong, day)).toBe(24);
  });
});
