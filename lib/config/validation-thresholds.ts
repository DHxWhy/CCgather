/**
 * Submit validation thresholds — single source of truth for all caps and tolerances.
 *
 * Calibration baseline (measured 2026-05-29, top 2 heavy users):
 *   - @dprvda  : daily max 6.70B tokens / $4,012, avg 1.73B
 *   - @stevekwon211 : daily max 5.02B / $3,144, avg 1.35B
 *
 * Hard caps are set to ~5.2x the observed daily maximum to protect legit power
 * users. Soft caps trigger admin review without rejection.
 *
 * Re-calibration: re-measure baseline quarterly OR when Anthropic ships major
 * model/pricing changes (e.g., cache-read price adjustment) — heavy users may
 * shift cache patterns significantly within months.
 *
 * Thresholds are SHADOW-mode-safe: changes here never break submissions until
 * SUBMIT_VALIDATION_MODE is explicitly set to "soft" or "hard".
 */

// ── V1: Token sum equation tolerance ────────────────────────────────────────
// total_tokens should equal input + output + cache_read + cache_write.
// Allow rounding slack: max(total * RELATIVE, ABSOLUTE) — whichever is larger.
export const TOKEN_SUM_TOLERANCE_RELATIVE = 0.005; // 0.5%
export const TOKEN_SUM_TOLERANCE_ABSOLUTE = 1_000; // 1000 token floor

// ── V2: Daily caps ──────────────────────────────────────────────────────────
// Hard cap = reject. Soft cap = flag for admin review (no rejection).
// 35B = dprvda peak 6.70B × 5.22 (hard). 20B ≈ × 3 (soft, admin review trigger).
// $20K = dprvda peak $4012 × 4.99 (hard). $10K ≈ × 2.5 (soft).
export const DAILY_TOKEN_HARD_CAP = 35_000_000_000; // 35B
export const DAILY_TOKEN_SOFT_CAP = 20_000_000_000; // 20B
export const DAILY_COST_HARD_CAP_USD = 20_000; // $20K
export const DAILY_COST_SOFT_CAP_USD = 10_000; // $10K

// ── V4: Date validation ─────────────────────────────────────────────────────
// Reject dates more than N days in the future (UTC).
// 1-day buffer covers UTC+14 timezone edge (Kiribati) and clock skew.
export const FUTURE_DATE_BUFFER_DAYS = 1;

// ── V6: Cache-read inflation prevention ─────────────────────────────────────
// cache_read tokens cost ~1/10 of input — could theoretically be inflated.
// However, real heavy-cache power-user data shows wide natural variance
// (full-dataset audit 2026-05-29, all 20 active users):
//   - dprvda    : 60-day max single-day ratio 3,081
//   - stevekwon211 : 62-day max 9,092 (low-primary debug day)
//   - Hoyuo     : max 18,215 (big context re-read, tiny generation — legit)
// Cap at 25,000 (~1.37x observed max) keeps legit users out of the review queue.
// V6 is a SECONDARY signal: cache-read inflation also trips the V2 daily token
// cap (35B) and inflates server-recomputed cost (which V2 cost cap bounds), so
// V6 only needs to catch the truly absurd. SOFT severity = flag only, never reject.
// Re-calibrate quarterly OR when Anthropic ships cache-pricing changes.
export const CACHE_TO_PRIMARY_RATIO_MAX = 25_000;
// Skip ratio check when primary tokens are tiny — natural variance is too high
// to make ratio meaningful. Cache-only short bursts (context re-read without
// generation) are legitimate and should not be flagged.
export const CACHE_RATIO_SKIP_THRESHOLD = 1_000;

// ── V8: Payload shape ───────────────────────────────────────────────────────
// dailyUsage array length — 730 days = 2 years (Reviewer Core adjusted from 400).
// Covers reasonable backfill scenarios while preventing DoS via huge arrays.
export const MAX_DAILY_USAGE_LENGTH = 730;

// ── V9: Numerical overflow guards ───────────────────────────────────────────
// Prevent BIGINT overflow at PG level (max ~9.2e18, we cap much earlier).
// 1e15 = 1 quadrillion tokens — far beyond any realistic use.
export const TOTAL_TOKENS_HARD_CAP = 1e15;
// Aligns with viberank's reference total ceiling ($5k/day × 365).
export const TOTAL_COST_HARD_CAP_USD = 1_825_000;

// ── Mode definitions ────────────────────────────────────────────────────────
// Validation NEVER blocks a submission. There is no "reject" mode by design:
// CCgather does not block a user over usage numbers (product philosophy +
// guarantees zero false-positive risk for legit users). Mode controls
// side-effects only:
//   off    → validators do not run at all
//   log    → run + structured log line (no DB write, no alert)
//   notify → run + persist flags to DB + Discord alert on HARD findings
export type ValidationMode = "off" | "log" | "notify";

// Default is "notify": flags are persisted and HARD issues alert the team.
// Submission still always succeeds. Set SUBMIT_VALIDATION_MODE=off|log to dial down.
export const DEFAULT_VALIDATION_MODE: ValidationMode = "notify";

/**
 * Parse mode from environment variable. Unknown / missing values fall back to
 * the default (notify) — fail-safe in the "observe more" direction, never the
 * "block" direction (blocking does not exist). Tolerates whitespace and casing.
 */
export function parseValidationMode(raw: string | undefined | null): ValidationMode {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "off" || normalized === "log") return normalized;
  return DEFAULT_VALIDATION_MODE;
}
