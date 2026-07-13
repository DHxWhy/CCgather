-- =====================================================
-- 072_month_country_race.sql
-- 이번 달 국가 챔피언 레이스 (시즌 카드용)
-- =====================================================
-- 기존 get_country_race 는 "가입자 수 + 주간 신규" 기준이라
-- 시즌 국가 챔피언(= 이번 달 토큰 1위)과 다른 지표.
-- REVOKE 동봉 (CREATE 시 anon/authenticated GRANT 재발동 함정).
-- =====================================================

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
    AND us.date >= date_trunc('month', CURRENT_DATE)::date
  GROUP BY u.country_code
  ORDER BY SUM(us.total_tokens) DESC
  LIMIT 3;
$$;
REVOKE ALL ON FUNCTION public.get_month_country_race() FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
