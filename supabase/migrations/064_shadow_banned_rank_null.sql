-- =====================================================
-- 064_shadow_banned_rank_null.sql
-- Shadow-banned users: rank NOT just excluded from recompute, but set to NULL
-- =====================================================
-- 063 excluded shadow_banned rows from the rank CTEs, but excluded rows kept
-- their STALE rank value (e.g. vrentati stayed global_rank=1 / country_rank=1,
-- colliding with the real #1 dprvda). This sets shadow-banned ranks to NULL so a
-- banned account contributes nothing to ranking at all.
--
-- Pairs with app fix: app/api/cli/submit/route.ts country_rank query was missing
-- the `shadow_banned = false` filter (global_rank query had it), so a submit by a
-- legit user recomputed country_rank INCLUDING the banned user — pushing dprvda to
-- UA #2. That filter is now added too.
--
-- Applied live via Supabase MCP (2026-06-07). This file is the record.
-- =====================================================

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

  -- shadow-banned: contribute nothing to ranking (NULL, not a stale value)
  UPDATE public.users SET global_rank = NULL WHERE shadow_banned = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_country_ranks()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  WITH country_ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY country_code ORDER BY total_tokens DESC) as new_country_rank
    FROM public.users
    WHERE profile_visible = TRUE AND country_code IS NOT NULL AND shadow_banned = false
  )
  UPDATE public.users u
  SET country_rank = cr.new_country_rank
  FROM country_ranked cr
  WHERE u.id = cr.id;

  UPDATE public.users SET country_rank = NULL WHERE shadow_banned = true;
END;
$function$;

-- Recompute now (one-time correction)
SELECT public.calculate_global_ranks();
SELECT public.calculate_country_ranks();

NOTIFY pgrst, 'reload schema';
