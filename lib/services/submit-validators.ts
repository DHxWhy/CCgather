/**
 * Submit-time validation rules — pure functions, no I/O, no exceptions on
 * normal paths. Each validator returns a list of flag codes (e.g., "V1_sum_mismatch")
 * describing detected issues.
 *
 * Design principles:
 *   1. Side-effect free — safe to call from anywhere
 *   2. Never throws on legitimate input — only on programmer errors
 *   3. Returns structured flags, not error messages — caller decides UX
 *   4. Conservative — only flag what we are highly confident is wrong
 */

import {
  CACHE_RATIO_SKIP_THRESHOLD,
  CACHE_TO_PRIMARY_RATIO_MAX,
  DAILY_COST_HARD_CAP_USD,
  DAILY_COST_SOFT_CAP_USD,
  DAILY_TOKEN_HARD_CAP,
  DAILY_TOKEN_SOFT_CAP,
  FUTURE_DATE_BUFFER_DAYS,
  MAX_DAILY_USAGE_LENGTH,
  TOKEN_SUM_TOLERANCE_ABSOLUTE,
  TOKEN_SUM_TOLERANCE_RELATIVE,
  TOTAL_COST_HARD_CAP_USD,
  TOTAL_TOKENS_HARD_CAP,
  type ValidationMode,
} from "@/lib/config/validation-thresholds";

// ── Types ───────────────────────────────────────────────────────────────────

export interface DailyUsageInput {
  date: string;
  tokens: number;
  cost?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface SubmitPayloadInput {
  totalTokens?: number;
  totalSpent?: number;
  dailyUsage?: DailyUsageInput[];
}

/**
 * Severity classification for downstream routing decisions.
 *   - HARD : reject submission (mode=hard) or flag (mode=soft|shadow)
 *   - SOFT : flag for admin review, never reject
 *   - INFO : observation only, no action
 */
export type FlagSeverity = "HARD" | "SOFT" | "INFO";

export interface Flag {
  code: string;
  severity: FlagSeverity;
  detail?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Coerce unknown to a non-negative finite number. Strictly defensive:
 *   - non-number, NaN, Infinity → 0
 *   - negative finite → 0 (clamp, prevents negative-token leaderboard exploits)
 */
const num = (v: unknown): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Render a user-supplied date value safely for log/detail strings.
 * Defensive against log-injection (\n / \r) and non-string inputs — even though
 * `validatePayloadShape` already flags malformed dates, downstream callers may
 * remove that upstream check (Phase 1C+), so each detail string self-protects.
 */
const safeDate = (d: unknown): string =>
  typeof d === "string" && ISO_DATE_RE.test(d) ? d : JSON.stringify(d);

/**
 * Today in UTC as YYYY-MM-DD. Centralized for testability.
 */
export function todayUTC(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Date string + N days, UTC. Pure date math, no timezone shifts.
 * Returns the input unchanged if the date string is malformed — fail-safe;
 * the malformed input will be caught upstream by `validatePayloadShape`.
 */
function addDaysUTC(yyyymmdd: string, days: number): string {
  const d = new Date(yyyymmdd + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) return yyyymmdd;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Individual validators ───────────────────────────────────────────────────

/**
 * V8/V9: Payload-level shape sanity.
 * Catches DoS (huge dailyUsage), overflow (totalTokens > 1e15), and malformed
 * inputs (non-array dailyUsage, malformed date strings) that could destabilize
 * downstream validators.
 */
export function validatePayloadShape(body: SubmitPayloadInput): Flag[] {
  const flags: Flag[] = [];
  const total = num(body.totalTokens);
  const spent = num(body.totalSpent);

  if (total > TOTAL_TOKENS_HARD_CAP) {
    flags.push({
      code: "V9_total_tokens_overflow",
      severity: "HARD",
      detail: `totalTokens=${total} exceeds hard cap ${TOTAL_TOKENS_HARD_CAP}`,
    });
  }
  if (spent > TOTAL_COST_HARD_CAP_USD) {
    flags.push({
      code: "V9_total_cost_overflow",
      severity: "HARD",
      detail: `totalSpent=$${spent} exceeds hard cap $${TOTAL_COST_HARD_CAP_USD}`,
    });
  }

  // dailyUsage must be an array (or absent). Non-array (e.g. object with length)
  // would crash for...of in downstream validators.
  if (body.dailyUsage !== undefined && !Array.isArray(body.dailyUsage)) {
    flags.push({
      code: "V8_daily_usage_not_array",
      severity: "HARD",
      detail: `dailyUsage is not an array (typeof=${typeof body.dailyUsage})`,
    });
    return flags; // bail early — downstream validators expect array
  }

  const arr = body.dailyUsage ?? [];
  if (arr.length > MAX_DAILY_USAGE_LENGTH) {
    flags.push({
      code: "V8_daily_usage_too_long",
      severity: "HARD",
      detail: `dailyUsage.length=${arr.length} exceeds cap ${MAX_DAILY_USAGE_LENGTH}`,
    });
  }

  // Each day's date must be ISO YYYY-MM-DD — string comparison in validateDate
  // relies on this format, and addDaysUTC needs it for safe Date parsing.
  for (const day of arr) {
    if (typeof day?.date !== "string" || !ISO_DATE_RE.test(day.date)) {
      flags.push({
        code: "V8_daily_date_malformed",
        severity: "HARD",
        detail: `date=${JSON.stringify(day?.date)} does not match YYYY-MM-DD`,
      });
    }
  }

  return flags;
}

/**
 * V1: Sum equation — total should equal input + output + cache_read + cache_write
 * within tolerance.
 *
 * Direction matters (verified against full live dataset, 2026-05-29):
 *   - sum < total : legacy / incomplete breakdown. Early CLI versions stored
 *                   total_tokens without a full per-type breakdown. ALL 8
 *                   mismatched rows in production are this direction — NOT an
 *                   attack. Emitted as INFO; never blocks, never queues review.
 *   - sum > total : breakdown exceeds total. Server recomputes cost FROM the
 *                   breakdown, so an inflated breakdown could inflate displayed
 *                   cost. Worth a SOFT review (0 such rows in production today).
 *                   Not HARD: CLI rounding/version quirks are possible and the
 *                   V2 cost cap already bounds magnitude.
 *
 * No code path returns HARD here — V1's blocking value is low because cost is
 * server-recomputed and the leaderboard score (total_tokens) is bounded by V2.
 */
export function validateTokenSum(day: DailyUsageInput): Flag[] {
  const flags: Flag[] = [];
  const total = num(day.tokens);
  const input = num(day.inputTokens);
  const output = num(day.outputTokens);
  const cacheRead = num(day.cacheReadTokens);
  const cacheWrite = num(day.cacheWriteTokens);

  // No breakdown at all (legacy clients) — can't validate the sum equation.
  // INFO-flag the "nonzero total, zero breakdown" case for rollout visibility.
  if (input === 0 && output === 0 && cacheRead === 0 && cacheWrite === 0) {
    if (total > 0) {
      flags.push({
        code: "V1_skipped_no_breakdown",
        severity: "INFO",
        detail: `date=${safeDate(day.date)} total=${total} but breakdown all zero — sum check skipped`,
      });
    }
    return flags;
  }

  const sum = input + output + cacheRead + cacheWrite;
  const diff = Math.abs(sum - total);
  const tolerance = Math.max(total * TOKEN_SUM_TOLERANCE_RELATIVE, TOKEN_SUM_TOLERANCE_ABSOLUTE);

  if (diff > tolerance) {
    if (sum > total) {
      flags.push({
        code: "V1_breakdown_exceeds_total",
        severity: "SOFT",
        detail: `date=${safeDate(day.date)} sum=${sum} > total=${total} diff=${diff} tolerance=${Math.round(tolerance)}`,
      });
    } else {
      flags.push({
        code: "V1_breakdown_incomplete",
        severity: "INFO",
        detail: `date=${safeDate(day.date)} sum=${sum} < total=${total} diff=${diff} tolerance=${Math.round(tolerance)} (legacy/incomplete breakdown)`,
      });
    }
  }
  return flags;
}

/**
 * V4: Future-date guard. Rejects dates more than FUTURE_DATE_BUFFER_DAYS
 * in the future (UTC).
 */
export function validateDate(day: DailyUsageInput, today: string = todayUTC()): Flag[] {
  const maxAllowed = addDaysUTC(today, FUTURE_DATE_BUFFER_DAYS);
  if (day.date > maxAllowed) {
    return [
      {
        code: "V4_future_date",
        severity: "HARD",
        detail: `date=${safeDate(day.date)} > maxAllowed=${maxAllowed} (today=${today})`,
      },
    ];
  }
  return [];
}

/**
 * V2: Daily caps. Hard cap rejects (when mode=hard). Soft cap flags for review.
 */
export function validateDailyCap(day: DailyUsageInput): Flag[] {
  const flags: Flag[] = [];
  const tokens = num(day.tokens);
  const cost = num(day.cost);

  const d = safeDate(day.date);
  if (tokens > DAILY_TOKEN_HARD_CAP) {
    flags.push({
      code: "V2_daily_tokens_hard",
      severity: "HARD",
      detail: `date=${d} tokens=${tokens} > ${DAILY_TOKEN_HARD_CAP}`,
    });
  } else if (tokens > DAILY_TOKEN_SOFT_CAP) {
    flags.push({
      code: "V2_daily_tokens_soft",
      severity: "SOFT",
      detail: `date=${d} tokens=${tokens} > soft cap ${DAILY_TOKEN_SOFT_CAP}`,
    });
  }

  if (cost > DAILY_COST_HARD_CAP_USD) {
    flags.push({
      code: "V2_daily_cost_hard",
      severity: "HARD",
      detail: `date=${d} cost=$${cost} > $${DAILY_COST_HARD_CAP_USD}`,
    });
  } else if (cost > DAILY_COST_SOFT_CAP_USD) {
    flags.push({
      code: "V2_daily_cost_soft",
      severity: "SOFT",
      detail: `date=${d} cost=$${cost} > soft cap $${DAILY_COST_SOFT_CAP_USD}`,
    });
  }
  return flags;
}

/**
 * V6: Cache-read inflation guard. Detects abnormally high cache_read/(input+output) ratio.
 * Skips when primary token count is too small to compute meaningful ratio.
 */
export function validateCacheRatio(day: DailyUsageInput): Flag[] {
  const cacheRead = num(day.cacheReadTokens);
  const primary = num(day.inputTokens) + num(day.outputTokens);

  if (primary < CACHE_RATIO_SKIP_THRESHOLD) return [];
  const ratio = cacheRead / primary;
  if (ratio > CACHE_TO_PRIMARY_RATIO_MAX) {
    return [
      {
        code: "V6_cache_ratio_high",
        severity: "SOFT",
        detail: `date=${safeDate(day.date)} cache_read/primary=${ratio.toFixed(0)} > ${CACHE_TO_PRIMARY_RATIO_MAX}`,
      },
    ];
  }
  return [];
}

/**
 * V2-aggregate: detect "same-date split" bypass attempts.
 *
 * Attack scenario: send dailyUsage = [{date:"X", tokens:30B}, {date:"X", tokens:30B}].
 * Each individual entry is below DAILY_TOKEN_HARD_CAP (35B), but the database
 * aggregates them into 60B for that date — circumventing the per-day cap.
 *
 * This validator groups entries by date and re-applies the daily caps to the sum.
 */
export function validateDailyAggregate(body: SubmitPayloadInput): Flag[] {
  const flags: Flag[] = [];
  if (!Array.isArray(body.dailyUsage) || body.dailyUsage.length < 2) return flags;

  const byDate = new Map<string, { tokens: number; cost: number; count: number }>();
  for (const day of body.dailyUsage) {
    if (typeof day?.date !== "string") continue;
    const cur = byDate.get(day.date) ?? { tokens: 0, cost: 0, count: 0 };
    cur.tokens += num(day.tokens);
    cur.cost += num(day.cost);
    cur.count += 1;
    byDate.set(day.date, cur);
  }

  for (const [date, agg] of byDate) {
    if (agg.count < 2) continue; // only flag actual duplicates
    const d = safeDate(date);

    flags.push({
      code: "V2_duplicate_date_entries",
      severity: "SOFT",
      detail: `date=${d} appears ${agg.count}× in dailyUsage (sum tokens=${agg.tokens})`,
    });

    if (agg.tokens > DAILY_TOKEN_HARD_CAP) {
      flags.push({
        code: "V2_aggregate_tokens_hard",
        severity: "HARD",
        detail: `date=${d} aggregate tokens=${agg.tokens} > ${DAILY_TOKEN_HARD_CAP}`,
      });
    }
    if (agg.cost > DAILY_COST_HARD_CAP_USD) {
      flags.push({
        code: "V2_aggregate_cost_hard",
        severity: "HARD",
        detail: `date=${d} aggregate cost=$${agg.cost} > $${DAILY_COST_HARD_CAP_USD}`,
      });
    }
  }
  return flags;
}

// ── Per-day helpers (used for DB persistence per usage_stats row) ────────────

/**
 * Run all per-day validators for a single day. Used by route.ts to attach
 * flags to the matching usage_stats row. Payload-level checks (V8/V9,
 * aggregate) are NOT included here — those are submission-scoped.
 */
export function validateSingleDay(day: DailyUsageInput, today: string = todayUTC()): Flag[] {
  return [
    ...validateTokenSum(day),
    ...validateDate(day, today),
    ...validateDailyCap(day),
    ...validateCacheRatio(day),
  ];
}

export type ReviewStatus = "clean" | "flagged" | "pending";

/**
 * Map a set of flags to a usage_stats.submission_review_status value.
 *   - any HARD  → "pending"  (needs a human look; never blocks the user)
 *   - any SOFT  → "flagged"  (logged for review queue)
 *   - else      → "clean"
 * INFO flags never change the status.
 */
export function computeReviewStatus(flags: Flag[]): ReviewStatus {
  if (flags.some((f) => f.severity === "HARD")) return "pending";
  if (flags.some((f) => f.severity === "SOFT")) return "flagged";
  return "clean";
}

// ── Integrated entry point ──────────────────────────────────────────────────

export interface ValidationResult {
  flags: Flag[];
  hardViolations: Flag[];
  softViolations: Flag[];
  /**
   * True if any HARD severity flag exists. Used only to decide whether to send
   * a Discord alert — NEVER to reject the submission.
   */
  hasHardViolation: boolean;
  /**
   * Compact list of flag codes for logging/DB storage.
   */
  codes: string[];
}

/**
 * Run all validators. Returns structured result — never throws on data issues.
 * Callers should still wrap in try-catch in case of programmer error.
 *
 * `_mode` parameter is reserved for future per-mode validator gating (e.g., skip
 * V6 in soft mode). Intentionally unused in 1B-b: caller (route.ts) decides
 * rejection based on `hasHardViolation` + current ENV mode. Keep the parameter
 * to lock the signature ahead of Phase 1C+ usage.
 */
export function runAllValidations(
  body: SubmitPayloadInput,
  _mode: ValidationMode = "log",
  today: string = todayUTC()
): ValidationResult {
  const flags: Flag[] = [];

  // Payload-level
  flags.push(...validatePayloadShape(body));

  // Cross-row: detect duplicate-date aggregation bypass
  flags.push(...validateDailyAggregate(body));

  // Per-day (guard against non-array — validatePayloadShape already flags it)
  const days = Array.isArray(body.dailyUsage) ? body.dailyUsage : [];
  for (const day of days) {
    flags.push(...validateSingleDay(day, today));
  }

  const hardViolations = flags.filter((f) => f.severity === "HARD");
  const softViolations = flags.filter((f) => f.severity === "SOFT");

  return {
    flags,
    hardViolations,
    softViolations,
    hasHardViolation: hardViolations.length > 0,
    codes: flags.map((f) => f.code),
  };
}
