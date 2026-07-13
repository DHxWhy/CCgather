-- =====================================================
-- 067_analytics_daily_and_public_stats.sql
-- 공개 /stats 페이지 + PostHog 지표 영구 적재
-- 설계: docs/superpowers/specs/2026-07-13-public-stats-design.md
-- =====================================================
-- analytics_daily: Vercel Cron(analytics-snapshot)이 매일 PostHog에서
--   방문자·페이지뷰·상위 리퍼러를 가져와 upsert. PostHog 보관정책과
--   무관하게 유입 데이터를 자체 DB에 영구 보존.
-- RPC 3종: 공개 /stats 용 DB 내부 집계 (db-max-rows=1000 캡 회피).
--   shadow_banned·soft-deleted 유저 제외. service_role 전용
--   (공개 API는 service client로 호출 — anon REST 노출 차단).
-- =====================================================

CREATE TABLE IF NOT EXISTS analytics_daily (
  date DATE PRIMARY KEY,
  visitors INTEGER NOT NULL DEFAULT 0,
  pageviews INTEGER NOT NULL DEFAULT 0,
  top_referrers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages analytics_daily" ON analytics_daily;
CREATE POLICY "Service role manages analytics_daily"
  ON analytics_daily FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_signup_growth()
RETURNS TABLE (date DATE, signups BIGINT, cumulative BIGINT)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  WITH daily AS (
    SELECT u.created_at::date AS d, COUNT(*)::BIGINT AS c
    FROM public.users u
    WHERE u.deleted_at IS NULL AND u.shadow_banned = false
    GROUP BY u.created_at::date
  )
  SELECT d, c, SUM(c) OVER (ORDER BY d)::BIGINT
  FROM daily ORDER BY d;
$$;
REVOKE ALL ON FUNCTION public.get_signup_growth() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_country_distribution()
RETURNS TABLE (country_code TEXT, user_count BIGINT)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT u.country_code::TEXT, COUNT(*)::BIGINT
  FROM public.users u
  WHERE u.deleted_at IS NULL AND u.shadow_banned = false
    AND u.country_code IS NOT NULL
  GROUP BY u.country_code
  ORDER BY COUNT(*) DESC;
$$;
REVOKE ALL ON FUNCTION public.get_country_distribution() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_stats_summary()
RETURNS TABLE (total_users BIGINT, total_countries BIGINT, tokens_30d BIGINT, active_devs_30d BIGINT)
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
    (SELECT COUNT(DISTINCT us.user_id)::BIGINT
      FROM public.usage_stats us JOIN public.users u ON u.id = us.user_id
      WHERE u.deleted_at IS NULL AND u.shadow_banned = false
        AND us.date >= CURRENT_DATE - 29);
$$;
REVOKE ALL ON FUNCTION public.get_public_stats_summary() FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
