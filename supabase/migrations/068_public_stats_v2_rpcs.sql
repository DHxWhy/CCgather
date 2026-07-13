-- =====================================================
-- 068_public_stats_v2_rpcs.sql
-- 공개 /stats 개편: 방문자 제거·세션 지표·국가 레이스·최근 싱크
-- =====================================================
-- summary 반환 컬럼 변경(active_devs_30d → sessions_30d)이라
-- CREATE OR REPLACE 불가 → DROP 후 재생성 (return type 변경 제약).
-- 모든 함수 REVOKE 동봉 (CREATE 시 anon/authenticated GRANT 재발동 함정).
-- =====================================================

DROP FUNCTION IF EXISTS public.get_public_stats_summary();

CREATE FUNCTION public.get_public_stats_summary()
RETURNS TABLE (total_users BIGINT, total_countries BIGINT, tokens_30d BIGINT, sessions_30d BIGINT)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT
    (SELECT COUNT(*)::BIGINT FROM public.users u
      WHERE u.deleted_at IS NULL AND u.shadow_banned = false),
    (SELECT COUNT(DISTINCT u.country_code)::BIGINT FROM public.users u
      WHERE u.deleted_at IS NULL AND u.shadow_banned = false AND u.country_code IS NOT NULL),
    (SELECT COALESCE(SUM(us.total_tokens), 0)::BIGINT
      FROM public.usage_stats us JOIN public.users u ON u.id = us.user_id
      WHERE u.deleted_at IS NULL AND u.shadow_banned = false
        AND us.date >= CURRENT_DATE - 29),
    (SELECT COALESCE(SUM(us.sessions), 0)::BIGINT
      FROM public.usage_stats us JOIN public.users u ON u.id = us.user_id
      WHERE u.deleted_at IS NULL AND u.shadow_banned = false
        AND us.date >= CURRENT_DATE - 29);
$$;
REVOKE ALL ON FUNCTION public.get_public_stats_summary() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_country_race()
RETURNS TABLE (country_code TEXT, total_users BIGINT, week_signups BIGINT, prev_week_signups BIGINT)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT
    u.country_code::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE u.created_at >= NOW() - INTERVAL '7 days')::BIGINT,
    COUNT(*) FILTER (
      WHERE u.created_at >= NOW() - INTERVAL '14 days'
        AND u.created_at < NOW() - INTERVAL '7 days'
    )::BIGINT
  FROM public.users u
  WHERE u.deleted_at IS NULL AND u.shadow_banned = false AND u.country_code IS NOT NULL
  GROUP BY u.country_code
  ORDER BY COUNT(*) DESC;
$$;
REVOKE ALL ON FUNCTION public.get_country_race() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_recent_syncs()
RETURNS TABLE (country_code TEXT, synced_at TIMESTAMPTZ)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT sub.country_code::TEXT, sub.synced_at
  FROM (
    SELECT u.country_code, MAX(us.submitted_at) AS synced_at
    FROM public.usage_stats us
    JOIN public.users u ON u.id = us.user_id
    WHERE u.deleted_at IS NULL AND u.shadow_banned = false
      AND u.country_code IS NOT NULL AND us.submitted_at IS NOT NULL
    GROUP BY u.id, u.country_code
  ) sub
  ORDER BY sub.synced_at DESC
  LIMIT 10;
$$;
REVOKE ALL ON FUNCTION public.get_recent_syncs() FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
