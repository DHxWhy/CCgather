-- =====================================================
-- Migration: Add notify_sound_enabled column
-- Purpose: Allow users to control push notification sound
-- =====================================================

-- Add sound control column to user_notification_settings
ALTER TABLE public.user_notification_settings
ADD COLUMN IF NOT EXISTS notify_sound_enabled BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.user_notification_settings.notify_sound_enabled
IS 'Push notification sound enabled (true=sound, false=silent)';
