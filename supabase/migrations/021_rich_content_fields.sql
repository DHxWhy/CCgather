-- Rich Content Fields for AI-Generated News Summaries
-- Part of Smart Hybrid Content Pipeline implementation

-- ============================================
-- 1. Add Rich Content Fields to contents table
-- ============================================

-- Rich content JSON (structured HTML content)
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS rich_content JSONB;

-- Source favicon URL
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS favicon_url TEXT;

-- Fact check results
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS fact_check_score DECIMAL(3,2)
CHECK (fact_check_score >= 0 AND fact_check_score <= 1);

ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS fact_check_reason TEXT;

-- Content difficulty level
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS difficulty TEXT
CHECK (difficulty IN ('easy', 'medium', 'hard'));

-- Analogy (stored separately for easy access)
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS analogy TEXT;

-- AI processing metadata
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS ai_model_used TEXT;

ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS ai_tokens_used INTEGER DEFAULT 0;

ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS ai_cost_usd DECIMAL(10,6) DEFAULT 0;

ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ;

-- Original content (raw text before summarization)
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS original_content TEXT;

-- ============================================
-- 2. Add indexes for new fields
-- ============================================

CREATE INDEX IF NOT EXISTS idx_contents_difficulty
ON public.contents(difficulty);

CREATE INDEX IF NOT EXISTS idx_contents_fact_check_score
ON public.contents(fact_check_score DESC);

CREATE INDEX IF NOT EXISTS idx_contents_ai_processed
ON public.contents(ai_processed_at);

-- ============================================
-- 3. Comments
-- ============================================

COMMENT ON COLUMN public.contents.rich_content IS 'Structured JSON content with title, summary, keyPoints, meta, style';
COMMENT ON COLUMN public.contents.favicon_url IS 'Source website favicon URL';
COMMENT ON COLUMN public.contents.fact_check_score IS 'AI fact check confidence score (0.00-1.00)';
COMMENT ON COLUMN public.contents.fact_check_reason IS 'Reason for fact check score';
COMMENT ON COLUMN public.contents.difficulty IS 'Content difficulty: easy, medium, hard';
COMMENT ON COLUMN public.contents.analogy IS 'Simple analogy to explain the content';
COMMENT ON COLUMN public.contents.ai_model_used IS 'AI model used for processing (e.g., claude-opus-4-5-20250514)';
COMMENT ON COLUMN public.contents.ai_tokens_used IS 'Total tokens used for AI processing';
COMMENT ON COLUMN public.contents.ai_cost_usd IS 'Estimated AI processing cost in USD';
COMMENT ON COLUMN public.contents.ai_processed_at IS 'Timestamp when AI processing completed';
COMMENT ON COLUMN public.contents.original_content IS 'Original raw content before AI summarization';
