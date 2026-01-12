-- =====================================================
-- Changelog System Migration
-- News & Changelog 콘텐츠 시스템
-- =====================================================

-- =====================================================
-- 1. changelog_versions: 버전 목록
-- =====================================================

CREATE TABLE IF NOT EXISTS public.changelog_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL UNIQUE,        -- "2.1.0"
  version_slug VARCHAR(30) NOT NULL UNIQUE,   -- "v2-1-0"
  total_changes INTEGER DEFAULT 0,
  highlights TEXT[],                          -- slug[] 최대 3개
  official_url TEXT,
  release_type VARCHAR(20),                   -- "major", "minor", "patch"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_changelog_versions_slug ON public.changelog_versions(version_slug);
CREATE INDEX IF NOT EXISTS idx_changelog_versions_version ON public.changelog_versions(version);

-- =====================================================
-- 2. changelog_items: 개별 변경 항목
-- =====================================================

CREATE TABLE IF NOT EXISTS public.changelog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID REFERENCES public.changelog_versions(id) ON DELETE CASCADE,
  slug VARCHAR(100) NOT NULL UNIQUE,          -- "auto-skill-hot-reload"
  title VARCHAR(200) NOT NULL,
  category VARCHAR(50),                       -- "feature", "command", "improvement", "bugfix"

  -- CCgather 독자 콘텐츠
  overview TEXT,
  how_to_use TEXT,
  use_cases TEXT[],
  tips TEXT[],
  for_beginners TEXT,                         -- FOR BEGINNERS 섹션
  related_slugs TEXT[],

  -- 명령어 관련
  commands TEXT[],                            -- 관련 명령어/플래그
  code_examples JSONB,                        -- 코드 예시

  -- 검증 상태
  verification_status VARCHAR(20) DEFAULT 'pending', -- "approved", "pending", "rejected", "needs_revision"
  verification_confidence INTEGER,            -- 0-100
  verification_issues JSONB,                  -- 이슈 목록
  verification_suggestions JSONB,             -- 수정 제안

  -- AI 처리 정보
  ai_model_used VARCHAR(50),
  ai_tokens_used INTEGER,
  ai_cost_usd DECIMAL(10, 6),
  ai_processed_at TIMESTAMPTZ,

  -- 메타
  official_doc_url TEXT,
  is_highlight BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_changelog_items_version_id ON public.changelog_items(version_id);
CREATE INDEX IF NOT EXISTS idx_changelog_items_slug ON public.changelog_items(slug);
CREATE INDEX IF NOT EXISTS idx_changelog_items_category ON public.changelog_items(category);
CREATE INDEX IF NOT EXISTS idx_changelog_items_verification ON public.changelog_items(verification_status);

-- =====================================================
-- 3. beginners_dictionary: FOR BEGINNERS 사전
-- =====================================================

CREATE TABLE IF NOT EXISTS public.beginners_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,          -- "resume-flag"
  name VARCHAR(100) NOT NULL,                 -- "--resume"
  category VARCHAR(50) NOT NULL,              -- "session", "speed", "extend", etc.

  -- 콘텐츠
  command_syntax TEXT,                        -- "$ claude --resume"
  what_it_does TEXT,                          -- 간단한 설명
  for_beginners TEXT NOT NULL,                -- FOR BEGINNERS 비유 (핵심)

  -- 연관
  related_slugs TEXT[],
  related_changelog_slugs TEXT[],             -- changelog_items 참조
  official_doc_url TEXT,

  -- 검증
  verification_status VARCHAR(20) DEFAULT 'pending',
  verification_confidence INTEGER,

  -- 메타
  popularity_score INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_beginners_dict_slug ON public.beginners_dictionary(slug);
CREATE INDEX IF NOT EXISTS idx_beginners_dict_category ON public.beginners_dictionary(category);
CREATE INDEX IF NOT EXISTS idx_beginners_dict_popularity ON public.beginners_dictionary(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_beginners_dict_featured ON public.beginners_dictionary(is_featured) WHERE is_featured = TRUE;

-- =====================================================
-- 4. content_generation_logs: AI 처리 로그
-- =====================================================

CREATE TABLE IF NOT EXISTS public.content_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_table VARCHAR(50) NOT NULL,          -- "changelog_items", "beginners_dictionary"
  target_id UUID NOT NULL,

  -- 파이프라인 단계
  stage VARCHAR(20) NOT NULL,                 -- "collect", "generate", "verify"
  model_used VARCHAR(50) NOT NULL,            -- "haiku", "sonnet", "opus"

  -- 입력/출력
  input_data JSONB,
  output_data JSONB,

  -- 결과
  status VARCHAR(20) NOT NULL,                -- "success", "failed", "skipped"
  error_message TEXT,

  -- 비용
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DECIMAL(10, 6),
  duration_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_content_gen_logs_target ON public.content_generation_logs(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_content_gen_logs_stage ON public.content_generation_logs(stage);
CREATE INDEX IF NOT EXISTS idx_content_gen_logs_created ON public.content_generation_logs(created_at DESC);

-- =====================================================
-- 5. RLS Policies
-- =====================================================

-- changelog_versions: 공개 읽기, Admin만 쓰기
ALTER TABLE public.changelog_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "changelog_versions_public_read" ON public.changelog_versions
  FOR SELECT USING (true);

CREATE POLICY "changelog_versions_admin_write" ON public.changelog_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.is_admin = TRUE
    )
  );

-- changelog_items: 공개 읽기, Admin만 쓰기
ALTER TABLE public.changelog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "changelog_items_public_read" ON public.changelog_items
  FOR SELECT USING (true);

CREATE POLICY "changelog_items_admin_write" ON public.changelog_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.is_admin = TRUE
    )
  );

-- beginners_dictionary: 공개 읽기, Admin만 쓰기
ALTER TABLE public.beginners_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beginners_dict_public_read" ON public.beginners_dictionary
  FOR SELECT USING (true);

CREATE POLICY "beginners_dict_admin_write" ON public.beginners_dictionary
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.is_admin = TRUE
    )
  );

-- content_generation_logs: Admin만 접근
ALTER TABLE public.content_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_gen_logs_admin_only" ON public.content_generation_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.is_admin = TRUE
    )
  );

-- =====================================================
-- 6. Updated_at Trigger
-- =====================================================

-- Trigger function (재사용)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS update_changelog_versions_updated_at ON public.changelog_versions;
CREATE TRIGGER update_changelog_versions_updated_at
  BEFORE UPDATE ON public.changelog_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_changelog_items_updated_at ON public.changelog_items;
CREATE TRIGGER update_changelog_items_updated_at
  BEFORE UPDATE ON public.changelog_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_beginners_dict_updated_at ON public.beginners_dictionary;
CREATE TRIGGER update_beginners_dict_updated_at
  BEFORE UPDATE ON public.beginners_dictionary
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 7. Helper Views
-- =====================================================

-- 버전별 변경 사항 수 집계
CREATE OR REPLACE VIEW public.changelog_versions_with_counts AS
SELECT
  v.*,
  COUNT(i.id) AS actual_changes,
  COUNT(CASE WHEN i.is_highlight THEN 1 END) AS highlight_count,
  COUNT(CASE WHEN i.verification_status = 'approved' THEN 1 END) AS approved_count
FROM public.changelog_versions v
LEFT JOIN public.changelog_items i ON i.version_id = v.id
GROUP BY v.id;

-- 카테고리별 beginners 항목 수
CREATE OR REPLACE VIEW public.beginners_category_counts AS
SELECT
  category,
  COUNT(*) AS item_count,
  COUNT(CASE WHEN is_featured THEN 1 END) AS featured_count
FROM public.beginners_dictionary
GROUP BY category
ORDER BY item_count DESC;

-- =====================================================
-- 8. Sample Data (Optional - Development)
-- =====================================================

-- 샘플 버전 (테스트용)
-- INSERT INTO public.changelog_versions (version, version_slug, release_type, official_url)
-- VALUES
--   ('2.1.0', 'v2-1-0', 'minor', 'https://docs.anthropic.com/changelog#v2-1-0'),
--   ('2.0.0', 'v2-0-0', 'major', 'https://docs.anthropic.com/changelog#v2-0-0');
