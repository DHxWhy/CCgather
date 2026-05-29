-- =====================================================
-- 063_shadow_banned_aggregates.sql
-- Exclude shadow_banned users from RANKS and COUNTRY aggregates
-- =====================================================
-- Follow-up to 062_shadow_banned.sql. The leaderboard ROW filter was applied in
-- app code, but three DB functions still counted the shadow-banned account:
--   1) calculate_global_ranks()  — global_rank column (left dprvda at #2)
--   2) calculate_country_ranks() — country_rank column
--   3) update_country_stats()    — country_stats.total_tokens (UA = 285B, real 104B)
--
-- Fix: add `AND shadow_banned = false` to each. Because shadow-banned rows are
-- now EXCLUDED from the recompute CTEs, their existing rank values are left
-- untouched — so the banned user still sees their own (stale) rank ("self looks
-- normal"), while public ranks/stats reflect only legitimate users.
--
-- Applied live via Supabase MCP (2026-05-30). This file is the record.
-- =====================================================

-- 1) Global ranks
CREATE OR REPLACE FUNCTION public.calculate_global_ranks()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY total_tokens DESC) as new_rank
    FROM public.users
    WHERE profile_visible = TRUE AND shadow_banned = false
  )
  UPDATE public.users u
  SET global_rank = r.new_rank
  FROM ranked r
  WHERE u.id = r.id;
END;
$function$;

-- 2) Country ranks
CREATE OR REPLACE FUNCTION public.calculate_country_ranks()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  WITH country_ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY country_code
        ORDER BY total_tokens DESC
      ) as new_country_rank
    FROM public.users
    WHERE profile_visible = TRUE AND country_code IS NOT NULL AND shadow_banned = false
  )
  UPDATE public.users u
  SET country_rank = cr.new_country_rank
  FROM country_ranked cr
  WHERE u.id = cr.id;
END;
$function$;

-- 3) Country stats (total_users / total_tokens / total_cost per country)
CREATE OR REPLACE FUNCTION public.update_country_stats()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.country_stats (country_code, country_name, total_users, total_tokens, total_cost, updated_at)
  SELECT
    country_code,
    country_code as country_name,
    COUNT(*) as total_users,
    COALESCE(SUM(total_tokens), 0) as total_tokens,
    COALESCE(SUM(total_cost), 0) as total_cost,
    NOW() as updated_at
  FROM public.users
  WHERE country_code IS NOT NULL AND shadow_banned = false
  GROUP BY country_code
  ON CONFLICT (country_code) DO UPDATE SET
    total_users = EXCLUDED.total_users,
    total_tokens = EXCLUDED.total_tokens,
    total_cost = EXCLUDED.total_cost,
    updated_at = NOW();

  WITH country_ranked AS (
    SELECT country_code, ROW_NUMBER() OVER (ORDER BY total_tokens DESC) as new_rank
    FROM public.country_stats
  )
  UPDATE public.country_stats cs
  SET global_rank = cr.new_rank
  FROM country_ranked cr
  WHERE cs.country_code = cr.country_code;
END;
$function$;

-- Recompute now (one-time correction of the polluted values)
SELECT public.calculate_global_ranks();
SELECT public.calculate_country_ranks();
SELECT public.update_country_stats();

NOTIFY pgrst, 'reload schema';
