-- =====================================================
-- 077_season_board_fallback.sql
-- 확정 분기 자가치유 폴백 + SUM NULL 방어
-- =====================================================
-- ⚠️ 문제1: get_season_board 가 확정(season_finalized) 시 monthly_hall_of_fame
--    만 읽어, 스냅샷 크론이 실패하면 빈 보드를 "carved and final / these 20
--    names stay up forever" 문구와 함께 영구 표시한다. Vercel Cron 은 자동
--    재시도가 없다. → 박제 행이 실제로 존재할 때만 박제를 읽고, 없으면 라이브로
--    폴백해 자가치유한다.
-- ⚠️ 문제2: usage_stats.total_tokens/sessions 는 nullable 인데 대상 컬럼은
--    NOT NULL 이라 SUM 이 NULL 이면 스냅샷 트랜잭션 전체가 abort 된다(→ 문제1의
--    백지 보드로 직결). 현재 NULL 행은 0건이나 방어한다. 라이브·박제 양쪽에
--    똑같이 적용해야 순위 정합이 유지된다.
-- ⚠️ CREATE OR REPLACE 는 anon/authenticated 의 PUBLIC GRANT 를 되살리므로
--    이 파일에서도 REVOKE/GRANT 를 반드시 동봉한다(075 와 동일 패턴).
-- =====================================================

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
  IF public.season_finalized(m_start)
     AND EXISTS (SELECT 1 FROM public.monthly_hall_of_fame h WHERE h.month = m_start)
  THEN
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
               COALESCE(SUM(us.total_tokens), 0)::bigint AS tok,
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
REVOKE ALL ON FUNCTION public.get_season_board(date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_season_board(date, integer) TO service_role;

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
           COALESCE(SUM(us.total_tokens), 0)::bigint AS tok,
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
REVOKE ALL ON FUNCTION public.get_season_position(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_season_position(uuid, date) TO service_role;

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
  IF NOT pg_try_advisory_xact_lock(hashtext('snapshot_monthly_hof')::bigint) THEN
    RETURN 0;
  END IF;

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
           COALESCE(SUM(us.total_tokens), 0)::BIGINT AS tokens,
           COALESCE(SUM(us.sessions), 0)::BIGINT AS sessions,
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
           COALESCE(SUM(us.total_tokens), 0)::BIGINT AS tokens,
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
REVOKE ALL ON FUNCTION public.snapshot_monthly_hof(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_monthly_hof(DATE) TO service_role;

NOTIFY pgrst, 'reload schema';
