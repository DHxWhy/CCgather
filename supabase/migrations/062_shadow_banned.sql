-- =====================================================
-- 062_shadow_banned.sql
-- Shadow ban — hide abusive accounts from PUBLIC views without blocking them
-- =====================================================
-- Context: an account (vrentati) submitted fabricated usage (181B tokens, daily
-- 90B / $1M — ~13x the legitimate #1) and surfaced as leaderboard rank 1. Our
-- validation flagged it (review_status='pending') but the leaderboard sorts by
-- total_tokens without filtering review state, so it was publicly visible.
--
-- shadow_banned = true:
--   - excluded from leaderboard, community stats, and rank computation (app code
--     adds `.eq("shadow_banned", false)` to those users-table queries)
--   - the user's OWN data (usage_stats, profile, totals) is PRESERVED — they see
--     themselves normally; only OTHERS don't see them ("shadow")
--   - reversible: flip back to false to restore public visibility
--
-- Applied live via Supabase MCP (2026-05-30). This file is the record.
-- =====================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS shadow_banned BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_shadow_banned
  ON users (shadow_banned) WHERE shadow_banned = true;

NOTIFY pgrst, 'reload schema';
