-- =====================================================
-- Update Soft Delete Grace Period: 3 days → 7 days
-- Migration: 042_update_soft_delete_to_7_days
-- Description: Extend grace period to 7 days for better user experience
-- =====================================================

-- =====================================================
-- Function to soft delete a user (updated to 7 days)
-- =====================================================
CREATE OR REPLACE FUNCTION soft_delete_user(target_clerk_id TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  deletion_date TIMESTAMPTZ;
BEGIN
  deletion_date := NOW();

  UPDATE users
  SET deleted_at = deletion_date, updated_at = NOW()
  WHERE clerk_id = target_clerk_id AND deleted_at IS NULL;

  IF FOUND THEN
    result := json_build_object(
      'success', true,
      'deleted_at', deletion_date,
      'expires_at', deletion_date + INTERVAL '7 days'
    );
  ELSE
    result := json_build_object(
      'success', false,
      'error', 'User not found or already deleted'
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function to recover a soft-deleted user (updated to 7 days)
-- =====================================================
CREATE OR REPLACE FUNCTION recover_user(target_clerk_id TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  user_record RECORD;
BEGIN
  SELECT * INTO user_record
  FROM users
  WHERE clerk_id = target_clerk_id
    AND deleted_at IS NOT NULL
    AND deleted_at > NOW() - INTERVAL '7 days';

  IF FOUND THEN
    UPDATE users
    SET deleted_at = NULL, updated_at = NOW()
    WHERE clerk_id = target_clerk_id;

    result := json_build_object(
      'success', true,
      'message', 'Account recovered successfully'
    );
  ELSE
    result := json_build_object(
      'success', false,
      'error', 'No recoverable account found'
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function to permanently delete expired users (updated to 7 days)
-- Called by cron job
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_deleted_users()
RETURNS JSON AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM users
  WHERE deleted_at IS NOT NULL
    AND deleted_at <= NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'deleted_count', deleted_count,
    'executed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function to get pending deletion info (updated to 7 days)
-- =====================================================
CREATE OR REPLACE FUNCTION get_pending_deletion_info(target_clerk_id TEXT)
RETURNS JSON AS $$
DECLARE
  user_record RECORD;
  tools_count INTEGER;
  votes_count INTEGER;
BEGIN
  SELECT * INTO user_record
  FROM users
  WHERE clerk_id = target_clerk_id
    AND deleted_at IS NOT NULL
    AND deleted_at > NOW() - INTERVAL '7 days';

  IF NOT FOUND THEN
    RETURN json_build_object('pending_deletion', false);
  END IF;

  -- Get stats
  SELECT COUNT(*) INTO tools_count
  FROM tools WHERE submitted_by = user_record.id;

  SELECT COUNT(*) INTO votes_count
  FROM tool_votes WHERE user_id = user_record.id;

  RETURN json_build_object(
    'pending_deletion', true,
    'deleted_at', user_record.deleted_at,
    'expires_at', user_record.deleted_at + INTERVAL '7 days',
    'remaining_hours', EXTRACT(EPOCH FROM (user_record.deleted_at + INTERVAL '7 days' - NOW())) / 3600,
    'stats', json_build_object(
      'tools_submitted', tools_count,
      'votes_count', votes_count,
      'level', user_record.current_level,
      'username', user_record.username
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
