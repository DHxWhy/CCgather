-- =====================================================
-- Developer Network Consent Fields
-- Migration: 015_developer_network_consent
-- =====================================================

-- Add profile visibility consent columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility_consent_at TIMESTAMPTZ;

-- Add community updates consent columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS community_updates_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS community_updates_consent_at TIMESTAMPTZ;

-- Index for querying users who opted in to community updates (for email campaigns)
CREATE INDEX IF NOT EXISTS idx_users_community_updates_consent ON users(community_updates_consent) WHERE community_updates_consent = TRUE;

COMMENT ON COLUMN users.profile_visibility_consent IS 'Whether user consents to public developer profile visibility';
COMMENT ON COLUMN users.profile_visibility_consent_at IS 'Timestamp when user gave profile visibility consent';
COMMENT ON COLUMN users.community_updates_consent IS 'Whether user consents to receiving community updates and developer news';
COMMENT ON COLUMN users.community_updates_consent_at IS 'Timestamp when user gave community updates consent';
