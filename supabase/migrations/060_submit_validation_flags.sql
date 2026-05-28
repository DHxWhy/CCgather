-- =====================================================
-- 060_submit_validation_flags.sql
-- Shadow validation infrastructure (Phase 1A)
-- =====================================================
-- Purpose:
--   Add two columns to usage_stats for upcoming submit-validation shadow mode.
--   Phase 1B code will WRITE to these columns; Phase 2+ will READ them for
--   admin review and (optionally) leaderboard filtering.
--
-- Naming note:
--   `submission_review_status` is intentionally distinct from the legacy
--   `validation_status` column (added in 001_init.sql, defaults to 'approved',
--   not actively used by application code as of 2026-05-29).
--
-- Zero-impact guarantee:
--   * DEFAULT is a literal (not a function) → PG11+ metadata-only (no row rewrite).
--   * No CHECK constraints (deferred — would require table scan).
--   * No indexes (deferred to Phase 1D after data accumulates).
--   * All existing 1,159 rows get DEFAULT values atomically.
--   * Triggers (on_usage_insert) only reference NEW.user_id and NEW.primary_model,
--     so new columns are inert.
--
-- Rollback:
--   ALTER TABLE usage_stats DROP COLUMN IF EXISTS validation_flags;
--   ALTER TABLE usage_stats DROP COLUMN IF EXISTS submission_review_status;
-- =====================================================

ALTER TABLE usage_stats
  ADD COLUMN IF NOT EXISTS validation_flags JSONB DEFAULT '[]'::jsonb;

ALTER TABLE usage_stats
  ADD COLUMN IF NOT EXISTS submission_review_status TEXT DEFAULT 'clean';

COMMENT ON COLUMN usage_stats.validation_flags IS
  'Server-side validation findings, e.g. ["V1_sum_mismatch","V4_future_date"]. Empty array = no findings. Populated by submit-validators.ts in Phase 1B+.';
COMMENT ON COLUMN usage_stats.submission_review_status IS
  'Submission review state: clean | pending | flagged | reviewed. NOT used in leaderboard queries until Phase 3. Distinct from legacy validation_status column.';

NOTIFY pgrst, 'reload schema';
