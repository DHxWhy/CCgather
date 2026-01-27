-- =====================================================
-- Migration: Remove Content Management System
-- (News + YouTube 콘텐츠 시스템 전체 제거)
-- =====================================================

-- Step 1: Drop article_facts table (depends on contents)
DROP TABLE IF EXISTS public.article_facts CASCADE;

-- Step 2: Drop contents table (모든 news/youtube 콘텐츠)
DROP TABLE IF EXISTS public.contents CASCADE;

-- Step 3: Drop deprecated news_items table
DROP TABLE IF EXISTS public.news_items CASCADE;

-- Step 4: Drop automation tables
DROP TABLE IF EXISTS public.cron_run_history CASCADE;
DROP TABLE IF EXISTS public.cron_jobs CASCADE;
DROP TABLE IF EXISTS public.automation_targets CASCADE;

-- Step 5: Remove content-related columns from admin_settings
ALTER TABLE public.admin_settings
DROP COLUMN IF EXISTS news_mode,
DROP COLUMN IF EXISTS news_crawl_interval,
DROP COLUMN IF EXISTS last_news_crawl_at,
DROP COLUMN IF EXISTS news_sources;

-- Step 6: Drop generate_news_slug function
DROP FUNCTION IF EXISTS public.generate_news_slug(uuid, text);

-- Step 7: Drop any orphaned indexes (if they exist outside tables)
-- Note: Most indexes will be dropped with their tables automatically
