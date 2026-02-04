-- =====================================================
-- CLI Submit Attempts Table (실패 로그 저장)
-- =====================================================

CREATE TABLE IF NOT EXISTS cli_submit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL, -- 'no_sessions' | 'no_data' | 'scan_failed' | 'auth_failed' | 'network_error' | 'unknown'
  cli_version TEXT,
  platform TEXT,
  debug_info JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_cli_submit_attempts_user_id ON cli_submit_attempts(user_id);
CREATE INDEX idx_cli_submit_attempts_created_at ON cli_submit_attempts(created_at DESC);
CREATE INDEX idx_cli_submit_attempts_reason ON cli_submit_attempts(reason);

-- RLS 활성화
ALTER TABLE cli_submit_attempts ENABLE ROW LEVEL SECURITY;

-- Admin만 조회 가능
CREATE POLICY "Admins can view cli_submit_attempts"
  ON cli_submit_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.clerk_id = auth.jwt()->>'sub'
      AND users.is_admin = true
    )
  );

-- 서비스 역할은 모든 작업 가능 (API 서버용)
CREATE POLICY "Service role can manage cli_submit_attempts"
  ON cli_submit_attempts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE cli_submit_attempts IS 'CLI 실행 시도 중 실패한 케이스 로그';
COMMENT ON COLUMN cli_submit_attempts.reason IS '실패 사유: no_sessions, no_data, scan_failed, auth_failed, network_error, unknown';
