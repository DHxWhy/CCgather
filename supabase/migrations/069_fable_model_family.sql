-- =====================================================
-- 069_fable_model_family.sql
-- get_model_distribution 에 Fable 패밀리 추가
-- =====================================================
-- claude-fable-5 가 opus/sonnet/haiku 키워드에 안 걸려 "Other"(프록시
-- 모델 바구니)로 분류되던 것을 분리. 최근 1000행 기준 2위 모델.
-- 반환 타입 동일 → CREATE OR REPLACE 가능. REVOKE 재동봉
-- (REPLACE 시 anon/authenticated GRANT 재발동 함정).
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_model_distribution()
 RETURNS TABLE(family text, total_tokens bigint, pct numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  WITH classified AS (
    SELECT
      CASE
        WHEN lower(us.primary_model) LIKE '%fable%'  THEN 'Fable'
        WHEN lower(us.primary_model) LIKE '%opus%'   THEN 'Opus'
        WHEN lower(us.primary_model) LIKE '%sonnet%' THEN 'Sonnet'
        WHEN lower(us.primary_model) LIKE '%haiku%'  THEN 'Haiku'
        ELSE 'Other'
      END AS family,
      COALESCE(us.total_tokens, 0) AS total_tokens
    FROM public.usage_stats us
    JOIN public.users u ON u.id = us.user_id
    WHERE us.primary_model IS NOT NULL
      AND u.shadow_banned = false
      AND u.deleted_at IS NULL
  ),
  agg AS (
    SELECT c.family, SUM(c.total_tokens)::BIGINT AS total_tokens
    FROM classified c GROUP BY c.family
  ),
  grand AS (SELECT SUM(a.total_tokens)::NUMERIC AS grand_total FROM agg a)
  SELECT a.family, a.total_tokens,
    CASE WHEN g.grand_total > 0 THEN ROUND(a.total_tokens / g.grand_total * 100, 1) ELSE 0 END AS pct
  FROM agg a CROSS JOIN grand g
  WHERE a.total_tokens > 0
  ORDER BY a.total_tokens DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_model_distribution() FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
