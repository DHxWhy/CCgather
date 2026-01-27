-- Migration: Add total_sessions column to users table
-- Purpose: Track cumulative session count per user for profile display
-- Date: 2025-01-22

-- Add total_sessions column with default 0
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0;

-- Create index for potential sorting/filtering by session count
CREATE INDEX IF NOT EXISTS idx_users_total_sessions ON users(total_sessions DESC);

-- Comment for documentation
COMMENT ON COLUMN users.total_sessions IS 'Cumulative count of unique sessions submitted by user';
