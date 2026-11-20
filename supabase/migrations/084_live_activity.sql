-- =====================================================
-- 084_live_activity.sql
-- 랜딩 · llms.txt · README 배지 · /stats 머리 숫자를 같은 회원 기준으로 DB 안에서 센다
-- =====================================================
-- (1) get_live_activity(): 랜딩(lib/data/global-stats.ts)은 회원 행을 모두 받아 서버 코드에서
--     더해 왔다. PostgREST 는 한 번에 1,000행까지만 돌려주므로 회원이 1,000명을 넘으면 합계 ·
--     국가 수가 조용히 작아진다. 최근 30일 사용 국가 · 최근 24시간 제출 국가도 여기서 센다.
-- (2) get_public_stats_summary(): /stats 의 회원 수가 가입을 마치지 않은 계정까지 세어
--     랜딩 · llms.txt 와 달랐다(2026-11-20: 306 vs 297, 차이 9명은 국가 · 토큰 기록 없음).
--     같은 회원 기준으로 맞춘다. 반환 모양은 그대로. 068 은 PUBLIC 실행 권한을 남겨
--     두었으므로(=X/postgres) 함께 걷는다.
-- 회원 기준: 가입 완료(onboarding_completed) · 탈퇴 아님 · 섀도 밴 아님.
-- 30일 범위는 CURRENT_DATE - 29 부터(lib/config/leaderboard-period.ts 와 같은 길이).
-- 둘 다 읽기 전용 · service_role 전용.
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_live_activity()
RETURNS TABLE (
  developers BIGINT,
  countries BIGINT,
  tokens_all_time BIGINT,
  cost_all_time NUMERIC,
  tokens_30d BIGINT,
  countries_30d BIGINT,
  countries_24h BIGINT
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  WITH members AS (
    SELECT u.id, u.country_code, u.total_tokens, u.total_cost, u.last_submission_at
    FROM public.users u
    WHERE u.onboarding_completed = true AND u.deleted_at IS NULL AND u.shadow_banned = false
  ),
  recent AS (
    SELECT us.user_id, SUM(us.total_tokens) AS tokens
    FROM public.usage_stats us
    JOIN members m ON m.id = us.user_id
    WHERE us.date >= CURRENT_DATE - 29
    GROUP BY us.user_id
  )
  SELECT
    (SELECT COUNT(*) FROM members)::BIGINT,
    (SELECT COUNT(DISTINCT country_code) FROM members WHERE country_code IS NOT NULL)::BIGINT,
    (SELECT COALESCE(SUM(total_tokens), 0) FROM members)::BIGINT,
    (SELECT COALESCE(SUM(total_cost), 0) FROM members)::NUMERIC,
    (SELECT COALESCE(SUM(tokens), 0) FROM recent)::BIGINT,
    (SELECT COUNT(DISTINCT m.country_code) FROM recent r JOIN members m ON m.id = r.user_id
      WHERE r.tokens > 0 AND m.country_code IS NOT NULL)::BIGINT,
    (SELECT COUNT(DISTINCT country_code) FROM members
      WHERE last_submission_at >= NOW() - INTERVAL '24 hours' AND country_code IS NOT NULL)::BIGINT;
$$;

REVOKE ALL ON FUNCTION public.get_live_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_activity() TO service_role;

COMMENT ON FUNCTION public.get_live_activity() IS
  '랜딩 · llms.txt · README 배지용 공개 숫자 — 가입 완료 · 비탈퇴 · 비섀도밴 회원 기준';

CREATE OR REPLACE FUNCTION public.get_public_stats_summary()
RETURNS TABLE (total_users BIGINT, total_countries BIGINT, tokens_30d BIGINT, sessions_30d BIGINT)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT
    (SELECT COUNT(*)::BIGINT FROM public.users u
      WHERE u.onboarding_completed = true AND u.deleted_at IS NULL AND u.shadow_banned = false),
    (SELECT COUNT(DISTINCT u.country_code)::BIGINT FROM public.users u
      WHERE u.onboarding_completed = true AND u.deleted_at IS NULL AND u.shadow_banned = false
        AND u.country_code IS NOT NULL),
    (SELECT COALESCE(SUM(us.total_tokens), 0)::BIGINT
      FROM public.usage_stats us JOIN public.users u ON u.id = us.user_id
      WHERE u.onboarding_completed = true AND u.deleted_at IS NULL AND u.shadow_banned = false
        AND us.date >= CURRENT_DATE - 29),
    (SELECT COALESCE(SUM(us.sessions), 0)::BIGINT
      FROM public.usage_stats us JOIN public.users u ON u.id = us.user_id
      WHERE u.onboarding_completed = true AND u.deleted_at IS NULL AND u.shadow_banned = false
        AND us.date >= CURRENT_DATE - 29);
$$;

REVOKE ALL ON FUNCTION public.get_public_stats_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_stats_summary() TO service_role;

NOTIFY pgrst, 'reload schema';
