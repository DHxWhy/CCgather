-- =====================================================
-- Marketing Consent Fields
-- Migration: 011_marketing_consent
-- =====================================================

-- Add marketing consent columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ;

-- Index for querying users who opted in
CREATE INDEX IF NOT EXISTS idx_users_marketing_consent ON users(marketing_consent) WHERE marketing_consent = TRUE;

COMMENT ON COLUMN users.marketing_consent IS 'Whether user has opted in to marketing emails';
COMMENT ON COLUMN users.marketing_consent_at IS 'Timestamp when user gave or withdrew marketing consent';
