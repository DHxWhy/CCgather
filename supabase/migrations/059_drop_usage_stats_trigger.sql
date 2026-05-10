-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 059: Drop on_usage_insert trigger
--
-- Reason:
--   The on_usage_insert trigger (003_functions.sql) re-aggregates
--   users.total_tokens / total_cost from SUM(usage_stats) on every row
--   insert/update. The CLI submit route (app/api/cli/submit/route.ts STEP 2-3)
--   already performs the same SUM and explicit users UPDATE after a coordinated
--   sequence (insert → legacy cleanup → reinstall cleanup → recompute).
--
--   Keeping the trigger means:
--     1. N redundant SUM queries for an N-row bulk upsert (DB load).
--     2. The trigger fires BEFORE the legacy cleanup step, briefly writing an
--        inflated total to users (legacy + new) before the CLI overwrites it
--        with the correct total. If the CLI update fails, users keeps the
--        inflated value until the next submission.
--
--   Removing the trigger leaves the CLI route as the single writer of
--   users.total_tokens / total_cost / current_level. All other code paths
--   that need to recompute (admin, batch jobs) already call SUM explicitly.
--
-- Safety:
--   - DROP TRIGGER is idempotent with IF EXISTS.
--   - The function update_user_stats() is preserved in case it is called
--     elsewhere as an RPC (it is not, but the cost of keeping the function
--     definition is zero).
--   - No data is modified by this migration. Only the auto-recompute trigger
--     is removed.
--
-- Manual application:
--   Run this in Supabase Dashboard → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_usage_insert ON public.usage_stats;

-- Refresh PostgREST schema cache so any cached plan that referenced the
-- trigger is invalidated.
NOTIFY pgrst, 'reload schema';
