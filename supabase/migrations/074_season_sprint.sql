-- =====================================================
-- 074_season_sprint.sql
-- 시즌 스프린트 보드 + 시즌 기준시(UTC) 단일화 + 확정 유예
-- =====================================================
-- 기준시는 오직 두 함수에만 존재한다:
--   current_season_start() : 시즌 경계 = UTC 월초 00:00
--   season_finalized(m)    : 확정 시각 = 익월 4일 00:05 UTC (전월 종료 + 3일 유예)
-- 라이브 창을 쓰는 함수는 전부 current_season_start() 를 참조한다.
-- ⚠️ CURRENT_DATE 를 직접 쓰면 DB 타임존 설정에 의존해 크론(UTC)·UI(UTC)와
--    어긋난다. 그래서 now() AT TIME ZONE 'UTC' 로 명시 고정한다.
-- 지각 데이터: usage_stats 는 과거 날짜도 값을 올릴 수 있어(submit 병합정책),
--    확정 전까지는 라이브 집계를, 확정 후에는 박제 테이블을 읽는다.
-- REVOKE 동봉 (CREATE OR REPLACE 가 anon/authenticated GRANT 재발동).
-- =====================================================

ALTER TABLE public.monthly_hall_of_fame
  ADD COLUMN IF NOT EXISTS cost NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.monthly_hall_of_fame
  ADD COLUMN IF NOT EXISTS current_level INTEGER;

CREATE OR REPLACE FUNCTION public.current_season_start()
RETURNS date
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT date_trunc('month', (now() AT TIME ZONE 'UTC'))::date;
$$;
REVOKE ALL ON FUNCTION public.current_season_start() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.season_finalized(m_start date)
RETURNS boolean
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT ((m_start::timestamp + interval '1 month 3 days 5 minutes') AT TIME ZONE 'UTC') <= now();
$$;
REVOKE ALL ON FUNCTION public.season_finalized(date) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_season_board(m_start date, n integer DEFAULT 20)
RETURNS TABLE (
  rank integer,
  username text,
  display_name text,
  avatar_url text,
  country_code text,
  current_level integer,
  tokens bigint,
  cost numeric,
  frozen boolean
)
LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
BEGIN
  IF public.season_finalized(m_start) THEN
    RETURN QUERY
      SELECT h.rank, h.username::text, h.display_name::text, h.avatar_url::text,
             h.country_code::text, h.current_level, h.tokens, h.cost, true
      FROM public.monthly_hall_of_fame h
      WHERE h.month = m_start AND h.rank <= n
      ORDER BY h.rank;
  ELSE
    RETURN QUERY
      WITH mtd AS (
        SELECT u.username::text AS uname,
               u.display_name::text AS dname,
               COALESCE(u.custom_avatar_url, u.avatar_url)::text AS avatar,
               u.country_code::text AS ccode,
               u.current_level::integer AS lvl,
               SUM(us.total_tokens)::bigint AS tok,
               ROUND(COALESCE(SUM(us.cost_usd), 0)::numeric, 2) AS cst
        FROM public.usage_stats us
        JOIN public.users u ON u.id = us.user_id
        WHERE u.deleted_at IS NULL AND u.shadow_banned = false
          AND us.date >= m_start
          AND us.date < (m_start + interval '1 month')::date
        GROUP BY u.id, u.username, u.display_name, u.custom_avatar_url,
                 u.avatar_url, u.country_code, u.current_level
      )
      SELECT (ROW_NUMBER() OVER (ORDER BY m.tok DESC, m.uname ASC))::integer,
             m.uname, m.dname, m.avatar, m.ccode, m.lvl, m.tok, m.cst, false
      FROM mtd m
      ORDER BY m.tok DESC, m.uname ASC
      LIMIT n;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.get_season_board(date, integer) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_season_position(viewer uuid, m_start date)
RETURNS TABLE (
  my_rank integer,
  total_participants integer,
  my_tokens bigint,
  my_cost numeric,
  above_username text,
  above_tokens bigint,
  below_username text,
  below_tokens bigint,
  first_username text,
  first_tokens bigint,
  cut_rank integer,
  cut_tokens bigint
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  WITH mtd AS (
    SELECT u.id AS uid,
           u.username::text AS uname,
           SUM(us.total_tokens)::bigint AS tok,
           ROUND(COALESCE(SUM(us.cost_usd), 0)::numeric, 2) AS cst
    FROM public.usage_stats us
    JOIN public.users u ON u.id = us.user_id
    WHERE u.deleted_at IS NULL AND u.shadow_banned = false
      AND us.date >= m_start
      AND us.date < (m_start + interval '1 month')::date
    GROUP BY u.id, u.username
  ), ranked AS (
    SELECT m.*,
           (ROW_NUMBER() OVER (ORDER BY m.tok DESC, m.uname ASC))::integer AS rnk,
           (COUNT(*) OVER ())::integer AS total
    FROM mtd m
  ), me AS (
    SELECT * FROM ranked WHERE uid = viewer
  )
  SELECT me.rnk, me.total, me.tok, me.cst,
         a.uname, a.tok,
         b.uname, b.tok,
         f.uname, f.tok,
         20::integer,
         c.tok
  FROM me
  LEFT JOIN ranked a ON a.rnk = me.rnk - 1
  LEFT JOIN ranked b ON b.rnk = me.rnk + 1
  LEFT JOIN ranked f ON f.rnk = 1
  LEFT JOIN ranked c ON c.rnk = 20;
$$;
REVOKE ALL ON FUNCTION public.get_season_position(uuid, date) FROM anon, authenticated;

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
    AND us.date >= public.current_season_start()
  GROUP BY u.id, u.username, u.display_name, u.custom_avatar_url, u.avatar_url,
           u.country_code, u.current_level
  ORDER BY SUM(us.total_tokens) DESC, u.username ASC
  LIMIT 3;
$$;
REVOKE ALL ON FUNCTION public.get_month_race() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_month_country_race()
RETURNS TABLE (country_code TEXT, tokens BIGINT, users INTEGER)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT u.country_code::TEXT,
         SUM(us.total_tokens)::BIGINT,
         COUNT(DISTINCT u.id)::INTEGER
  FROM public.usage_stats us
  JOIN public.users u ON u.id = us.user_id
  WHERE u.deleted_at IS NULL AND u.shadow_banned = false
    AND u.country_code IS NOT NULL
    AND us.date >= public.current_season_start()
  GROUP BY u.country_code
  ORDER BY SUM(us.total_tokens) DESC, u.country_code ASC
  LIMIT 3;
$$;
REVOKE ALL ON FUNCTION public.get_month_country_race() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_season_categories()
RETURNS TABLE (
  category TEXT, username TEXT, display_name TEXT, avatar_url TEXT,
  country_code TEXT, tokens BIGINT, cost NUMERIC, sessions BIGINT
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT * FROM public.season_categories_for(public.current_season_start());
$$;
REVOKE ALL ON FUNCTION public.get_season_categories() FROM anon, authenticated;

-- 박제는 화면 보드와 같은 20행이어야 과거 시즌을 열었을 때 보드가
-- 그대로 멈춰 보인다. 정렬은 라이브 보드와 동일(tokens DESC, username ASC).
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
    (month, rank, username, display_name, avatar_url, country_code,
     tokens, sessions, cost, current_level)
  SELECT m_start, ROW_NUMBER() OVER (ORDER BY t.tokens DESC, t.username ASC), t.username,
         t.display_name, t.avatar_url, t.country_code, t.tokens, t.sessions,
         t.cost, t.current_level
  FROM (
    SELECT u.username, u.display_name,
           COALESCE(u.custom_avatar_url, u.avatar_url) AS avatar_url,
           u.country_code, u.current_level,
           SUM(us.total_tokens)::BIGINT AS tokens,
           SUM(us.sessions)::BIGINT AS sessions,
           ROUND(COALESCE(SUM(us.cost_usd), 0)::numeric, 2) AS cost
    FROM public.usage_stats us
    JOIN public.users u ON u.id = us.user_id
    WHERE u.deleted_at IS NULL AND u.shadow_banned = false
      AND us.date >= m_start AND us.date < m_end
    GROUP BY u.id, u.username, u.display_name, u.custom_avatar_url,
             u.avatar_url, u.country_code, u.current_level
    ORDER BY tokens DESC, u.username ASC
    LIMIT 20
  ) t;
  GET DIAGNOSTICS user_rows = ROW_COUNT;

  DELETE FROM public.monthly_country_hof WHERE month = m_start;
  INSERT INTO public.monthly_country_hof (month, rank, country_code, tokens, users)
  SELECT m_start, ROW_NUMBER() OVER (ORDER BY t.tokens DESC, t.country_code ASC),
         t.country_code, t.tokens, t.users
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
    ORDER BY tokens DESC, u.country_code ASC
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
