-- =====================================================
-- 031: Session Fingerprints for Duplicate Prevention
-- 1 Project 1 Person Principle
-- =====================================================

-- Table to track submitted session fingerprints
CREATE TABLE IF NOT EXISTS submitted_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_hash VARCHAR(64) NOT NULL,  -- SHA256 hash
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_hash VARCHAR(64),  -- Optional: hash of project identifier
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each session hash can only belong to one user
  UNIQUE(session_hash)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_submitted_sessions_user_id ON submitted_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_submitted_sessions_hash ON submitted_sessions(session_hash);

-- Enable RLS
ALTER TABLE submitted_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own submitted sessions
CREATE POLICY "Users can view own submitted sessions"
  ON submitted_sessions FOR SELECT
  USING (auth.uid()::text IN (
    SELECT clerk_id FROM users WHERE id = submitted_sessions.user_id
  ));

-- Only service role can insert/update (via API)
CREATE POLICY "Service role can manage submitted sessions"
  ON submitted_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comment
COMMENT ON TABLE submitted_sessions IS 'Tracks session fingerprints to prevent duplicate submissions across accounts';
COMMENT ON COLUMN submitted_sessions.session_hash IS 'SHA256 hash of session file content';
COMMENT ON COLUMN submitted_sessions.project_hash IS 'Optional project identifier hash';
