-- =====================================================
-- CCGather Database Schema - Level System Sync
-- Migration: 046_sync_level_thresholds_with_cli
-- Description: Sync level thresholds with CLI v2.0.31
-- =====================================================

-- =====================================================
-- Update calculate_level function to match CLI v2.0.31
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_level(tokens BIGINT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE
    WHEN tokens >= 100000000000 THEN 10  -- 100B+ Transcendent
    WHEN tokens >= 50000000000 THEN 9    -- 50B+ Immortal
    WHEN tokens >= 30000000000 THEN 8    -- 30B+ Mythic
    WHEN tokens >= 10000000000 THEN 7    -- 10B+ Legend
    WHEN tokens >= 3000000000 THEN 6     -- 3B+ Grandmaster
    WHEN tokens >= 1000000000 THEN 5     -- 1B+ Master
    WHEN tokens >= 500000000 THEN 4      -- 500M+ Expert
    WHEN tokens >= 200000000 THEN 3      -- 200M+ Journeyman
    WHEN tokens >= 50000000 THEN 2       -- 50M+ Apprentice
    ELSE 1                               -- 0-50M Novice
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = '';

-- =====================================================
-- Recalculate all user levels with new thresholds
-- =====================================================
UPDATE public.users
SET current_level = public.calculate_level(total_tokens)
WHERE total_tokens IS NOT NULL AND total_tokens > 0;

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Level thresholds synced with CLI v2.0.31. All user levels recalculated.';
END $$;
