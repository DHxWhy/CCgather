-- ============================================================================
-- Migration: Optimize RLS Policies for Performance
-- ============================================================================
-- Problem: auth.uid() and auth.jwt() are re-evaluated for each row
-- Solution: Wrap with (select ...) to evaluate once per query
-- Ref: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================================================

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users read own profile" ON public.users;
DROP POLICY IF EXISTS "Users update own profile" ON public.users;

CREATE POLICY "Users read own profile" ON public.users
  FOR SELECT TO public
  USING ((select auth.uid())::text = clerk_id);

CREATE POLICY "Users update own profile" ON public.users
  FOR UPDATE TO public
  USING ((select auth.uid())::text = clerk_id)
  WITH CHECK ((select auth.uid())::text = clerk_id);

-- ============================================================================
-- 2. USAGE_STATS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users insert own stats" ON public.usage_stats;
DROP POLICY IF EXISTS "Users update own stats" ON public.usage_stats;

CREATE POLICY "Users insert own stats" ON public.usage_stats
  FOR INSERT TO public
  WITH CHECK (user_id IN (
    SELECT users.id FROM users WHERE users.clerk_id = (select auth.uid())::text
  ));

CREATE POLICY "Users update own stats" ON public.usage_stats
  FOR UPDATE TO public
  USING (user_id IN (
    SELECT users.id FROM users WHERE users.clerk_id = (select auth.uid())::text
  ));

-- ============================================================================
-- 3. BADGE_DISPLAY TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users insert own badge display" ON public.badge_display;
DROP POLICY IF EXISTS "Users update own badge display" ON public.badge_display;

CREATE POLICY "Users insert own badge display" ON public.badge_display
  FOR INSERT TO public
  WITH CHECK (user_id IN (
    SELECT users.id FROM users WHERE users.clerk_id = (select auth.uid())::text
  ));

CREATE POLICY "Users update own badge display" ON public.badge_display
  FOR UPDATE TO public
  USING (user_id IN (
    SELECT users.id FROM users WHERE users.clerk_id = (select auth.uid())::text
  ));

-- ============================================================================
-- 4. ADMIN_ALERTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Super admin can view admin_alerts" ON public.admin_alerts;
DROP POLICY IF EXISTS "Super admin can insert admin_alerts" ON public.admin_alerts;
DROP POLICY IF EXISTS "Super admin can update admin_alerts" ON public.admin_alerts;
DROP POLICY IF EXISTS "Super admin can delete admin_alerts" ON public.admin_alerts;

CREATE POLICY "Super admin can view admin_alerts" ON public.admin_alerts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.clerk_id = (select auth.uid())::text
    AND users.email = 'black7177@gmail.com'
    AND users.is_admin = true
  ));

CREATE POLICY "Super admin can insert admin_alerts" ON public.admin_alerts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.clerk_id = (select auth.uid())::text
    AND users.email = 'black7177@gmail.com'
    AND users.is_admin = true
  ));

CREATE POLICY "Super admin can update admin_alerts" ON public.admin_alerts
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.clerk_id = (select auth.uid())::text
    AND users.email = 'black7177@gmail.com'
    AND users.is_admin = true
  ));

CREATE POLICY "Super admin can delete admin_alerts" ON public.admin_alerts
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.clerk_id = (select auth.uid())::text
    AND users.email = 'black7177@gmail.com'
    AND users.is_admin = true
  ));

-- ============================================================================
-- 5. CONTENT_DELETION_LOGS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view deletion logs" ON public.content_deletion_logs;

CREATE POLICY "Admins can view deletion logs" ON public.content_deletion_logs
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.clerk_id = (select auth.uid())::text
    AND users.is_admin = true
  ));

-- ============================================================================
-- 6. POSTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can soft delete own posts" ON public.posts;

CREATE POLICY "Users can create posts" ON public.posts
  FOR INSERT TO public
  WITH CHECK ((select auth.uid())::text = author_id::text);

CREATE POLICY "Users can update own posts" ON public.posts
  FOR UPDATE TO public
  USING ((select auth.uid())::text = author_id::text);

CREATE POLICY "Users can soft delete own posts" ON public.posts
  FOR DELETE TO public
  USING ((select auth.uid())::text = author_id::text);

-- ============================================================================
-- 7. COMMENTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;

CREATE POLICY "Users can create comments" ON public.comments
  FOR INSERT TO public
  WITH CHECK ((select auth.uid())::text = author_id::text);

CREATE POLICY "Users can update own comments" ON public.comments
  FOR UPDATE TO public
  USING ((select auth.uid())::text = author_id::text);

CREATE POLICY "Users can delete own comments" ON public.comments
  FOR DELETE TO public
  USING ((select auth.uid())::text = author_id::text);

-- ============================================================================
-- 8. POST_LIKES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can unlike posts" ON public.post_likes;

CREATE POLICY "Users can like posts" ON public.post_likes
  FOR INSERT TO public
  WITH CHECK ((select auth.uid())::text = user_id::text);

CREATE POLICY "Users can unlike posts" ON public.post_likes
  FOR DELETE TO public
  USING ((select auth.uid())::text = user_id::text);

-- ============================================================================
-- 9. COMMENT_LIKES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can like comments" ON public.comment_likes;
DROP POLICY IF EXISTS "Users can unlike comments" ON public.comment_likes;

CREATE POLICY "Users can like comments" ON public.comment_likes
  FOR INSERT TO public
  WITH CHECK ((select auth.uid())::text = user_id::text);

CREATE POLICY "Users can unlike comments" ON public.comment_likes
  FOR DELETE TO public
  USING ((select auth.uid())::text = user_id::text);

-- ============================================================================
-- 10. NOTIFICATIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO public
  USING ((select auth.uid())::text = user_id::text);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO public
  USING ((select auth.uid())::text = user_id::text);

-- ============================================================================
-- 11. PUSH_SUBSCRIPTIONS TABLE (also fix duplicate policy)
-- ============================================================================
-- Remove duplicate: "Users can view own push subscriptions" is covered by "Users can manage own push subscriptions" (ALL)
DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users can manage own push subscriptions" ON public.push_subscriptions
  FOR ALL TO public
  USING ((select auth.uid())::text = user_id::text)
  WITH CHECK ((select auth.uid())::text = user_id::text);

-- ============================================================================
-- 12. USER_NOTIFICATION_SETTINGS TABLE (also fix duplicate policy)
-- ============================================================================
-- Remove duplicate: "Users can view own settings" is covered by "Users can manage own settings" (ALL)
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_notification_settings;
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_notification_settings;

CREATE POLICY "Users can manage own settings" ON public.user_notification_settings
  FOR ALL TO public
  USING ((select auth.uid())::text = user_id::text)
  WITH CHECK ((select auth.uid())::text = user_id::text);

-- ============================================================================
-- 13. FOLLOWS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;

CREATE POLICY "Users can follow others" ON public.follows
  FOR INSERT TO public
  WITH CHECK ((select auth.uid())::text = follower_id::text);

CREATE POLICY "Users can unfollow" ON public.follows
  FOR DELETE TO public
  USING ((select auth.uid())::text = follower_id::text);

-- ============================================================================
-- 14. TOOLS TABLE (auth.jwt() -> (select auth.jwt()))
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view all tools" ON public.tools;
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.tools;
DROP POLICY IF EXISTS "Authenticated users can submit tools" ON public.tools;
DROP POLICY IF EXISTS "Admins can update tools" ON public.tools;
DROP POLICY IF EXISTS "Admins can delete tools" ON public.tools;

CREATE POLICY "Admins can view all tools" ON public.tools
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.clerk_id = ((select auth.jwt()) ->> 'sub')
    AND users.is_admin = true
  ));

CREATE POLICY "Users can view their own submissions" ON public.tools
  FOR SELECT TO public
  USING (submitted_by IN (
    SELECT users.id FROM users
    WHERE users.clerk_id = ((select auth.jwt()) ->> 'sub')
  ));

CREATE POLICY "Authenticated users can submit tools" ON public.tools
  FOR INSERT TO public
  WITH CHECK (submitted_by IN (
    SELECT users.id FROM users
    WHERE users.clerk_id = ((select auth.jwt()) ->> 'sub')
  ));

CREATE POLICY "Admins can update tools" ON public.tools
  FOR UPDATE TO public
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.clerk_id = ((select auth.jwt()) ->> 'sub')
    AND users.is_admin = true
  ));

CREATE POLICY "Admins can delete tools" ON public.tools
  FOR DELETE TO public
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.clerk_id = ((select auth.jwt()) ->> 'sub')
    AND users.is_admin = true
  ));

-- ============================================================================
-- 15. TOOL_VOTES TABLE (auth.jwt() -> (select auth.jwt()))
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can vote" ON public.tool_votes;
DROP POLICY IF EXISTS "Users can remove their own votes" ON public.tool_votes;

CREATE POLICY "Authenticated users can vote" ON public.tool_votes
  FOR INSERT TO public
  WITH CHECK (user_id IN (
    SELECT users.id FROM users
    WHERE users.clerk_id = ((select auth.jwt()) ->> 'sub')
  ));

CREATE POLICY "Users can remove their own votes" ON public.tool_votes
  FOR DELETE TO public
  USING (user_id IN (
    SELECT users.id FROM users
    WHERE users.clerk_id = ((select auth.jwt()) ->> 'sub')
  ));

-- ============================================================================
-- 16. TOOL_BOOKMARKS TABLE (auth.jwt() -> (select auth.jwt()))
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own bookmarks" ON public.tool_bookmarks;
DROP POLICY IF EXISTS "Authenticated users can bookmark" ON public.tool_bookmarks;
DROP POLICY IF EXISTS "Users can remove their own bookmarks" ON public.tool_bookmarks;

CREATE POLICY "Users can view their own bookmarks" ON public.tool_bookmarks
  FOR SELECT TO public
  USING (user_id IN (
    SELECT users.id FROM users
    WHERE users.clerk_id = ((select auth.jwt()) ->> 'sub')
  ));

CREATE POLICY "Authenticated users can bookmark" ON public.tool_bookmarks
  FOR INSERT TO public
  WITH CHECK (user_id IN (
    SELECT users.id FROM users
    WHERE users.clerk_id = ((select auth.jwt()) ->> 'sub')
  ));

CREATE POLICY "Users can remove their own bookmarks" ON public.tool_bookmarks
  FOR DELETE TO public
  USING (user_id IN (
    SELECT users.id FROM users
    WHERE users.clerk_id = ((select auth.jwt()) ->> 'sub')
  ));

-- ============================================================================
-- 17. Add missing FK indexes (from advisor)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_cli_device_codes_user_id ON public.cli_device_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON public.notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_comment_id ON public.notifications(comment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_post_id ON public.notifications(post_id);

-- ============================================================================
-- Summary:
-- - 39 policies optimized (auth.uid/auth.jwt wrapped with select)
-- - 2 duplicate policies removed
-- - 4 missing FK indexes added
-- ============================================================================
