-- =====================================================
-- 073_season_categories.sql
-- 시즌 다중 부문 챔피언: 토큰 → 비용 → 세션 (순차 배정, 중복 불가)
-- =====================================================
-- 앞 부문 우승자는 다음 부문 후보에서 제외 → 항상 서로 다른 3명.
-- 부문 순서(tokens→cost→sessions)가 곧 우선순위.
-- 라이브 조회용 get_season_categories() + 박제용 monthly_category_hof
-- (snapshot_monthly_hof 가 매월 함께 기록). 유저정보 비정규화 = 탈퇴 불멸.
-- REVOKE 동봉 (CREATE 시 anon/authenticated GRANT 재발동 함정).
-- =====================================================

CREATE TABLE IF NOT EXISTS monthly_category_hof (
  month DATE NOT NULL,
  category TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  country_code TEXT,
  tokens BIGINT NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  sessions BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (month, category)
);

ALTER TABLE monthly_category_hof ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages monthly_category_hof" ON monthly_category_hof;
CREATE POLICY "Service role manages monthly_category_hof"
  ON monthly_category_hof FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.season_categories_for(m_start DATE)
RETURNS TABLE (
  category TEXT,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  country_code TEXT,
  tokens BIGINT,
  cost NUMERIC,
  sessions BIGINT
)
LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
DECLARE
  m_end DATE := (date_trunc('month', m_start) + interval '1 month')::date;
  taken TEXT[] := ARRAY[]::TEXT[];
  cats TEXT[] := ARRAY['tokens', 'cost', 'sessions'];
  cat TEXT;
  rec RECORD;
BEGIN
  FOREACH cat IN ARRAY cats LOOP
    SELECT u.username::TEXT AS uname, u.display_name::TEXT AS dname,
           COALESCE(u.custom_avatar_url, u.avatar_url)::TEXT AS avatar,
           u.country_code::TEXT AS ccode,
           SUM(us.total_tokens)::BIGINT AS tok,
           COALESCE(SUM(us.cost_usd), 0)::NUMERIC AS cst,
           COALESCE(SUM(us.sessions), 0)::BIGINT AS sess
    INTO rec
    FROM public.usage_stats us
    JOIN public.users u ON u.id = us.user_id
    WHERE u.deleted_at IS NULL AND u.shadow_banned = false
      AND us.date >= m_start AND us.date < m_end
      AND NOT (u.username::TEXT = ANY(taken))
    GROUP BY u.id, u.username, u.display_name, u.custom_avatar_url, u.avatar_url, u.country_code
    ORDER BY
      CASE cat
        WHEN 'tokens' THEN SUM(us.total_tokens)::NUMERIC
        WHEN 'cost' THEN COALESCE(SUM(us.cost_usd), 0)::NUMERIC
        ELSE COALESCE(SUM(us.sessions), 0)::NUMERIC
      END DESC
    LIMIT 1;

    IF rec.uname IS NOT NULL THEN
      taken := array_append(taken, rec.uname);
      category := cat;
      username := rec.uname;
      display_name := rec.dname;
      avatar_url := rec.avatar;
      country_code := rec.ccode;
      tokens := rec.tok;
      cost := rec.cst;
      sessions := rec.sess;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.season_categories_for(DATE) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_season_categories()
RETURNS TABLE (
  category TEXT,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  country_code TEXT,
  tokens BIGINT,
  cost NUMERIC,
  sessions BIGINT
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT * FROM public.season_categories_for(date_trunc('month', CURRENT_DATE)::date);
$$;
REVOKE ALL ON FUNCTION public.get_season_categories() FROM anon, authenticated;

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

  DELETE FROM public.monthly_category_hof WHERE month = m_start;
  INSERT INTO public.monthly_category_hof
    (month, category, username, display_name, avatar_url, country_code, tokens, cost, sessions)
  SELECT m_start, c.category, c.username, c.display_name, c.avatar_url,
         c.country_code, c.tokens, c.cost, c.sessions
  FROM public.season_categories_for(m_start) c;

  RETURN user_rows;
END;
$$;
REVOKE ALL ON FUNCTION public.snapshot_monthly_hof(DATE) FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
