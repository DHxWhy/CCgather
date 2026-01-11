-- Migration: Add content_type column to contents table
-- Enables categorization: version_update, official, press, community, youtube

-- Add content_type column with CHECK constraint
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS content_type TEXT
CHECK (content_type IN ('version_update', 'official', 'press', 'community', 'youtube'));

-- Add thumbnail_generated_at for tracking AI-generated thumbnails
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS thumbnail_generated_at TIMESTAMP WITH TIME ZONE;

-- Add thumbnail_source for tracking thumbnail origin
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS thumbnail_source TEXT
CHECK (thumbnail_source IN ('gemini', 'og_image', 'manual', 'default'));

-- Migrate existing data based on source_name
UPDATE public.contents
SET content_type = CASE
  WHEN source_name IN ('Anthropic', 'anthropic.com', 'blog.anthropic.com', 'claude.ai') THEN 'official'
  WHEN type = 'youtube' THEN 'youtube'
  ELSE 'press'
END
WHERE content_type IS NULL;

-- Set default thumbnail_source for existing thumbnails
UPDATE public.contents
SET thumbnail_source = CASE
  WHEN type = 'youtube' THEN 'og_image'
  WHEN thumbnail_url IS NOT NULL THEN 'og_image'
  ELSE NULL
END
WHERE thumbnail_source IS NULL AND thumbnail_url IS NOT NULL;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_contents_content_type
ON public.contents(content_type);

-- Create composite index for news page queries
CREATE INDEX IF NOT EXISTS idx_contents_type_content_type_status
ON public.contents(type, content_type, status);

-- Comments
COMMENT ON COLUMN public.contents.content_type IS 'Content categorization: version_update, official, press, community, youtube';
COMMENT ON COLUMN public.contents.thumbnail_generated_at IS 'Timestamp when AI generated the thumbnail';
COMMENT ON COLUMN public.contents.thumbnail_source IS 'Source of thumbnail: gemini, og_image, manual, default';
