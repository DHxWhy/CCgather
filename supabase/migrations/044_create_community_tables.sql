-- =====================================================
-- Community Tables Migration
-- Data Retention Policy: Reddit/X style
--   - Posts/Comments: Permanent (until user deletes)
--   - Deleted content: Soft delete 30 days → Hard delete
--   - Notifications: 90 days retention
--   - Likes: Permanent
-- =====================================================

-- =====================================================
-- 1. POSTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Content
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  original_content TEXT, -- Original before translation
  original_language VARCHAR(10) DEFAULT 'en',
  is_translated BOOLEAN DEFAULT false,

  -- Media (optional)
  images TEXT[] DEFAULT '{}',

  -- Engagement counts (denormalized for performance)
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,

  -- Categorization
  tab VARCHAR(20) DEFAULT 'vibes' CHECK (tab IN ('vibes', 'showcase', 'help', 'canu')),

  -- Soft delete
  deleted_at TIMESTAMPTZ DEFAULT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for posts
CREATE INDEX idx_posts_author ON public.posts(author_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_tab ON public.posts(tab);
CREATE INDEX idx_posts_not_deleted ON public.posts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_deleted_at ON public.posts(deleted_at) WHERE deleted_at IS NOT NULL;

-- =====================================================
-- 2. COMMENTS TABLE (with reply support)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Reply support (null = top-level comment)
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,

  -- Content
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),

  -- Engagement
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,

  -- Soft delete
  deleted_at TIMESTAMPTZ DEFAULT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for comments
CREATE INDEX idx_comments_post ON public.comments(post_id);
CREATE INDEX idx_comments_author ON public.comments(author_id);
CREATE INDEX idx_comments_parent ON public.comments(parent_comment_id);
CREATE INDEX idx_comments_created_at ON public.comments(created_at DESC);
CREATE INDEX idx_comments_not_deleted ON public.comments(deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- 3. POST LIKES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One like per user per post
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX idx_post_likes_user ON public.post_likes(user_id);

-- =====================================================
-- 4. COMMENT LIKES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One like per user per comment
  UNIQUE(comment_id, user_id)
);

CREATE INDEX idx_comment_likes_comment ON public.comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user ON public.comment_likes(user_id);

-- =====================================================
-- 5. NOTIFICATIONS TABLE
-- Retention: 90 days
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Notification type
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'post_like',      -- Someone liked your post
    'post_comment',   -- Someone commented on your post
    'comment_like',   -- Someone liked your comment
    'comment_reply',  -- Someone replied to your comment
    'mention',        -- Someone mentioned you
    'follow',         -- Someone followed you
    'badge_earned',   -- You earned a badge
    'level_up',       -- You leveled up
    'rank_update',    -- Daily/weekly rank briefing
    'submission_complete' -- Data submission completed
  )),

  -- Actor (who triggered the notification)
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Related entities
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,

  -- Notification content
  title VARCHAR(100),
  body TEXT,
  data JSONB DEFAULT '{}', -- Additional data (badge info, rank info, etc.)

  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  -- For push notification tracking
  is_pushed BOOLEAN DEFAULT false,
  pushed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Auto-expire after 90 days
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days'
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_expires ON public.notifications(expires_at);

-- =====================================================
-- 6. PUSH SUBSCRIPTIONS TABLE
-- For Web Push notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Web Push subscription object
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,  -- Public key
  auth TEXT NOT NULL,    -- Auth secret

  -- Device info
  user_agent TEXT,
  device_type VARCHAR(20) DEFAULT 'web', -- web, android, ios

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_active ON public.push_subscriptions(user_id) WHERE is_active = true;

-- =====================================================
-- 7. USER NOTIFICATION SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,

  -- Push notification toggles
  push_enabled BOOLEAN DEFAULT true,

  -- Notification type toggles
  notify_post_likes BOOLEAN DEFAULT true,
  notify_post_comments BOOLEAN DEFAULT true,
  notify_comment_likes BOOLEAN DEFAULT true,
  notify_comment_replies BOOLEAN DEFAULT true,
  notify_mentions BOOLEAN DEFAULT true,
  notify_follows BOOLEAN DEFAULT true,
  notify_badges BOOLEAN DEFAULT true,
  notify_level_up BOOLEAN DEFAULT true,
  notify_rank_updates BOOLEAN DEFAULT true,
  notify_submissions BOOLEAN DEFAULT true,

  -- Quiet hours (optional)
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',

  -- Email digest (future)
  email_digest_enabled BOOLEAN DEFAULT false,
  email_digest_frequency VARCHAR(10) DEFAULT 'weekly', -- daily, weekly, never

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. FOLLOWS TABLE (optional, for future)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Can't follow yourself
  CHECK (follower_id != following_id),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);

-- =====================================================
-- TRIGGERS: Auto-update counts
-- =====================================================

-- Update post likes_count
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_post_likes_count
AFTER INSERT OR DELETE ON post_likes
FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

-- Update post comments_count
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    -- Also update parent comment's replies_count if this is a reply
    IF NEW.parent_comment_id IS NOT NULL THEN
      UPDATE comments SET replies_count = replies_count + 1 WHERE id = NEW.parent_comment_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
    IF OLD.parent_comment_id IS NOT NULL THEN
      UPDATE comments SET replies_count = GREATEST(0, replies_count - 1) WHERE id = OLD.parent_comment_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_post_comments_count
AFTER INSERT OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- Update comment likes_count
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment_likes_count
AFTER INSERT OR DELETE ON comment_likes
FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_posts_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_comments_updated_at
BEFORE UPDATE ON comments
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_push_subscriptions_updated_at
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_notification_settings_updated_at
BEFORE UPDATE ON user_notification_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Posts policies
CREATE POLICY "Posts are viewable by everyone" ON posts
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Users can create posts" ON posts
  FOR INSERT WITH CHECK (auth.uid()::text = author_id::text);

CREATE POLICY "Users can update own posts" ON posts
  FOR UPDATE USING (auth.uid()::text = author_id::text);

CREATE POLICY "Users can soft delete own posts" ON posts
  FOR DELETE USING (auth.uid()::text = author_id::text);

-- Comments policies
CREATE POLICY "Comments are viewable by everyone" ON comments
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Users can create comments" ON comments
  FOR INSERT WITH CHECK (auth.uid()::text = author_id::text);

CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (auth.uid()::text = author_id::text);

CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (auth.uid()::text = author_id::text);

-- Post likes policies
CREATE POLICY "Post likes are viewable by everyone" ON post_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like posts" ON post_likes
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can unlike posts" ON post_likes
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Comment likes policies
CREATE POLICY "Comment likes are viewable by everyone" ON comment_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like comments" ON comment_likes
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can unlike comments" ON comment_likes
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Notifications policies (private to user)
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Push subscriptions policies
CREATE POLICY "Users can view own push subscriptions" ON push_subscriptions
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can manage own push subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid()::text = user_id::text);

-- Notification settings policies
CREATE POLICY "Users can view own settings" ON user_notification_settings
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can manage own settings" ON user_notification_settings
  FOR ALL USING (auth.uid()::text = user_id::text);

-- Follows policies
CREATE POLICY "Follows are viewable by everyone" ON follows
  FOR SELECT USING (true);

CREATE POLICY "Users can follow others" ON follows
  FOR INSERT WITH CHECK (auth.uid()::text = follower_id::text);

CREATE POLICY "Users can unfollow" ON follows
  FOR DELETE USING (auth.uid()::text = follower_id::text);

-- =====================================================
-- SCHEDULED CLEANUP FUNCTIONS
-- (To be called by cron job or Supabase scheduled function)
-- =====================================================

-- Hard delete posts that were soft-deleted 30+ days ago (Reddit/X style)
CREATE OR REPLACE FUNCTION cleanup_deleted_posts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM posts
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hard delete comments that were soft-deleted 30+ days ago
CREATE OR REPLACE FUNCTION cleanup_deleted_comments()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM comments
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete expired notifications (90 days)
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Master cleanup function
CREATE OR REPLACE FUNCTION run_community_cleanup()
RETURNS JSONB AS $$
DECLARE
  posts_deleted INTEGER;
  comments_deleted INTEGER;
  notifications_deleted INTEGER;
BEGIN
  SELECT cleanup_deleted_posts() INTO posts_deleted;
  SELECT cleanup_deleted_comments() INTO comments_deleted;
  SELECT cleanup_expired_notifications() INTO notifications_deleted;

  RETURN jsonb_build_object(
    'posts_deleted', posts_deleted,
    'comments_deleted', comments_deleted,
    'notifications_deleted', notifications_deleted,
    'executed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View for posts with author info (commonly used)
CREATE OR REPLACE VIEW posts_with_author AS
SELECT
  p.*,
  u.username AS author_username,
  u.display_name AS author_display_name,
  u.avatar_url AS author_avatar_url,
  u.country_code AS author_country_code,
  COALESCE(
    (SELECT level FROM (
      SELECT 1 AS level, 0 AS min_tokens
      UNION SELECT 2, 100000
      UNION SELECT 3, 500000
      UNION SELECT 4, 2000000
      UNION SELECT 5, 10000000
      UNION SELECT 6, 50000000
    ) levels WHERE u.total_tokens >= min_tokens ORDER BY level DESC LIMIT 1),
    1
  ) AS author_level
FROM posts p
JOIN users u ON p.author_id = u.id
WHERE p.deleted_at IS NULL;

-- =====================================================
-- GRANTS FOR SERVICE ROLE
-- =====================================================
GRANT ALL ON posts TO service_role;
GRANT ALL ON comments TO service_role;
GRANT ALL ON post_likes TO service_role;
GRANT ALL ON comment_likes TO service_role;
GRANT ALL ON notifications TO service_role;
GRANT ALL ON push_subscriptions TO service_role;
GRANT ALL ON user_notification_settings TO service_role;
GRANT ALL ON follows TO service_role;

-- Allow service role to run cleanup
GRANT EXECUTE ON FUNCTION cleanup_deleted_posts TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_deleted_comments TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_notifications TO service_role;
GRANT EXECUTE ON FUNCTION run_community_cleanup TO service_role;
