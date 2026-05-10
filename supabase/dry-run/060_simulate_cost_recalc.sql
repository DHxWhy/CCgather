-- ═══════════════════════════════════════════════════════════════════════════
-- DRY-RUN ONLY — DO NOT APPLY THIS FILE TO PRODUCTION
--
-- Purpose:
--   Simulate the impact of correcting cost_usd for rows whose primary_model
--   is Opus 4 / 4.1 (legacy higher-tier pricing). Migration 053 incorrectly
--   recomputed every "%opus%" row using Opus 4.5 pricing ($5/$25 per MTok),
--   underestimating Opus 4 / 4.1 actual cost by ~3x.
--
-- This file contains ONLY SELECT queries. It does NOT modify any data.
--
-- How to run:
--   1. Copy each query into Supabase Dashboard → SQL Editor.
--   2. Review the output before deciding whether to apply the corresponding
--      UPDATE migration (`061_correct_opus4_cost.sql`, kept separate).
--   3. If you decide NOT to apply the correction, document the decision in
--      a project note and leave the existing cost values as-is.
--
-- Pricing reference (per million tokens, from claude.com/pricing):
--   Opus 4 / 4.1   : input $15  / output $75  / cache_write $18.75 / cache_read $1.50
--   Opus 4.5 / 4.6 / 4.7 : input $5  / output $25  / cache_write $6.25 / cache_read $0.50
--
-- Detection rule:
--   primary_model ILIKE '%opus-4-1%' OR primary_model ILIKE '%opus-4-2025%'
--   OR primary_model ~ '%opus-4($|[^0-9])%'  (Opus 4 base, not 4.5/4.6/4.7)
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- Q1: Inventory — how many usage_stats rows are affected, by model bucket?
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  CASE
    WHEN primary_model ILIKE '%opus-4-7%' THEN 'opus-4-7 (current, no change)'
    WHEN primary_model ILIKE '%opus-4-6%' THEN 'opus-4-6 (current, no change)'
    WHEN primary_model ILIKE '%opus-4-5%' THEN 'opus-4-5 (current, no change)'
    WHEN primary_model ILIKE '%opus-4-1%' OR primary_model ILIKE '%opus-4.1%' THEN 'opus-4-1 (LEGACY, NEEDS CORRECTION)'
    WHEN primary_model ~ 'opus-4($|[-_.][^567])' THEN 'opus-4 base (LEGACY, NEEDS CORRECTION)'
    WHEN primary_model ILIKE '%opus-3%' THEN 'opus-3 (legacy)'
    WHEN primary_model ILIKE '%opus%' THEN 'opus other'
    ELSE 'non-opus'
  END AS bucket,
  COUNT(*) AS rows,
  ROUND(SUM(cost_usd)::numeric, 2) AS current_total_cost,
  ROUND(SUM(input_tokens)::numeric / 1000000, 2) AS input_mtok,
  ROUND(SUM(output_tokens)::numeric / 1000000, 2) AS output_mtok
FROM usage_stats
GROUP BY bucket
ORDER BY rows DESC;


-- ─────────────────────────────────────────────────────────────────────────
-- Q2: Per-user impact preview — how much each affected user's total_cost
--     would change if migration 061 were applied.
--     Uses 3x multiplier as a quick approximation (Opus 4 prices = 3x Opus 4.5).
--     The real correction is per-row using exact prices below.
-- ─────────────────────────────────────────────────────────────────────────
WITH legacy_opus AS (
  SELECT
    user_id,
    SUM(cost_usd) AS current_legacy_opus_cost,
    SUM(
      ROUND((
        (COALESCE(input_tokens, 0)       * 15.0   / 1000000) +
        (COALESCE(output_tokens, 0)      * 75.0   / 1000000) +
        (COALESCE(cache_write_tokens, 0) * 18.75  / 1000000) +
        (COALESCE(cache_read_tokens, 0)  * 1.5    / 1000000)
      )::numeric, 2)
    ) AS corrected_legacy_opus_cost
  FROM usage_stats
  WHERE primary_model ILIKE '%opus-4-1%'
     OR primary_model ILIKE '%opus-4.1%'
     OR primary_model ~ 'opus-4($|[-_.][^567])'
  GROUP BY user_id
),
user_totals AS (
  SELECT user_id, SUM(cost_usd) AS current_total_cost
  FROM usage_stats
  GROUP BY user_id
)
SELECT
  u.username,
  ROUND(ut.current_total_cost::numeric, 2)              AS current_total_cost,
  ROUND(lo.current_legacy_opus_cost::numeric, 2)        AS opus4_current,
  ROUND(lo.corrected_legacy_opus_cost::numeric, 2)      AS opus4_corrected,
  ROUND((lo.corrected_legacy_opus_cost - lo.current_legacy_opus_cost)::numeric, 2) AS delta,
  ROUND((ut.current_total_cost + (lo.corrected_legacy_opus_cost - lo.current_legacy_opus_cost))::numeric, 2)
                                                        AS new_total_cost,
  ROUND(((lo.corrected_legacy_opus_cost - lo.current_legacy_opus_cost) / NULLIF(ut.current_total_cost, 0) * 100)::numeric, 1)
                                                        AS pct_change
FROM legacy_opus lo
JOIN user_totals ut ON ut.user_id = lo.user_id
JOIN users u ON u.id = lo.user_id
WHERE lo.current_legacy_opus_cost > 0
ORDER BY ABS(lo.corrected_legacy_opus_cost - lo.current_legacy_opus_cost) DESC
LIMIT 50;


-- ─────────────────────────────────────────────────────────────────────────
-- Q3: Aggregate — total $ delta across the platform.
--     Use this to decide whether the correction is worth the user-facing
--     disruption (e.g., "leaderboard cost values jump for N users by $X total").
-- ─────────────────────────────────────────────────────────────────────────
WITH legacy_opus AS (
  SELECT
    SUM(cost_usd) AS current_total,
    SUM(
      ROUND((
        (COALESCE(input_tokens, 0)       * 15.0   / 1000000) +
        (COALESCE(output_tokens, 0)      * 75.0   / 1000000) +
        (COALESCE(cache_write_tokens, 0) * 18.75  / 1000000) +
        (COALESCE(cache_read_tokens, 0)  * 1.5    / 1000000)
      )::numeric, 2)
    ) AS corrected_total,
    COUNT(*)                       AS row_count,
    COUNT(DISTINCT user_id)        AS user_count
  FROM usage_stats
  WHERE primary_model ILIKE '%opus-4-1%'
     OR primary_model ILIKE '%opus-4.1%'
     OR primary_model ~ 'opus-4($|[-_.][^567])'
)
SELECT
  row_count,
  user_count,
  ROUND(current_total::numeric, 2)                       AS current_legacy_opus_cost_sum,
  ROUND(corrected_total::numeric, 2)                     AS corrected_legacy_opus_cost_sum,
  ROUND((corrected_total - current_total)::numeric, 2)   AS total_delta,
  ROUND(((corrected_total - current_total) / NULLIF(current_total, 0) * 100)::numeric, 1)
                                                         AS pct_change
FROM legacy_opus;


-- ─────────────────────────────────────────────────────────────────────────
-- Q4: Sample 20 rows — eyeball check that the detection rule classifies
--     primary_model strings the way you expect.
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  primary_model,
  COUNT(*) AS rows,
  CASE
    WHEN primary_model ILIKE '%opus-4-1%' OR primary_model ILIKE '%opus-4.1%' THEN 'CORRECT to legacy'
    WHEN primary_model ~ 'opus-4($|[-_.][^567])' THEN 'CORRECT to legacy'
    WHEN primary_model ILIKE '%opus-4-5%' OR primary_model ILIKE '%opus-4.5%'
      OR primary_model ILIKE '%opus-4-6%' OR primary_model ILIKE '%opus-4.6%'
      OR primary_model ILIKE '%opus-4-7%' OR primary_model ILIKE '%opus-4.7%' THEN 'KEEP current pricing'
    ELSE 'NOT opus / unaffected'
  END AS classification
FROM usage_stats
WHERE primary_model ILIKE '%opus%'
GROUP BY primary_model
ORDER BY rows DESC
LIMIT 30;
