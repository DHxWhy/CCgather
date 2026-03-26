-- =====================================================
-- Add Missing User Columns
-- Migration: 058_add_missing_user_columns
-- Description: Add columns that exist in production but were missing from migrations.
--              Uses IF NOT EXISTS to be safe for both fresh and existing deployments.
-- SAFETY: No existing data is modified. Only adds columns if they don't exist.
-- =====================================================

-- Referral code (unique 5-char code for invite system)
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Who referred this user (FK to users.id)
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Custom DiceBear avatar URL
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_avatar_url TEXT;

-- Hide profile on invite page
ALTER TABLE users ADD COLUMN IF NOT EXISTS hide_profile_on_invite BOOLEAN DEFAULT FALSE;

-- =====================================================
-- Add UNIQUE constraint on referral_code (prevents collision issues)
-- Uses DO block to skip if constraint already exists
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_referral_code_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);
  END IF;
END
$$;

-- Index for referral lookups (used by /api/referral/claim)
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;

-- Index for referred_by lookups (used by referral count queries)
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by) WHERE referred_by IS NOT NULL;
