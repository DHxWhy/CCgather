-- ════════════════════════════════════════════════════════════════════════════════
-- V2.0: Level-Based League System Migration
-- ════════════════════════════════════════════════════════════════════════════════
--
-- Changes:
-- 1. Add level_league enum type and column to users table
-- 2. Add has_opus_usage and opus_models columns for badge display
-- 3. Calculate and populate level_league for existing users
-- 4. Add index for level_league filtering
--
-- Note: ccplan remains for badge display, but is no longer used for ranking
-- ════════════════════════════════════════════════════════════════════════════════

-- Step 1: Create level_league enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'level_league_type') THEN
    CREATE TYPE level_league_type AS ENUM ('rookie', 'builder', 'master', 'legend');
  END IF;
END $$;

-- Step 2: Add level_league column to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS level_league level_league_type DEFAULT 'rookie';

-- Step 3: Add Opus tracking columns for badge display
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS has_opus_usage boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS opus_models text[] DEFAULT '{}';

-- Step 4: Add level_league_rank for league-specific ranking
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS level_league_rank integer;

-- Step 5: Calculate and populate level_league for existing users
-- Level thresholds:
--   Level 1-3 (0-200M tokens): rookie
--   Level 4-6 (200M-3B tokens): builder
--   Level 7-9 (3B-100B tokens): master
--   Level 10 (100B+ tokens): legend
UPDATE users
SET level_league = CASE
  WHEN total_tokens < 200000000 THEN 'rookie'::level_league_type
  WHEN total_tokens < 3000000000 THEN 'builder'::level_league_type
  WHEN total_tokens < 100000000000 THEN 'master'::level_league_type
  ELSE 'legend'::level_league_type
END
WHERE total_tokens IS NOT NULL AND total_tokens > 0;

-- Step 6: Populate has_opus_usage from existing usage_stats (check for opus in primary_model)
UPDATE users u
SET has_opus_usage = true
WHERE EXISTS (
  SELECT 1 FROM usage_stats us
  WHERE us.user_id = u.id
    AND us.primary_model IS NOT NULL
    AND lower(us.primary_model) LIKE '%opus%'
);

-- Step 7: Create index for level_league filtering
CREATE INDEX IF NOT EXISTS idx_users_level_league ON users(level_league);
CREATE INDEX IF NOT EXISTS idx_users_level_league_tokens ON users(level_league, total_tokens DESC);

-- Step 8: Update level_league_rank for each league
-- This will be recalculated on each submission, but initialize it now
WITH ranked_users AS (
  SELECT
    id,
    level_league,
    ROW_NUMBER() OVER (PARTITION BY level_league ORDER BY total_tokens DESC) as league_rank
  FROM users
  WHERE total_tokens > 0
)
UPDATE users u
SET level_league_rank = r.league_rank
FROM ranked_users r
WHERE u.id = r.id;

-- Step 9: Add comment explaining the migration
COMMENT ON COLUMN users.level_league IS 'V2.0: Level-based league (rookie/builder/master/legend) determined by token usage, replaces ccplan-based ranking';
COMMENT ON COLUMN users.has_opus_usage IS 'Badge display: True if user has ever used Opus models';
COMMENT ON COLUMN users.opus_models IS 'Badge display: List of Opus model variants used';
COMMENT ON COLUMN users.level_league_rank IS 'Rank within the level_league';
