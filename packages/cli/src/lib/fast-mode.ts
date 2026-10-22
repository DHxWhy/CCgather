// Copy of the server's table (lib/services/fast-mode.ts) for the CLI's local estimate;
// tests/unit/fast-mode-parity.test.ts holds the two equal. Fast mode multiplies a
// request's whole token cost. Ids not listed pay 1x.
export const FAST_MODE_MULTIPLIERS = {
  "claude-opus-5-5": 2,
  "claude-opus-5": 2,
  "claude-opus-4-8": 2,
  "claude-opus-4-7": 6,
  "claude-opus-4-6": 6,
} as const satisfies Record<string, number>;
