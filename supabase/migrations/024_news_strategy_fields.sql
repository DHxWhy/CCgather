-- News Tab Strategy Implementation - Database Schema Extension
-- Version: 024
-- Date: 2026-01-13
-- Purpose: Add fields required by NEWS_TAB_STRATEGY.md

-- ============================================
-- 1. Extend contents table
-- ============================================

-- SEO-friendly URL slug
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- One-liner summary (emoji + text for sharing)
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS one_liner TEXT;

-- Full article body HTML (rewritten by AI)
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS body_html TEXT;

-- CCgather insight section
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS insight_html TEXT;

-- Key takeaways as structured JSON
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS key_takeaways JSONB;

-- Related articles (array of content IDs)
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS related_articles UUID[];

-- View count for analytics
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- ============================================
-- 2. Create article_facts table (Fact Verification)
-- ============================================

CREATE TABLE IF NOT EXISTS public.article_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,

  -- Fact classification
  fact_type VARCHAR(50) NOT NULL CHECK (fact_type IN (
    'version', 'metric', 'date', 'feature', 'entity', 'action', 'quote'
  )),

  -- Original text from source
  original_text TEXT NOT NULL,

  -- Normalized fact value
  fact_value TEXT NOT NULL,

  -- Verification status
  is_required BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,

  -- Where this fact appears in rewritten article
  verified_in_text TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

-- ============================================
-- 3. Create indexes
-- ============================================

-- Unique slug index for SEO URLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_contents_slug
ON public.contents(slug)
WHERE slug IS NOT NULL;

-- Index for fact lookup by content
CREATE INDEX IF NOT EXISTS idx_article_facts_content_id
ON public.article_facts(content_id);

-- Index for unverified facts (admin review)
CREATE INDEX IF NOT EXISTS idx_article_facts_unverified
ON public.article_facts(content_id)
WHERE is_verified = false;

-- Index for fact types
CREATE INDEX IF NOT EXISTS idx_article_facts_type
ON public.article_facts(fact_type);

-- ============================================
-- 4. Create slug generation function
-- ============================================

CREATE OR REPLACE FUNCTION generate_news_slug(title TEXT, content_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Create base slug from title
  base_slug := lower(
    regexp_replace(
      regexp_replace(
        -- Remove special characters except alphanumeric, spaces, and Korean
        title,
        '[^a-zA-Z0-9가-힣\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );

  -- Truncate to reasonable length
  base_slug := left(base_slug, 100);

  -- Add short hash for uniqueness
  final_slug := base_slug || '-' || left(content_id::text, 8);

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Create trigger for auto slug generation
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if slug is not provided and title exists
  IF NEW.slug IS NULL AND NEW.title IS NOT NULL THEN
    NEW.slug := generate_news_slug(NEW.title, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_generate_slug ON public.contents;

-- Create trigger
CREATE TRIGGER trigger_auto_generate_slug
  BEFORE INSERT ON public.contents
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_slug();

-- ============================================
-- 6. Update existing contents with slugs
-- ============================================

UPDATE public.contents
SET slug = generate_news_slug(title, id)
WHERE slug IS NULL AND title IS NOT NULL;

-- ============================================
-- 7. RLS Policies for article_facts
-- ============================================

-- Enable RLS
ALTER TABLE public.article_facts ENABLE ROW LEVEL SECURITY;

-- Public read access (for verified facts)
CREATE POLICY "article_facts_public_read" ON public.article_facts
  FOR SELECT
  TO public
  USING (is_verified = true);

-- Admin full access
CREATE POLICY "article_facts_admin_all" ON public.article_facts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- ============================================
-- 8. Comments
-- ============================================

COMMENT ON COLUMN public.contents.slug IS 'SEO-friendly URL slug, auto-generated from title';
COMMENT ON COLUMN public.contents.one_liner IS 'One-liner summary with emoji for quick sharing';
COMMENT ON COLUMN public.contents.body_html IS 'Full article body HTML, rewritten by AI';
COMMENT ON COLUMN public.contents.insight_html IS 'CCgather insight section HTML';
COMMENT ON COLUMN public.contents.key_takeaways IS 'Key takeaways as JSON array [{icon, text}]';
COMMENT ON COLUMN public.contents.related_articles IS 'Array of related content UUIDs';
COMMENT ON COLUMN public.contents.view_count IS 'Article view count for analytics';

COMMENT ON TABLE public.article_facts IS 'Extracted facts from source articles for verification';
COMMENT ON COLUMN public.article_facts.fact_type IS 'Type: version, metric, date, feature, entity, action, quote';
COMMENT ON COLUMN public.article_facts.original_text IS 'Original text from source article';
COMMENT ON COLUMN public.article_facts.fact_value IS 'Normalized fact value';
COMMENT ON COLUMN public.article_facts.is_required IS 'Whether this fact must be included in rewrite';
COMMENT ON COLUMN public.article_facts.is_verified IS 'Whether fact was verified in rewritten article';
COMMENT ON COLUMN public.article_facts.verified_in_text IS 'Text from rewrite where fact appears';
