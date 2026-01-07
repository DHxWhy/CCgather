-- Contents table for news and YouTube videos
CREATE TABLE IF NOT EXISTS public.contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('news', 'youtube')),

  -- Common fields
  title TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  source_name TEXT,
  thumbnail_url TEXT,
  summary_md TEXT,
  key_points TEXT[],
  category TEXT,
  tags TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'published', 'rejected')),

  -- YouTube specific fields
  video_id TEXT,
  channel_name TEXT,
  channel_id TEXT,
  duration TEXT,
  view_count INTEGER,
  transcript TEXT,
  language TEXT DEFAULT 'en',

  -- Metadata
  relevance_score FLOAT,
  published_at TIMESTAMP WITH TIME ZONE,
  crawled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  summarized_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for contents
CREATE INDEX IF NOT EXISTS idx_contents_type ON public.contents(type);
CREATE INDEX IF NOT EXISTS idx_contents_status ON public.contents(status);
CREATE INDEX IF NOT EXISTS idx_contents_created_at ON public.contents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contents_video_id ON public.contents(video_id) WHERE video_id IS NOT NULL;

-- Admin settings table
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',

  -- News automation
  news_mode TEXT NOT NULL DEFAULT 'confirm' CHECK (news_mode IN ('on', 'confirm', 'off')),
  news_crawl_interval INTEGER NOT NULL DEFAULT 6,
  last_news_crawl_at TIMESTAMP WITH TIME ZONE,
  news_sources TEXT[] DEFAULT ARRAY['https://www.anthropic.com/news', 'https://www.anthropic.com/research'],

  -- YouTube automation
  youtube_mode TEXT NOT NULL DEFAULT 'confirm' CHECK (youtube_mode IN ('on', 'confirm', 'off')),
  youtube_crawl_interval INTEGER NOT NULL DEFAULT 12,
  last_youtube_crawl_at TIMESTAMP WITH TIME ZONE,
  youtube_keywords TEXT[] DEFAULT ARRAY['Claude Code', 'Claude Code tutorial', 'Anthropic Claude', 'Claude 코딩'],

  -- AI usage tracking
  total_ai_requests INTEGER DEFAULT 0,
  total_ai_tokens INTEGER DEFAULT 0,
  total_ai_cost DECIMAL(10, 4) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.admin_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- AI usage log table
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL, -- 'summarize', 'crawl', 'analyze'
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for AI usage
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON public.ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_request_type ON public.ai_usage_log(request_type);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contents_updated_at
  BEFORE UPDATE ON public.contents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_settings_updated_at
  BEFORE UPDATE ON public.admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.contents IS 'News articles and YouTube videos for the platform';
COMMENT ON TABLE public.admin_settings IS 'Admin configuration for automation settings';
COMMENT ON TABLE public.ai_usage_log IS 'Log of AI API usage for monitoring costs';
