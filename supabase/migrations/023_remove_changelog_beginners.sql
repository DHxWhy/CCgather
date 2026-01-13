-- =====================================================
-- Migration: Remove Changelog & Beginners System
-- Description: News Tab 리뉴얼 - 체인지로그/FOR BEGINNERS 시스템 제거
-- Date: 2026-01-12
-- =====================================================

-- =====================================================
-- 1. Drop Views (dependent on tables)
-- =====================================================

DROP VIEW IF EXISTS public.changelog_versions_with_counts;
DROP VIEW IF EXISTS public.beginners_category_counts;

-- =====================================================
-- 2. Drop Triggers
-- =====================================================

DROP TRIGGER IF EXISTS update_changelog_versions_updated_at ON public.changelog_versions;
DROP TRIGGER IF EXISTS update_changelog_items_updated_at ON public.changelog_items;
DROP TRIGGER IF EXISTS update_beginners_dict_updated_at ON public.beginners_dictionary;

-- =====================================================
-- 3. Drop Tables (order matters due to foreign keys)
-- =====================================================

-- Drop content_generation_logs first (references other tables via target_id)
DROP TABLE IF EXISTS public.content_generation_logs;

-- Drop changelog_items (depends on changelog_versions)
DROP TABLE IF EXISTS public.changelog_items;

-- Drop changelog_versions
DROP TABLE IF EXISTS public.changelog_versions;

-- Drop beginners_dictionary
DROP TABLE IF EXISTS public.beginners_dictionary;

-- =====================================================
-- 4. Cleanup: Remove orphaned RLS policies (if any remain)
-- =====================================================

-- Note: Policies are automatically dropped with tables,
-- but we list them for documentation purposes:
-- - changelog_versions_public_read
-- - changelog_versions_admin_write
-- - changelog_items_public_read
-- - changelog_items_admin_write
-- - beginners_dict_public_read
-- - beginners_dict_admin_write
-- - content_gen_logs_admin_only

-- =====================================================
-- 5. Add comment for documentation
-- =====================================================

COMMENT ON SCHEMA public IS 'CCgather public schema - Changelog/Beginners system removed in migration 023 (2026-01-12)';
