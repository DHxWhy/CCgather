-- =====================================================
-- CCGather Database Schema - CCplan Support
-- Migration: 007_ccplan_support
-- Description: Add subscription plan (CCplan) tracking for league system
-- =====================================================

-- =====================================================
-- 1. Create CCplan enum type
-- =====================================================
DO $$ BEGIN
  CREATE TYPE ccplan_type AS ENUM ('free', 'pro', 'max', 'team');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 2. Add CCplan columns to users table
-- =====================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ccplan ccplan_type DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ccplan_rank INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ccplan_updated_at TIMESTAMPTZ DEFAULT NULL;

-- =====================================================
-- 3. Add CCplan column to usage_stats table
-- =====================================================
ALTER TABLE usage_stats
  ADD COLUMN IF NOT EXISTS ccplan_at_submission ccplan_type DEFAULT NULL;

-- =====================================================
-- 4. Create indexes for CCplan filtering
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_ccplan ON users(ccplan);
CREATE INDEX IF NOT EXISTS idx_users_ccplan_rank ON users(ccplan, ccplan_rank) WHERE ccplan IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_stats_ccplan ON usage_stats(ccplan_at_submission);

-- =====================================================
-- 5. Function to recalculate CCplan ranks
-- =====================================================
CREATE OR REPLACE FUNCTION recalculate_ccplan_ranks()
RETURNS void AS $$
BEGIN
  -- Update ccplan_rank for each tier based on total_tokens
  WITH ranked AS (
    SELECT
      id,
      ccplan,
      ROW_NUMBER() OVER (
        PARTITION BY ccplan
        ORDER BY total_tokens DESC NULLS LAST
      ) as new_rank
    FROM users
    WHERE onboarding_completed = true
      AND ccplan IS NOT NULL
  )
  UPDATE users u
  SET ccplan_rank = r.new_rank
  FROM ranked r
  WHERE u.id = r.id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Function to update single user's CCplan rank
-- =====================================================
CREATE OR REPLACE FUNCTION update_user_ccplan_rank(target_user_id UUID)
RETURNS void AS $$
DECLARE
  user_ccplan ccplan_type;
BEGIN
  -- Get user's ccplan
  SELECT ccplan INTO user_ccplan FROM users WHERE id = target_user_id;

  IF user_ccplan IS NULL THEN
    RETURN;
  END IF;

  -- Recalculate ranks for users in the same ccplan
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        ORDER BY total_tokens DESC NULLS LAST
      ) as new_rank
    FROM users
    WHERE onboarding_completed = true
      AND ccplan = user_ccplan
  )
  UPDATE users u
  SET ccplan_rank = r.new_rank
  FROM ranked r
  WHERE u.id = r.id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Add comments for documentation
-- =====================================================
COMMENT ON COLUMN users.ccplan IS 'Claude subscription plan: free, pro, max, team';
COMMENT ON COLUMN users.ccplan_rank IS 'Rank within the same CCplan tier (1 = top)';
COMMENT ON COLUMN users.ccplan_updated_at IS 'Timestamp when CCplan was last updated';
COMMENT ON COLUMN usage_stats.ccplan_at_submission IS 'CCplan at the time of usage submission';

-- =====================================================
-- 8. Initialize: Run rank calculation for any existing data
-- =====================================================
SELECT recalculate_ccplan_ranks();
