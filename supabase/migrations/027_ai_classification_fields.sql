-- Migration: Add AI classification fields to contents table
-- Version: 027
-- Date: 2026-01-14
-- Purpose: Store AI article classification results (primary/secondary type, confidence, signals)

-- ============================================
-- 1. Add classification fields
-- ============================================

-- Primary article type (AI classified)
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS ai_article_type TEXT
CHECK (ai_article_type IN (
  'product_launch',   -- New product/feature release
  'version_update',   -- Existing product update, patch notes
  'tutorial',         -- How-to guides, step-by-step
  'interview',        -- Q&A, conversations
  'analysis',         -- Comparisons, reviews, deep dives
  'security',         -- Vulnerabilities, security advisories
  'event',            -- Conferences, announcements at events
  'research',         -- Papers, benchmarks, academic findings
  'integration',      -- Partnerships, tool integrations
  'pricing',          -- Pricing changes, policy updates
  'showcase',         -- Community projects, demos
  'opinion',          -- Editorials, subjective takes
  'general'           -- Catch-all for unclassified
));

-- Secondary article type (for hybrid articles)
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS ai_article_type_secondary TEXT
CHECK (ai_article_type_secondary IN (
  'product_launch', 'version_update', 'tutorial', 'interview',
  'analysis', 'security', 'event', 'research', 'integration',
  'pricing', 'showcase', 'opinion', 'general'
));

-- Classification confidence (0.0 - 1.0)
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS ai_classification_confidence DECIMAL(3,2)
CHECK (ai_classification_confidence >= 0 AND ai_classification_confidence <= 1);

-- Classification signals (keywords/phrases that led to this classification)
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS ai_classification_signals TEXT[];

-- AI processing metadata
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ;

ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS ai_model_version TEXT;

-- ============================================
-- 2. Create indexes for filtering
-- ============================================

-- Index for article type filtering
CREATE INDEX IF NOT EXISTS idx_contents_ai_article_type
ON public.contents(ai_article_type)
WHERE ai_article_type IS NOT NULL;

-- Index for low confidence articles (admin review)
CREATE INDEX IF NOT EXISTS idx_contents_low_confidence
ON public.contents(ai_classification_confidence)
WHERE ai_classification_confidence < 0.8;

-- Composite index for admin filtering
CREATE INDEX IF NOT EXISTS idx_contents_ai_type_status
ON public.contents(ai_article_type, status)
WHERE ai_article_type IS NOT NULL;

-- ============================================
-- 3. Comments
-- ============================================

COMMENT ON COLUMN public.contents.ai_article_type IS 'Primary article type classified by AI (product_launch, tutorial, security, etc.)';
COMMENT ON COLUMN public.contents.ai_article_type_secondary IS 'Secondary article type for hybrid articles';
COMMENT ON COLUMN public.contents.ai_classification_confidence IS 'AI classification confidence score (0.0 - 1.0)';
COMMENT ON COLUMN public.contents.ai_classification_signals IS 'Keywords/phrases that led to classification';
COMMENT ON COLUMN public.contents.ai_processed_at IS 'Timestamp when AI processing was completed';
COMMENT ON COLUMN public.contents.ai_model_version IS 'AI model version used for processing';
