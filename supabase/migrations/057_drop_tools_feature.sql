-- =====================================================
-- Drop Tools Feature
-- Migration: 057_drop_tools_feature
-- Description: Remove tools, tool_votes, tool_bookmarks tables
--              and update get_pending_deletion_info function
-- =====================================================

-- =====================================================
-- 1. Drop tools-related tables (CASCADE handles FKs)
-- =====================================================
DROP TABLE IF EXISTS tool_bookmarks CASCADE;
DROP TABLE IF EXISTS tool_votes CASCADE;
DROP TABLE IF EXISTS tools CASCADE;

-- =====================================================
-- 2. Update get_pending_deletion_info to remove tools references
-- =====================================================
CREATE OR REPLACE FUNCTION get_pending_deletion_info(target_clerk_id TEXT)
RETURNS JSON AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT * INTO user_record
  FROM users
  WHERE clerk_id = target_clerk_id
    AND deleted_at IS NOT NULL
    AND deleted_at > NOW() - INTERVAL '7 days';

  IF NOT FOUND THEN
    RETURN json_build_object('pending_deletion', false);
  END IF;

  RETURN json_build_object(
    'pending_deletion', true,
    'deleted_at', user_record.deleted_at,
    'expires_at', user_record.deleted_at + INTERVAL '7 days',
    'remaining_hours', EXTRACT(EPOCH FROM (user_record.deleted_at + INTERVAL '7 days' - NOW())) / 3600,
    'stats', json_build_object(
      'votes_count', 0,
      'level', user_record.current_level,
      'username', user_record.username
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
