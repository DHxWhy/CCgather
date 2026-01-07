-- =====================================================
-- CCGather Database Schema - RLS Policies
-- Migration: 002_rls_policies
-- =====================================================

-- =====================================================
-- Enable RLS on all tables
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_display ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_snapshots ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Users Table Policies
-- =====================================================

-- Public can read visible profiles
CREATE POLICY "Public profiles viewable"
  ON users FOR SELECT
  USING (profile_visible = TRUE);

-- Users can read own profile (even if hidden)
CREATE POLICY "Users read own profile"
  ON users FOR SELECT
  USING (auth.uid()::text = clerk_id);

-- Users can update own profile
CREATE POLICY "Users update own profile"
  ON users FOR UPDATE
  USING (auth.uid()::text = clerk_id)
  WITH CHECK (auth.uid()::text = clerk_id);

-- =====================================================
-- Usage Stats Table Policies
-- =====================================================

-- Public can read all stats
CREATE POLICY "Stats are public"
  ON usage_stats FOR SELECT
  USING (TRUE);

-- Users can insert own stats
CREATE POLICY "Users insert own stats"
  ON usage_stats FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE clerk_id = auth.uid()::text
    )
  );

-- Users can update own stats (same day)
CREATE POLICY "Users update own stats"
  ON usage_stats FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM users WHERE clerk_id = auth.uid()::text
    )
  );

-- =====================================================
-- User Badges Table Policies
-- =====================================================

-- Public can read badges
CREATE POLICY "Badges are public"
  ON user_badges FOR SELECT
  USING (TRUE);

-- Only service role can modify badges (no INSERT/UPDATE policies)

-- =====================================================
-- Badge Display Table Policies
-- =====================================================

-- Public can read badge display
CREATE POLICY "Badge display is public"
  ON badge_display FOR SELECT
  USING (TRUE);

-- Users can update own badge display
CREATE POLICY "Users update own badge display"
  ON badge_display FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM users WHERE clerk_id = auth.uid()::text
    )
  );

-- Users can insert own badge display
CREATE POLICY "Users insert own badge display"
  ON badge_display FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE clerk_id = auth.uid()::text
    )
  );

-- =====================================================
-- Country Stats Table Policies
-- =====================================================

-- Public read-only (service role updates)
CREATE POLICY "Country stats public"
  ON country_stats FOR SELECT
  USING (TRUE);

-- =====================================================
-- News Items Table Policies
-- =====================================================

-- Public read-only (service role inserts)
CREATE POLICY "News public"
  ON news_items FOR SELECT
  USING (is_visible = TRUE);

-- =====================================================
-- Daily Snapshots Table Policies
-- =====================================================

-- Public read-only
CREATE POLICY "Snapshots public"
  ON daily_snapshots FOR SELECT
  USING (TRUE);
