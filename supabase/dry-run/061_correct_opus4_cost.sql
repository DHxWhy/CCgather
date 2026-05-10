-- ═══════════════════════════════════════════════════════════════════════════
-- DEFERRED MIGRATION — DO NOT APPLY WITHOUT REVIEWING DRY-RUN OUTPUT FIRST
--
-- This file is intentionally placed in `supabase/dry-run/` (not in
-- `supabase/migrations/`) because applying it WILL change the visible
-- total_cost values for users who used Opus 4 / 4.1.
--
-- Workflow:
--   1. Run `060_simulate_cost_recalc.sql` first.
--   2. Review per-user delta and aggregate impact.
--   3. If you decide to apply:
--      a. (Optional) Send user-facing announcement: "We're correcting cost
--         display for Opus 4 / 4.1 sessions. Your $ will go up; tokens are
--         unchanged. Background: migration 053 used a single Opus rate."
--      b. Move this file to `supabase/migrations/061_correct_opus4_cost.sql`.
--      c. Run via Supabase Dashboard → SQL Editor.
--   4. If you decide NOT to apply: leave it here. New submissions are already
--      accurate per-message via the corrected pricing.ts.
--
-- Pricing reference (per million tokens, claude.com/pricing 2026-05):
--   Opus 4 / 4.1   : input $15 / output $75 / cache_write $18.75 / cache_read $1.50
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Step 1: Recalculate cost_usd ONLY for rows whose primary_model is
--         Opus 4 (base) or Opus 4.1 — these are the rows migration 053
--         underestimated. Opus 4.5 / 4.6 / 4.7 keep their current correct
--         values ($5/$25 tier).
UPDATE usage_stats
SET cost_usd = ROUND((
  (COALESCE(input_tokens, 0)       * 15.0   / 1000000) +
  (COALESCE(output_tokens, 0)      * 75.0   / 1000000) +
  (COALESCE(cache_write_tokens, 0) * 18.75  / 1000000) +
  (COALESCE(cache_read_tokens, 0)  * 1.5    / 1000000)
)::numeric, 2)
WHERE primary_model ILIKE '%opus-4-1%'
   OR primary_model ~ 'opus-4($|[-_][^567])';

-- Step 2: Recompute users.total_cost from the corrected usage_stats.
UPDATE users u
SET total_cost = sub.new_cost
FROM (
  SELECT user_id, ROUND(SUM(cost_usd)::numeric, 2) AS new_cost
  FROM usage_stats
  GROUP BY user_id
) sub
WHERE u.id = sub.user_id;

-- Step 3: Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload schema';

-- Sanity check (will appear in SQL Editor output):
SELECT
  COUNT(*)                         AS rows_updated_in_step1,
  ROUND(SUM(cost_usd)::numeric, 2) AS total_cost_after
FROM usage_stats
WHERE primary_model ILIKE '%opus-4-1%'
   OR primary_model ~ 'opus-4($|[-_][^567])';

-- COMMIT only after reviewing the SELECT output above.
-- If anything looks off, run ROLLBACK instead.
COMMIT;
