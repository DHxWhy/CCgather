-- =====================================================
-- CCGather Database Schema - Security Hardening
-- Migration: 006_security_rls
-- Description: Add RLS to admin/content tables for security
-- =====================================================

-- =====================================================
-- Enable RLS on previously unprotected tables
-- =====================================================
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Contents Table Policies
-- Public can read published content only
-- All writes require service_role (backend only)
-- =====================================================

-- Public read for published content
CREATE POLICY "Public can read published content"
  ON contents FOR SELECT
  USING (status = 'published');

-- Service role has full access (implicit - RLS bypassed)
-- No INSERT/UPDATE/DELETE policies = only service_role can modify

-- =====================================================
-- Admin Settings Table Policies
-- No public access - service_role only
-- =====================================================

-- No policies = complete lockdown for anon/authenticated
-- Only service_role can access (RLS bypassed)

-- =====================================================
-- AI Usage Log Table Policies
-- No public access - service_role only
-- =====================================================

-- No policies = complete lockdown for anon/authenticated
-- Only service_role can access (RLS bypassed)

-- =====================================================
-- Additional Security: Revoke direct table access
-- This ensures even if RLS is bypassed, anon can't access
-- =====================================================

-- Revoke all on admin tables from anon and authenticated
REVOKE ALL ON admin_settings FROM anon, authenticated;
REVOKE ALL ON ai_usage_log FROM anon, authenticated;

-- Grant limited access to contents (SELECT only for published)
REVOKE ALL ON contents FROM anon, authenticated;
GRANT SELECT ON contents TO anon, authenticated;

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON POLICY "Public can read published content" ON contents IS
  'Allow public to read only published news/youtube content';
