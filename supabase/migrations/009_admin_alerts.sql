-- Admin alerts table for monitoring unknown ccplan values and other alerts
CREATE TABLE IF NOT EXISTS admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for unread alerts
CREATE INDEX idx_admin_alerts_unread ON admin_alerts(is_read, created_at DESC) WHERE is_read = FALSE;

-- Index for alert type
CREATE INDEX idx_admin_alerts_type ON admin_alerts(type);

-- Comment
COMMENT ON TABLE admin_alerts IS 'Admin alerts for monitoring unknown ccplan values and system events';
