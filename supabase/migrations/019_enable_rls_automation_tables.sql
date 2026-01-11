-- Enable RLS on automation tables
-- Fixes Security Advisor warnings for: cron_jobs, cron_run_history, automation_targets

-- ============================================
-- 1. Enable RLS on all automation tables
-- ============================================

ALTER TABLE public.automation_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_run_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Create helper function for admin check
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. automation_targets policies
-- ============================================

-- Admin can do everything
CREATE POLICY "Admin full access on automation_targets"
  ON public.automation_targets
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Service role bypass (for cron jobs)
CREATE POLICY "Service role access on automation_targets"
  ON public.automation_targets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 4. cron_jobs policies
-- ============================================

-- Admin can do everything
CREATE POLICY "Admin full access on cron_jobs"
  ON public.cron_jobs
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Service role bypass
CREATE POLICY "Service role access on cron_jobs"
  ON public.cron_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 5. cron_run_history policies
-- ============================================

-- Admin can do everything
CREATE POLICY "Admin full access on cron_run_history"
  ON public.cron_run_history
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Service role bypass
CREATE POLICY "Service role access on cron_run_history"
  ON public.cron_run_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Comments
-- ============================================

COMMENT ON FUNCTION public.is_admin_user IS 'Check if current user is admin or service role';
