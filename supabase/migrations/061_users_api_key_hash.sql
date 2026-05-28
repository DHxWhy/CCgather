-- =====================================================
-- 061_users_api_key_hash.sql
-- API key hash backfill (Phase 1A — preparation only, NO auth flow change)
-- =====================================================
-- Purpose:
--   Add api_key_hash column to users for future migration to hashed-only
--   authentication. Phase 1A only backfills existing keys; the server still
--   authenticates via the plaintext `api_key` column. Auth flow change is
--   deferred to a separate phase after backfill is verified.
--
-- Zero-impact guarantee:
--   * Auth route (`app/api/cli/submit/route.ts:149` — `.eq("api_key", token)`) UNCHANGED.
--   * Existing api_key column UNCHANGED (preserved for fallback).
--   * Users without api_key (32 of 53 rows) are SKIPPED.
--   * SHA-256 via pgcrypto's digest() — Supabase has pgcrypto enabled by default.
--   * UPDATE is row-level (21 affected rows) — short lock, negligible.
--
-- Rollback:
--   ALTER TABLE users DROP COLUMN IF EXISTS api_key_hash;
-- =====================================================

-- Ensure pgcrypto is available (no-op if already enabled — Supabase default)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add nullable hash column
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS api_key_hash TEXT;

-- Backfill: compute SHA-256 hex digest of existing plaintext keys.
-- Idempotent (WHERE api_key_hash IS NULL) — safe to re-run.
UPDATE users
SET api_key_hash = encode(digest(api_key::bytea, 'sha256'), 'hex')
WHERE api_key IS NOT NULL
  AND api_key_hash IS NULL;

NOTIFY pgrst, 'reload schema';

-- Verification query (run in SQL Editor after migration):
-- SELECT
--   COUNT(*) FILTER (WHERE api_key IS NOT NULL AND api_key_hash IS NOT NULL) AS hashed_ok,
--   COUNT(*) FILTER (WHERE api_key IS NOT NULL AND api_key_hash IS NULL) AS missing,
--   COUNT(*) FILTER (WHERE length(api_key_hash) = 64) AS valid_hash_length,
--   COUNT(*) AS total_users
-- FROM users;
-- Expected: hashed_ok = 21, missing = 0, valid_hash_length = 21
