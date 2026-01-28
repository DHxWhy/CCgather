-- =====================================================
-- Content Deletion Logs Migration
-- Track all content deletions for admin review
-- =====================================================

-- Deletion logs table
CREATE TABLE IF NOT EXISTS public.content_deletion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Deleted content info
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('post', 'comment')),
  content_id UUID NOT NULL,

  -- Snapshot of content at deletion time (for admin review)
  content_snapshot JSONB NOT NULL,

  -- Who deleted it
  deleted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  deleted_by_role VARCHAR(20) DEFAULT 'owner' CHECK (deleted_by_role IN ('owner', 'admin')),

  -- Cascade info (how many child items were affected)
  cascade_deleted_comments INTEGER DEFAULT 0,
  cascade_deleted_replies INTEGER DEFAULT 0,

  -- Reason (optional, mainly for admin deletions)
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_deletion_logs_content_type ON public.content_deletion_logs(content_type);
CREATE INDEX idx_deletion_logs_deleted_by ON public.content_deletion_logs(deleted_by);
CREATE INDEX idx_deletion_logs_created_at ON public.content_deletion_logs(created_at DESC);
CREATE INDEX idx_deletion_logs_content_id ON public.content_deletion_logs(content_id);

-- RLS
ALTER TABLE content_deletion_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view deletion logs
CREATE POLICY "Admins can view deletion logs" ON content_deletion_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.clerk_id = auth.uid()::text
      AND users.is_admin = true
    )
  );

-- Service role can insert
GRANT ALL ON content_deletion_logs TO service_role;
