-- Migration: News 탭 단일화 - 태그 기반 필터링
-- Version: 028
-- Date: 2026-01-14
-- Purpose: content_type 기반 → news_tags 기반 필터링으로 전환

-- ============================================
-- 1. Add news_tags column
-- ============================================

-- 태그 배열 컬럼 추가 (다중 태그 지원)
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS news_tags TEXT[];

-- ============================================
-- 2. Create indexes for tag filtering
-- ============================================

-- GIN index for array containment queries
CREATE INDEX IF NOT EXISTS idx_contents_news_tags
ON public.contents USING GIN(news_tags)
WHERE news_tags IS NOT NULL;

-- Composite index for news page queries
CREATE INDEX IF NOT EXISTS idx_contents_news_tags_published
ON public.contents(type, status, published_at DESC)
WHERE type = 'news' AND status = 'published';

-- ============================================
-- 3. Migrate existing data to tags
-- ============================================

-- Convert content_type to news_tags
UPDATE public.contents
SET news_tags = CASE
  -- Official Anthropic/Claude → claude tag
  WHEN content_type = 'official' THEN ARRAY['claude', 'anthropic']
  -- Claude Code specific
  WHEN content_type = 'claude_code' THEN ARRAY['claude', 'claude-code']
  -- Version updates
  WHEN content_type = 'version_update' THEN ARRAY['claude', 'update']
  -- Press/General AI news → industry tag
  WHEN content_type = 'press' THEN ARRAY['industry']
  -- Community content
  WHEN content_type = 'community' THEN ARRAY['community']
  -- YouTube
  WHEN content_type = 'youtube' THEN ARRAY['youtube']
  -- Default
  ELSE ARRAY['industry']
END
WHERE type = 'news' AND news_tags IS NULL;

-- ============================================
-- 4. Add source-based tags (Dev Tools)
-- ============================================

-- Supabase related
UPDATE public.contents
SET news_tags = array_append(news_tags, 'dev-tools')
WHERE type = 'news'
  AND (source_name ILIKE '%supabase%' OR source_url ILIKE '%supabase%' OR title ILIKE '%supabase%')
  AND NOT ('dev-tools' = ANY(news_tags));

-- Vercel related
UPDATE public.contents
SET news_tags = array_append(news_tags, 'dev-tools')
WHERE type = 'news'
  AND (source_name ILIKE '%vercel%' OR source_url ILIKE '%vercel%' OR title ILIKE '%vercel%')
  AND NOT ('dev-tools' = ANY(news_tags));

-- Cursor related
UPDATE public.contents
SET news_tags = array_append(news_tags, 'dev-tools')
WHERE type = 'news'
  AND (source_name ILIKE '%cursor%' OR source_url ILIKE '%cursor%' OR title ILIKE '%cursor%')
  AND NOT ('dev-tools' = ANY(news_tags));

-- ============================================
-- 5. Add competitor tags (Industry)
-- ============================================

-- OpenAI/GPT
UPDATE public.contents
SET news_tags = array_append(news_tags, 'openai')
WHERE type = 'news'
  AND (title ILIKE '%openai%' OR title ILIKE '%gpt%' OR title ILIKE '%chatgpt%')
  AND NOT ('openai' = ANY(news_tags));

-- Google/Gemini
UPDATE public.contents
SET news_tags = array_append(news_tags, 'google')
WHERE type = 'news'
  AND (title ILIKE '%google%' OR title ILIKE '%gemini%' OR title ILIKE '%deepmind%')
  AND NOT ('google' = ANY(news_tags));

-- Meta/Llama
UPDATE public.contents
SET news_tags = array_append(news_tags, 'meta')
WHERE type = 'news'
  AND (title ILIKE '%meta ai%' OR title ILIKE '%llama%')
  AND NOT ('meta' = ANY(news_tags));

-- ============================================
-- 6. Comments
-- ============================================

COMMENT ON COLUMN public.contents.news_tags IS 'News tags for filtering: claude, anthropic, industry, dev-tools, openai, google, meta, community, youtube';
