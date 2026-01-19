-- =====================================================
-- League Reason Tracking
-- Migration: 036_league_reason_tracking
-- Purpose: Track league placement reasons for audit
-- =====================================================

-- Add league_reason columns to usage_stats
ALTER TABLE usage_stats
ADD COLUMN IF NOT EXISTS league_reason TEXT,
ADD COLUMN IF NOT EXISTS league_reason_details TEXT;

-- Add comment for documentation
COMMENT ON COLUMN usage_stats.league_reason IS 'League placement reason: opus, credential, user_choice';
COMMENT ON COLUMN usage_stats.league_reason_details IS 'Detailed audit info: e.g., "Opus verified: opus-4-5"';

-- Create index for filtering by league reason
CREATE INDEX IF NOT EXISTS idx_usage_stats_league_reason ON usage_stats(league_reason);
