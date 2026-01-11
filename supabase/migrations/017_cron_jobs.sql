-- Cron job configuration and status tracking
-- Part of NEWS_AUTOMATION_PIPELINE implementation

CREATE TABLE IF NOT EXISTS public.cron_jobs (
  id TEXT PRIMARY KEY,

  -- Schedule configuration
  name TEXT NOT NULL,
  description TEXT,
  schedule TEXT NOT NULL DEFAULT '0 0 * * *', -- Cron expression (UTC)
  timezone TEXT DEFAULT 'Asia/Seoul',

  -- Status
  is_enabled BOOLEAN DEFAULT false,
  is_running BOOLEAN DEFAULT false,

  -- Last run info
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'failed', 'running', 'cancelled')),
  last_run_duration_ms INTEGER,
  last_run_result JSONB, -- Detailed result
  last_error TEXT,

  -- Statistics
  run_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  total_items_collected INTEGER DEFAULT 0,

  -- Configuration
  config JSONB DEFAULT '{
    "max_articles": 10,
    "delay_ms": 2000,
    "parallel_workers": 2,
    "timeout_ms": 300000,
    "retry_count": 3
  }',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update trigger
CREATE TRIGGER update_cron_jobs_updated_at
  BEFORE UPDATE ON public.cron_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default cron job
INSERT INTO public.cron_jobs (id, name, description, schedule, is_enabled, config) VALUES
  ('news-collector',
   'News Collector',
   'Collects Claude Code related news from configured sources',
   '0 0 * * *', -- Daily at 00:00 UTC (09:00 KST)
   false,
   '{
     "max_articles": 10,
     "delay_ms": 2000,
     "parallel_workers": 2,
     "timeout_ms": 300000,
     "retry_count": 3,
     "categories": ["news", "official", "blog"]
   }'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Cron run history table
CREATE TABLE IF NOT EXISTS public.cron_run_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL REFERENCES public.cron_jobs(id) ON DELETE CASCADE,

  -- Run details
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'cancelled')),
  duration_ms INTEGER,

  -- Results
  items_found INTEGER DEFAULT 0,
  items_valid INTEGER DEFAULT 0,
  items_saved INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,

  -- Error info
  error_message TEXT,
  error_stack TEXT,

  -- Detailed log
  log JSONB DEFAULT '[]'
);

-- Index for history queries
CREATE INDEX IF NOT EXISTS idx_cron_run_history_job_id ON public.cron_run_history(job_id);
CREATE INDEX IF NOT EXISTS idx_cron_run_history_started_at ON public.cron_run_history(started_at DESC);

-- Comments
COMMENT ON TABLE public.cron_jobs IS 'Scheduled automation jobs configuration';
COMMENT ON TABLE public.cron_run_history IS 'History of cron job executions';
COMMENT ON COLUMN public.cron_jobs.schedule IS 'Cron expression in UTC timezone';
