-- ════════════════════════════════════════════════════════════════════════════════
-- Remove Level League System
-- ════════════════════════════════════════════════════════════════════════════════
--
-- Decision: League system removed to simplify ranking
--
-- What remains:
-- - Level (1-10): User progression indicator
-- - Token badges: Milestone achievements (First Million, 100M Club, etc.)
-- - Global/Country ranking: Simple, clear ranking
--
-- What's removed:
-- - League filter (Eco/Builder/Master/Legend)
-- - League-specific ranking
-- - Complexity from multiple overlapping systems
--
-- Rationale:
-- Level, League, and Token Badges were all measuring the same thing (token usage)
-- in 3 different ways, causing confusion. Simplified to:
-- - Level = current growth stage (dynamic)
-- - Badges = achievement records (permanent)
-- ════════════════════════════════════════════════════════════════════════════════

-- Drop level_league related columns
ALTER TABLE users DROP COLUMN IF EXISTS level_league;
ALTER TABLE users DROP COLUMN IF EXISTS level_league_rank;

-- Drop indexes
DROP INDEX IF EXISTS idx_users_level_league;
DROP INDEX IF EXISTS idx_users_level_league_tokens;

-- Drop enum type (must be done after column removal)
DROP TYPE IF EXISTS level_league_type;
