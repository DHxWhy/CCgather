-- =====================================================
-- 082_rank_and_totals_functions.sql
-- Ranks and per-user totals computed inside the database, on the submit route's criteria
-- =====================================================
-- The submit route ranked in JavaScript: one SELECT of every ranked user (PostgREST
-- returns at most 1000 rows) and one UPDATE request per user, per submission. Its
-- per-user totals were another capped SELECT of usage_stats. The admin page and
-- /api/me ranked through 064's functions instead, whose criteria differed
-- (profile_visible, zero-token users included, no tie-break), so a rank depended on
-- who recomputed last. On 2026-10-22, 98 users outside the route's set still held a
-- global rank (21 of them the same number as a real user) and 103 a country rank
-- (zero-token users at country #1 and #2).
--
-- 1) calculate_global_ranks() / calculate_country_ranks(): the route's criteria —
--    onboarding_completed, not deleted, not shadow-banned, total_tokens > 0 — ordered
--    by total_tokens DESC, created_at ASC, id ASC. Everyone outside that set gets NULL
--    (064 did this for shadow bans only). Rows are written only when the value
--    changes, and one advisory lock serializes every recompute: the admin page runs
--    both functions at once, and two whole-table UPDATEs can deadlock (40P01).
-- 2) get_user_usage_totals(p_user_id): usage_stats SUM per device for the route's
--    cumulative totals and multi-device breakdown ('' device → 'legacy', as the
--    route's JS did).
-- service_role only (075 pattern — REVOKE from PUBLIC too, since anon inherits it).
-- =====================================================

CREATE OR REPLACE FUNCTION public.calculate_global_ranks()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ccgather_rank_recompute'));

  WITH ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (ORDER BY total_tokens DESC, created_at ASC, id ASC) AS new_rank
    FROM public.users
    WHERE onboarding_completed = true
      AND deleted_at IS NULL
      AND shadow_banned = false
      AND total_tokens > 0
  )
  UPDATE public.users u
  SET global_rank = r.new_rank
  FROM ranked r
  WHERE u.id = r.id
    AND u.global_rank IS DISTINCT FROM r.new_rank;

  -- Outside the ranked set: no rank, so a stale number never shadows a real one.
  UPDATE public.users u
  SET global_rank = NULL
  WHERE u.global_rank IS NOT NULL
    AND (u.onboarding_completed = true
      AND u.deleted_at IS NULL
      AND u.shadow_banned = false
      AND u.total_tokens > 0) IS NOT TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_country_ranks()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ccgather_rank_recompute'));

  WITH country_ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY country_code
        ORDER BY total_tokens DESC, created_at ASC, id ASC
      ) AS new_country_rank
    FROM public.users
    WHERE onboarding_completed = true
      AND deleted_at IS NULL
      AND shadow_banned = false
      AND total_tokens > 0
      AND country_code IS NOT NULL
  )
  UPDATE public.users u
  SET country_rank = cr.new_country_rank
  FROM country_ranked cr
  WHERE u.id = cr.id
    AND u.country_rank IS DISTINCT FROM cr.new_country_rank;

  UPDATE public.users u
  SET country_rank = NULL
  WHERE u.country_rank IS NOT NULL
    AND (u.onboarding_completed = true
      AND u.deleted_at IS NULL
      AND u.shadow_banned = false
      AND u.total_tokens > 0
      AND u.country_code IS NOT NULL) IS NOT TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_usage_totals(p_user_id uuid)
 RETURNS TABLE(device_id text, total_tokens numeric, cost_usd numeric, sessions numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT
    COALESCE(NULLIF(us.device_id, ''), 'legacy')::text,
    COALESCE(SUM(us.total_tokens), 0)::numeric,
    COALESCE(SUM(us.cost_usd), 0)::numeric,
    COALESCE(SUM(us.sessions), 0)::numeric
  FROM public.usage_stats us
  WHERE us.user_id = p_user_id
  GROUP BY 1;
$function$;

REVOKE ALL ON FUNCTION public.calculate_global_ranks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_global_ranks() TO service_role;
REVOKE ALL ON FUNCTION public.calculate_country_ranks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_country_ranks() TO service_role;
REVOKE ALL ON FUNCTION public.get_user_usage_totals(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_usage_totals(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
