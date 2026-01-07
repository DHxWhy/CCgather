-- =====================================================
-- CCGather Database Schema - Initial Setup
-- Migration: 001_init
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Users Table
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  github_id TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  country_code CHAR(2),
  timezone TEXT DEFAULT 'UTC',

  -- Denormalized stats (updated on submission)
  total_tokens BIGINT DEFAULT 0,
  total_cost DECIMAL(12, 4) DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  global_rank INTEGER,
  country_rank INTEGER,

  -- Model tracking
  primary_model TEXT,
  primary_model_updated_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_submission_at TIMESTAMPTZ,

  -- Settings
  auto_sync_enabled BOOLEAN DEFAULT FALSE,
  profile_visible BOOLEAN DEFAULT TRUE,
  onboarding_completed BOOLEAN DEFAULT FALSE
);

-- =====================================================
-- Usage Stats Table
-- =====================================================
CREATE TABLE usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Token breakdown
  input_tokens BIGINT DEFAULT 0,
  output_tokens BIGINT DEFAULT 0,
  cache_read_tokens BIGINT DEFAULT 0,
  cache_write_tokens BIGINT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,

  -- Cost
  cost_usd DECIMAL(10, 4) DEFAULT 0,

  -- Model
  primary_model TEXT,

  -- Submission metadata
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  submission_source TEXT, -- 'cli', 'hook', 'api'
  validation_status TEXT DEFAULT 'approved',

  UNIQUE(user_id, date)
);

-- =====================================================
-- User Badges Table
-- =====================================================
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, badge_type)
);

-- =====================================================
-- Badge Display Table
-- =====================================================
CREATE TABLE badge_display (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  displayed_badges TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Country Stats Table (Materialized)
-- =====================================================
CREATE TABLE country_stats (
  country_code CHAR(2) PRIMARY KEY,
  country_name TEXT NOT NULL,
  total_users INTEGER DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  total_cost DECIMAL(14, 4) DEFAULT 0,
  global_rank INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- News Items Table
-- =====================================================
CREATE TABLE news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT UNIQUE NOT NULL,
  source_name TEXT NOT NULL,
  source_type TEXT,
  original_title TEXT NOT NULL,
  original_content TEXT,
  summary_md TEXT,
  key_points TEXT[],
  category TEXT,
  relevance_score INTEGER,
  published_at TIMESTAMPTZ,
  crawled_at TIMESTAMPTZ DEFAULT NOW(),
  summarized_at TIMESTAMPTZ,
  is_featured BOOLEAN DEFAULT FALSE,
  is_visible BOOLEAN DEFAULT TRUE
);

-- =====================================================
-- Daily Snapshots Table
-- =====================================================
CREATE TABLE daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  global_rank INTEGER,
  country_rank INTEGER,
  total_tokens BIGINT,
  total_cost DECIMAL(12, 4),
  level INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(snapshot_date, user_id)
);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_country ON users(country_code);
CREATE INDEX idx_users_global_rank ON users(global_rank);
CREATE INDEX idx_users_total_tokens ON users(total_tokens DESC);

CREATE INDEX idx_usage_user_date ON usage_stats(user_id, date DESC);
CREATE INDEX idx_usage_date ON usage_stats(date DESC);

CREATE INDEX idx_badges_user ON user_badges(user_id);

CREATE INDEX idx_news_crawled ON news_items(crawled_at DESC);
CREATE INDEX idx_news_category ON news_items(category);

CREATE INDEX idx_snapshots_date ON daily_snapshots(snapshot_date DESC);
CREATE INDEX idx_snapshots_user ON daily_snapshots(user_id);
