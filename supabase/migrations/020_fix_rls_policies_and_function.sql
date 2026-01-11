-- Fix remaining RLS and function security issues
-- 1. Add policies for admin_settings and ai_usage_log
-- 2. Fix is_admin_user function search_path

-- ============================================
-- 1. Fix is_admin_user function search_path
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role always has access
  IF current_setting('role', true) = 'service_role' THEN
    RETURN true;
  END IF;

  -- Check if current user is admin
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE clerk_id = auth.uid()::text
    AND is_admin = true
  );
END;
$$;

-- ============================================
-- 2. admin_settings policies
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin full access on admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Service role access on admin_settings" ON public.admin_settings;

-- Admin can do everything
CREATE POLICY "Admin full access on admin_settings"
  ON public.admin_settings
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Service role bypass
CREATE POLICY "Service role access on admin_settings"
  ON public.admin_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 3. ai_usage_log policies
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin full access on ai_usage_log" ON public.ai_usage_log;
DROP POLICY IF EXISTS "Service role access on ai_usage_log" ON public.ai_usage_log;

-- Admin can do everything
CREATE POLICY "Admin full access on ai_usage_log"
  ON public.ai_usage_log
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Service role bypass
CREATE POLICY "Service role access on ai_usage_log"
  ON public.ai_usage_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
