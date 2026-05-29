-- ═══════════════════════════════════════════════════════════════════════════
-- 062_analytics_distinct_rpcs.sql
-- db-max-rows=1000 systemic truncation 근본책 (Pluto 패널 설계, 2026-05-29)
--
-- 문제: Supabase 프로젝트 db-max-rows=1000 → unbounded SELECT 가 1000행에서 잘림
--   → analytics/core 의 WAU/MAU 가 user_id 행을 1000개만 받아 distinct 과소집계
--   → analytics/users 의 byModel 도 페이지네이션 루프로 우회 중(비효율)
--
-- 해결: 집계를 DB 내부로 이관. COUNT(DISTINCT)/GROUP BY 는 소수 행만 반환
--   → db-max-rows 와 무관하게 항상 정확.
--
-- 공통 규칙: LANGUAGE sql STABLE / SET search_path='' (mig 010 정책) /
--   public. 스키마 한정 / service_role 전용 GRANT (anon·authenticated 차단).
--
-- ⚠️ 적용: Supabase Dashboard → SQL Editor 에서 본 파일 전체 수동 실행.
--   (drizzle/CLI/MCP 자동 경로 금지 — 프로젝트 규칙). 실행 후 NOTIFY 로 PostgREST
--   스키마 캐시 reload.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 2-A. get_model_distribution() ──────────────────────────────────────────
-- usage_stats.primary_model 기반 family(Opus/Sonnet/Haiku/Other) 토큰 집계.
-- 반환 ≤4행. analytics/users 의 byModel 페이지네이션 루프 대체.
CREATE OR REPLACE FUNCTION public.get_model_distribution()
RETURNS TABLE (
  family       TEXT,
  total_tokens BIGINT,
  pct          NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH classified AS (
    SELECT
      CASE
        WHEN lower(us.primary_model) LIKE '%opus%'   THEN 'Opus'
        WHEN lower(us.primary_model) LIKE '%sonnet%' THEN 'Sonnet'
        WHEN lower(us.primary_model) LIKE '%haiku%'  THEN 'Haiku'
        ELSE 'Other'
      END                          AS family,
      COALESCE(us.total_tokens, 0) AS total_tokens
    FROM public.usage_stats us
    WHERE us.primary_model IS NOT NULL
  ),
  agg AS (
    SELECT c.family, SUM(c.total_tokens)::BIGINT AS total_tokens
    FROM classified c
    GROUP BY c.family
  ),
  grand AS (
    SELECT SUM(a.total_tokens)::NUMERIC AS grand_total FROM agg a
  )
  SELECT
    a.family,
    a.total_tokens,
    CASE
      WHEN g.grand_total > 0
      THEN ROUND(a.total_tokens / g.grand_total * 100, 1)
      ELSE 0
    END AS pct
  FROM agg a CROSS JOIN grand g
  WHERE a.total_tokens > 0
  ORDER BY a.total_tokens DESC;
$$;

REVOKE ALL    ON FUNCTION public.get_model_distribution() FROM PUBLIC;
REVOKE ALL    ON FUNCTION public.get_model_distribution() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_model_distribution() TO service_role;

-- ─── 2-B. get_wau_mau_distinct_counts(p_days) ────────────────────────────────
-- WAU(p_days) / MAU(30d) 현재·이전 distinct 제출자 수. 4 윈도우 FILTER 단일 스캔.
-- 반환 1행 4컬럼. analytics/core 의 WAU/MAU 4× .limit(10000) 대체.
-- 경계: current=[now-N, now], previous=[now-2N, now-N) — 라우트와 동일 의미.
CREATE OR REPLACE FUNCTION public.get_wau_mau_distinct_counts(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  wau_current  INTEGER,
  wau_previous INTEGER,
  mau_current  INTEGER,
  mau_previous INTEGER
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    COUNT(DISTINCT us.user_id) FILTER (
      WHERE us.submitted_at >= now() - make_interval(days => p_days)
        AND us.submitted_at <= now()
    )::INTEGER AS wau_current,
    COUNT(DISTINCT us.user_id) FILTER (
      WHERE us.submitted_at >= now() - make_interval(days => p_days * 2)
        AND us.submitted_at <  now() - make_interval(days => p_days)
    )::INTEGER AS wau_previous,
    COUNT(DISTINCT us.user_id) FILTER (
      WHERE us.submitted_at >= now() - INTERVAL '30 days'
        AND us.submitted_at <= now()
    )::INTEGER AS mau_current,
    COUNT(DISTINCT us.user_id) FILTER (
      WHERE us.submitted_at >= now() - INTERVAL '60 days'
        AND us.submitted_at <  now() - INTERVAL '30 days'
    )::INTEGER AS mau_previous
  FROM public.usage_stats us
  WHERE us.submitted_at >= now() - make_interval(days => GREATEST(p_days * 2, 60));
$$;

REVOKE ALL    ON FUNCTION public.get_wau_mau_distinct_counts(INTEGER) FROM PUBLIC;
REVOKE ALL    ON FUNCTION public.get_wau_mau_distinct_counts(INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_wau_mau_distinct_counts(INTEGER) TO service_role;

-- ─── PostgREST 스키마 캐시 reload (필수) ─────────────────────────────────────
NOTIFY pgrst, 'reload schema';
