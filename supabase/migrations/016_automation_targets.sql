-- Automation targets for news collection
-- Part of NEWS_AUTOMATION_PIPELINE implementation

CREATE TABLE IF NOT EXISTS public.automation_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target definition
  type TEXT NOT NULL CHECK (type IN ('url', 'keyword', 'channel')),
  value TEXT NOT NULL,
  label TEXT, -- Display name
  category TEXT CHECK (category IN ('news', 'blog', 'official', 'community', 'youtube')),

  -- Priority and status
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Crawl statistics
  last_crawled_at TIMESTAMPTZ,
  crawl_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN crawl_count > 0 THEN (success_count::DECIMAL / crawl_count * 100) ELSE 0 END
  ) STORED,

  -- Additional config
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(type, value)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automation_targets_active ON public.automation_targets(is_active);
CREATE INDEX IF NOT EXISTS idx_automation_targets_type ON public.automation_targets(type);
CREATE INDEX IF NOT EXISTS idx_automation_targets_category ON public.automation_targets(category);
CREATE INDEX IF NOT EXISTS idx_automation_targets_priority ON public.automation_targets(priority DESC);

-- Update trigger
CREATE TRIGGER update_automation_targets_updated_at
  BEFORE UPDATE ON public.automation_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default targets based on NEWS_AUTOMATION_PIPELINE.md
INSERT INTO public.automation_targets (type, value, label, category, priority) VALUES
  -- Official sources
  ('url', 'https://www.anthropic.com/news', 'Anthropic News', 'official', 100),
  ('url', 'https://www.anthropic.com/research', 'Anthropic Research', 'official', 90),
  ('url', 'https://blog.anthropic.com', 'Anthropic Blog', 'official', 80),

  -- Keywords for search
  ('keyword', 'Claude Code', 'Claude Code', 'news', 70),
  ('keyword', 'Claude Code tutorial', 'Claude Code Tutorial', 'blog', 60),
  ('keyword', 'Anthropic Claude update', 'Anthropic Updates', 'news', 50),
  ('keyword', 'Claude Code CLI', 'Claude CLI', 'news', 40)
ON CONFLICT (type, value) DO NOTHING;

-- Comments
COMMENT ON TABLE public.automation_targets IS 'News collection targets (URLs, keywords, channels)';
COMMENT ON COLUMN public.automation_targets.type IS 'Target type: url (direct crawl), keyword (search), channel (YouTube)';
COMMENT ON COLUMN public.automation_targets.priority IS 'Higher priority targets are crawled first';
COMMENT ON COLUMN public.automation_targets.metadata IS 'Additional configuration like headers, selectors, etc.';
