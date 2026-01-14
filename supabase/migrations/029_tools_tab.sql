-- =====================================================
-- CCGather Database Schema - Tools Tab
-- Migration: 029_tools_tab
-- Description: Tools directory with trust-based voting
-- =====================================================

-- =====================================================
-- Tools Table
-- =====================================================
CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tagline TEXT NOT NULL CHECK (char_length(tagline) <= 100),
  description TEXT,
  website_url TEXT NOT NULL,
  logo_url TEXT,

  -- 분류
  category TEXT NOT NULL CHECK (category IN (
    'ai-coding', 'devops', 'productivity',
    'design', 'api-data', 'open-source', 'learning'
  )),
  tags TEXT[] DEFAULT '{}',

  -- 가격 유형
  pricing_type TEXT DEFAULT 'free' CHECK (pricing_type IN (
    'free', 'freemium', 'paid', 'open_source'
  )),

  -- 상태 관리
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'approved',
    'featured',
    'rejected'
  )),

  -- 제출 정보
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'user' CHECK (source IN ('user', 'admin', 'automation')),

  -- 통계 (비정규화 - 성능 최적화)
  upvote_count INTEGER DEFAULT 0,
  bookmark_count INTEGER DEFAULT 0,
  weighted_score DECIMAL(10,2) DEFAULT 0,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

-- Tools 인덱스
CREATE INDEX idx_tools_category ON tools(category);
CREATE INDEX idx_tools_status ON tools(status);
CREATE INDEX idx_tools_upvote_count ON tools(upvote_count DESC);
CREATE INDEX idx_tools_weighted_score ON tools(weighted_score DESC);
CREATE INDEX idx_tools_created_at ON tools(created_at DESC);
CREATE INDEX idx_tools_slug ON tools(slug);
CREATE INDEX idx_tools_submitted_by ON tools(submitted_by);
CREATE INDEX idx_tools_approved_at ON tools(approved_at DESC);

-- =====================================================
-- Tool Votes Table
-- =====================================================
CREATE TABLE tool_votes (
  tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  weight DECIMAL(3,1) DEFAULT 1.0,
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tool_id, user_id)
);

CREATE INDEX idx_tool_votes_user ON tool_votes(user_id);
CREATE INDEX idx_tool_votes_created ON tool_votes(created_at DESC);
CREATE INDEX idx_tool_votes_tool ON tool_votes(tool_id);

-- =====================================================
-- Tool Bookmarks Table
-- =====================================================
CREATE TABLE tool_bookmarks (
  tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tool_id, user_id)
);

CREATE INDEX idx_tool_bookmarks_user ON tool_bookmarks(user_id);
CREATE INDEX idx_tool_bookmarks_tool ON tool_bookmarks(tool_id);

-- =====================================================
-- User Trust Level View
-- 기존 users 테이블 데이터 기반 신뢰도 산정
-- =====================================================
CREATE OR REPLACE VIEW user_trust_level AS
SELECT
  u.id,
  u.username,
  u.avatar_url,
  u.current_level,
  u.global_rank,
  u.total_tokens,
  u.last_submission_at,
  CASE
    WHEN u.current_level >= 4 OR (u.global_rank IS NOT NULL AND u.global_rank <= 100) THEN 'elite'
    WHEN u.current_level >= 3 OR (u.global_rank IS NOT NULL AND u.global_rank <= 500) THEN 'power_user'
    WHEN u.current_level >= 2 AND u.last_submission_at IS NOT NULL THEN 'verified'
    ELSE 'member'
  END AS trust_tier,
  CASE
    WHEN u.current_level >= 4 OR (u.global_rank IS NOT NULL AND u.global_rank <= 100) THEN 3.0
    WHEN u.current_level >= 3 OR (u.global_rank IS NOT NULL AND u.global_rank <= 500) THEN 2.0
    WHEN u.current_level >= 2 THEN 1.5
    ELSE 1.0
  END AS vote_weight
FROM users u;

-- =====================================================
-- Functions
-- =====================================================

-- 투표 후 통계 업데이트 함수
CREATE OR REPLACE FUNCTION update_tool_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tools
    SET
      upvote_count = upvote_count + 1,
      weighted_score = weighted_score + NEW.weight,
      updated_at = NOW()
    WHERE id = NEW.tool_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tools
    SET
      upvote_count = GREATEST(0, upvote_count - 1),
      weighted_score = GREATEST(0, weighted_score - OLD.weight),
      updated_at = NOW()
    WHERE id = OLD.tool_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 북마크 후 통계 업데이트 함수
CREATE OR REPLACE FUNCTION update_tool_bookmark_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tools
    SET
      bookmark_count = bookmark_count + 1,
      updated_at = NOW()
    WHERE id = NEW.tool_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tools
    SET
      bookmark_count = GREATEST(0, bookmark_count - 1),
      updated_at = NOW()
    WHERE id = OLD.tool_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Slug 생성 함수
CREATE OR REPLACE FUNCTION generate_tool_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- 기본 slug 생성 (영문 소문자, 하이픈만 허용)
  base_slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');

  IF base_slug = '' THEN
    base_slug := 'tool';
  END IF;

  final_slug := base_slug;

  -- 중복 확인 및 suffix 추가
  WHILE EXISTS (SELECT 1 FROM tools WHERE slug = final_slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Triggers
-- =====================================================

-- 투표 통계 트리거
CREATE TRIGGER trigger_update_tool_stats
AFTER INSERT OR DELETE ON tool_votes
FOR EACH ROW
EXECUTE FUNCTION update_tool_stats();

-- 북마크 통계 트리거
CREATE TRIGGER trigger_update_tool_bookmark_stats
AFTER INSERT OR DELETE ON tool_bookmarks
FOR EACH ROW
EXECUTE FUNCTION update_tool_bookmark_stats();

-- Slug 자동 생성 트리거
CREATE TRIGGER trigger_generate_tool_slug
BEFORE INSERT OR UPDATE OF name ON tools
FOR EACH ROW
WHEN (NEW.slug IS NULL OR NEW.slug = '')
EXECUTE FUNCTION generate_tool_slug();

-- Updated_at 자동 업데이트 트리거
CREATE TRIGGER trigger_tools_updated_at
BEFORE UPDATE ON tools
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- RLS Policies
-- =====================================================

-- Enable RLS
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_bookmarks ENABLE ROW LEVEL SECURITY;

-- Tools: 승인된 도구는 모두 조회 가능
CREATE POLICY "Approved tools are viewable by everyone"
ON tools FOR SELECT
USING (status IN ('approved', 'featured'));

-- Tools: 관리자는 모든 도구 조회 가능
CREATE POLICY "Admins can view all tools"
ON tools FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.clerk_id = auth.jwt() ->> 'sub'
    AND users.is_admin = true
  )
);

-- Tools: 제출자는 자신의 도구 조회 가능
CREATE POLICY "Users can view their own submissions"
ON tools FOR SELECT
USING (
  submitted_by IN (
    SELECT id FROM users
    WHERE clerk_id = auth.jwt() ->> 'sub'
  )
);

-- Tools: 로그인 사용자만 제출 가능
CREATE POLICY "Authenticated users can submit tools"
ON tools FOR INSERT
WITH CHECK (
  submitted_by IN (
    SELECT id FROM users
    WHERE clerk_id = auth.jwt() ->> 'sub'
  )
);

-- Tools: 관리자만 수정 가능
CREATE POLICY "Admins can update tools"
ON tools FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.clerk_id = auth.jwt() ->> 'sub'
    AND users.is_admin = true
  )
);

-- Tools: 관리자만 삭제 가능
CREATE POLICY "Admins can delete tools"
ON tools FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.clerk_id = auth.jwt() ->> 'sub'
    AND users.is_admin = true
  )
);

-- Tool Votes: 모두 조회 가능
CREATE POLICY "Tool votes are viewable by everyone"
ON tool_votes FOR SELECT
USING (true);

-- Tool Votes: 로그인 사용자만 투표 가능
CREATE POLICY "Authenticated users can vote"
ON tool_votes FOR INSERT
WITH CHECK (
  user_id IN (
    SELECT id FROM users
    WHERE clerk_id = auth.jwt() ->> 'sub'
  )
);

-- Tool Votes: 본인 투표만 삭제 가능
CREATE POLICY "Users can remove their own votes"
ON tool_votes FOR DELETE
USING (
  user_id IN (
    SELECT id FROM users
    WHERE clerk_id = auth.jwt() ->> 'sub'
  )
);

-- Tool Bookmarks: 본인 북마크만 조회 가능
CREATE POLICY "Users can view their own bookmarks"
ON tool_bookmarks FOR SELECT
USING (
  user_id IN (
    SELECT id FROM users
    WHERE clerk_id = auth.jwt() ->> 'sub'
  )
);

-- Tool Bookmarks: 로그인 사용자만 북마크 가능
CREATE POLICY "Authenticated users can bookmark"
ON tool_bookmarks FOR INSERT
WITH CHECK (
  user_id IN (
    SELECT id FROM users
    WHERE clerk_id = auth.jwt() ->> 'sub'
  )
);

-- Tool Bookmarks: 본인 북마크만 삭제 가능
CREATE POLICY "Users can remove their own bookmarks"
ON tool_bookmarks FOR DELETE
USING (
  user_id IN (
    SELECT id FROM users
    WHERE clerk_id = auth.jwt() ->> 'sub'
  )
);

-- =====================================================
-- Sample Data (Optional - for development)
-- =====================================================

-- 샘플 도구 데이터 (주석 처리 - 필요시 활성화)
/*
INSERT INTO tools (name, slug, tagline, description, website_url, category, pricing_type, status, source)
VALUES
  ('Claude Code', 'claude-code', 'Official Anthropic CLI for Claude', 'The official command-line interface for interacting with Claude AI, featuring advanced coding assistance.', 'https://claude.ai', 'ai-coding', 'free', 'featured', 'admin'),
  ('Cursor', 'cursor', 'The AI-first Code Editor', 'An AI-powered code editor built for pair programming with AI.', 'https://cursor.sh', 'ai-coding', 'freemium', 'approved', 'admin'),
  ('Supabase', 'supabase', 'Open source Firebase alternative', 'Build production-ready apps with Postgres database, authentication, instant APIs, and edge functions.', 'https://supabase.com', 'api-data', 'open_source', 'approved', 'admin'),
  ('Vercel', 'vercel', 'Deploy with zero config', 'The platform for frontend developers, providing the best developer experience for deploying web applications.', 'https://vercel.com', 'devops', 'freemium', 'approved', 'admin'),
  ('v0.dev', 'v0-dev', 'AI-powered UI generation', 'Generate React components with AI using natural language prompts.', 'https://v0.dev', 'design', 'freemium', 'featured', 'admin');
*/

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE tools IS 'Developer tools directory with trust-based voting';
COMMENT ON TABLE tool_votes IS 'User votes for tools with weighted scoring';
COMMENT ON TABLE tool_bookmarks IS 'User bookmarks for tools';
COMMENT ON VIEW user_trust_level IS 'Calculated trust tier based on user activity';
COMMENT ON COLUMN tools.weighted_score IS 'Sum of vote weights for ranking';
COMMENT ON COLUMN tool_votes.weight IS 'Vote weight based on user trust level at time of voting';
