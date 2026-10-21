// Fast mode multiplies a request's whole token cost. Opus 5.5 / 5 / 4.8: official
// pricing page ("Fast mode pricing" — $8/$40 and $10/$50, 2x the standard rates).
// Opus 4.6 / 4.7: ccusage's fast-multiplier-overrides.json. Ids not listed pay 1x.
export const FAST_MODE_MULTIPLIERS = {
  "claude-opus-5-5": 2,
  "claude-opus-5": 2,
  "claude-opus-4-8": 2,
  "claude-opus-4-7": 6,
  "claude-opus-4-6": 6,
} as const satisfies Record<string, number>;
