-- =====================================================
-- 076_lock_season_categories_for.sql
-- 075 잠금 우회 구멍 차단
-- =====================================================
-- ⚠️ 075 가 get_season_categories() 를 잠갔지만, 그 함수가 내부에서 부르는
--    season_categories_for(date) (073 정의) 는 여전히 PUBLIC 실행 가능이라
--    anon 이 헬퍼를 직접 호출해 동일 데이터를 그대로 가져갈 수 있었다.
--    (실측: anon POST /rest/v1/rpc/season_categories_for → 200 + 실데이터)
--    래퍼만 잠그고 헬퍼를 남기면 잠금이 무의미하다.
-- 호출 경로: get_season_categories()·snapshot_monthly_hof() 가 service_role 로
--    실행되며 이 헬퍼를 부르므로 service_role 에만 EXECUTE 를 남긴다.
-- =====================================================

-- 074 가 보드·명전의 동점 비결정성을 tokens DESC, username ASC 로 없앴는데
-- 이 함수만 2차 정렬이 없어 동점 시 챔피언이 매번 달라질 수 있었다(라이브
-- get_season_categories 와 monthly_category_hof 박제 양쪽이 이걸 쓴다).
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
      END DESC,
      u.username ASC
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

REVOKE ALL ON FUNCTION public.season_categories_for(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.season_categories_for(date) TO service_role;

NOTIFY pgrst, 'reload schema';
