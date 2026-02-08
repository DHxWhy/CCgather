-- =====================================================
-- 056: Add device_id to submitted_sessions for reinstall detection (Rule 2)
-- When CLI is reinstalled, a new device_id is generated but session hashes
-- remain the same. This column allows detecting reinstalls and cleaning up
-- stale device data to prevent double-counting.
-- =====================================================

ALTER TABLE submitted_sessions
ADD COLUMN IF NOT EXISTS device_id VARCHAR(16) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_submitted_sessions_user_device
ON submitted_sessions (user_id, device_id);
