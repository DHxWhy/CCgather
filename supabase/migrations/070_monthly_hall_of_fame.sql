-- =====================================================
-- 070_monthly_hall_of_fame.sql
-- 월간 명예의 전당 — 시즌1 = 2026-07 (과거 백필 안 함: 7/8 이전
-- CLI 과대집계 동결값 박제 방지, cli-overcount 메모리 참조)
-- =====================================================
-- 유저 정보(username·avatar·country)를 비정규화 박제: 탈퇴/변경에도
-- 기록 불멸이 명예의전당 본질. 매월 1일 크론이 snapshot_monthly_hof(전월)
-- 호출 (멱등: month 단위 DELETE 후 INSERT — PostgREST safeupdate 대비
-- WHERE 필수 충족). RPC 전부 service_role 전용 (REVOKE 동봉).
-- =====================================================

CREATE TABLE IF NOT EXISTS monthly_hall_of_fame (
  month DATE NOT NULL,
  rank INTEGER NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  country_code TEXT,
  tokens BIGINT NOT NULL DEFAULT 0,
  sessions BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (month, rank)
);

CREATE TABLE IF NOT EXISTS monthly_country_hof (
  month DATE NOT NULL,
  rank INTEGER NOT NULL,
  country_code TEXT NOT NULL,
  tokens BIGINT NOT NULL DEFAULT 0,
  users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (month, rank)
);

ALTER TABLE monthly_hall_of_fame ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_country_hof ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages monthly_hall_of_fame" ON monthly_hall_of_fame;
CREATE POLICY "Service role manages monthly_hall_of_fame"
  ON monthly_hall_of_fame FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages monthly_country_hof" ON monthly_country_hof;
CREATE POLICY "Service role manages monthly_country_hof"
  ON monthly_country_hof FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.snapshot_monthly_hof(target_month DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  m_start DATE := date_trunc('month', target_month)::date;
  m_end DATE := (date_trunc('month', target_month) + interval '1 month')::date;
  user_rows INTEGER;
BEGIN
  DELETE FROM public.monthly_hall_of_fame WHERE month = m_start;
  INSERT INTO public.monthly_hall_of_fame
    (month, rank, username, display_name, avatar_url, country_code, tokens, sessions)
  SELECT m_start, ROW_NUMBER() OVER (ORDER BY t.tokens DESC), t.username,
         t.display_name, t.avatar_url, t.country_code, t.tokens, t.sessions
  FROM (
    SELECT u.username, u.display_name,
           COALESCE(u.custom_avatar_url, u.avatar_url) AS avatar_url,
           u.country_code,
           SUM(us.total_tokens)::BIGINT AS tokens,
           SUM(us.sessions)::BIGINT AS sessions
    FROM public.usage_stats us
    JOIN public.users u ON u.id = us.user_id
    WHERE u.deleted_at IS NULL AND u.shadow_banned = false
      AND us.date >= m_start AND us.date < m_end
    GROUP BY u.id, u.username, u.display_name, u.custom_avatar_url, u.avatar_url, u.country_code
    ORDER BY tokens DESC
    LIMIT 10
  ) t;
  GET DIAGNOSTICS user_rows = ROW_COUNT;

  DELETE FROM public.monthly_country_hof WHERE month = m_start;
  INSERT INTO public.monthly_country_hof (month, rank, country_code, tokens, users)
  SELECT m_start, ROW_NUMBER() OVER (ORDER BY t.tokens DESC), t.country_code, t.tokens, t.users
  FROM (
    SELECT u.country_code,
           SUM(us.total_tokens)::BIGINT AS tokens,
           COUNT(DISTINCT u.id)::INTEGER AS users
    FROM public.usage_stats us
    JOIN public.users u ON u.id = us.user_id
    WHERE u.deleted_at IS NULL AND u.shadow_banned = false
      AND u.country_code IS NOT NULL
      AND us.date >= m_start AND us.date < m_end
    GROUP BY u.country_code
    ORDER BY tokens DESC
    LIMIT 10
  ) t;

  RETURN user_rows;
END;
$$;
REVOKE ALL ON FUNCTION public.snapshot_monthly_hof(DATE) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_month_race()
RETURNS TABLE (
  username TEXT, display_name TEXT, avatar_url TEXT,
  country_code TEXT, current_level INTEGER, tokens BIGINT
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT u.username, u.display_name,
         COALESCE(u.custom_avatar_url, u.avatar_url),
         u.country_code, u.current_level,
         SUM(us.total_tokens)::BIGINT
  FROM public.usage_stats us
  JOIN public.users u ON u.id = us.user_id
  WHERE u.deleted_at IS NULL AND u.shadow_banned = false
    AND us.date >= date_trunc('month', CURRENT_DATE)::date
  GROUP BY u.id, u.username, u.display_name, u.custom_avatar_url, u.avatar_url,
           u.country_code, u.current_level
  ORDER BY SUM(us.total_tokens) DESC
  LIMIT 3;
$$;
REVOKE ALL ON FUNCTION public.get_month_race() FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
