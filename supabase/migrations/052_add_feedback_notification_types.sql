-- =====================================================
-- Add Feedback Notification Types
-- Enables notifications when admin resolves/updates bug reports
-- =====================================================

-- Step 1: Drop ALL existing CHECK constraints on notifications.type column
-- (PostgreSQL auto-generates constraint names, so we need to find and drop them dynamically)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'notifications'
      AND att.attname = 'type'
      AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

-- Step 2: Add new CHECK constraint with feedback notification types
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check CHECK (type IN (
  -- Existing community types
  'post_like',
  'post_comment',
  'comment_like',
  'comment_reply',
  'mention',
  'follow',
  'badge_earned',
  'level_up',
  'rank_update',
  'submission_complete',
  -- New feedback types
  'feedback_in_progress',   -- Admin started working on feedback
  'feedback_resolved',      -- Admin resolved the feedback
  'feedback_closed'         -- Admin closed the feedback
));

-- Step 3: Add index for feedback notifications lookup
CREATE INDEX IF NOT EXISTS idx_notifications_feedback_type
ON public.notifications(user_id, type)
WHERE type IN ('feedback_in_progress', 'feedback_resolved', 'feedback_closed');

-- Step 4: Add RLS policy to allow service role to insert notifications
-- (May already exist, so use IF NOT EXISTS pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications'
    AND policyname = 'Service role can insert notifications'
  ) THEN
    CREATE POLICY "Service role can insert notifications" ON notifications
      FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- Step 5: Grant necessary permissions
GRANT INSERT ON public.notifications TO service_role;
