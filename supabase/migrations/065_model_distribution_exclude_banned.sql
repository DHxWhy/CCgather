-- =====================================================
-- 065_model_distribution_exclude_banned.sql
-- get_model_distribution: exclude shadow-banned / soft-deleted users
-- =====================================================
-- The admin "model distribution" (analytics/users) aggregated usage_stats with
-- NO user-state filter, so vrentati's fabricated 181B (claude-3-5-sonnet) polluted
-- the Sonnet family total (~196B → real 14.99B). Join users and exclude
-- shadow_banned / soft-deleted so admin sees clean numbers.
--
-- Applied live via Supabase MCP (2026-06-07). This file is the record.
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

NOTIFY pgrst, 'reload schema';
