-- =====================================================
-- Enable pg_cron and schedule cleanup jobs
-- Migration: 058_enable_pg_cron_cleanup
-- Description: pg_cron was not enabled, so soft-deleted
--   users/posts/comments were never permanently deleted.
--   This migration enables pg_cron and schedules daily
--   cleanup jobs.
-- =====================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Schedule: permanently delete users soft-deleted 7+ days ago
-- Runs daily at 03:00 UTC (12:00 KST)
SELECT cron.schedule(
  'cleanup-deleted-users',
  '0 3 * * *',
  $$SELECT cleanup_deleted_users()$$
);

-- Schedule: cleanup soft-deleted posts (30d), comments (30d), expired notifications
-- Runs daily at 03:30 UTC (12:30 KST)
SELECT cron.schedule(
  'cleanup-community-content',
  '30 3 * * *',
  $$SELECT run_community_cleanup()$$
);
