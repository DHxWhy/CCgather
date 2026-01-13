-- =============================================
-- Migration: 025_fix_contents_admin_rls
-- Description: Add missing admin write policy for contents table
-- Date: 2026-01-13
-- =============================================

-- Add admin ALL policy for contents table
-- This allows admin users to INSERT, UPDATE, DELETE contents
CREATE POLICY "contents_admin_all" ON public.contents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Add comment for documentation
COMMENT ON POLICY "contents_admin_all" ON public.contents IS
  'Allow admin users to perform all operations (INSERT, UPDATE, DELETE) on contents';
