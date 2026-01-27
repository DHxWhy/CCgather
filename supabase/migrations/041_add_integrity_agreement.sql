-- ============================================
-- Migration: Add Data Integrity Agreement Fields
-- Description: Track user agreement to data integrity policy
-- ============================================

-- Add integrity agreement fields to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS integrity_agreed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS integrity_agreed_at timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN public.users.integrity_agreed IS 'User agreed to not modify session files';
COMMENT ON COLUMN public.users.integrity_agreed_at IS 'Timestamp when user agreed to integrity policy';

-- Create index for querying users who have agreed
CREATE INDEX IF NOT EXISTS idx_users_integrity_agreed ON public.users(integrity_agreed) WHERE integrity_agreed = true;
