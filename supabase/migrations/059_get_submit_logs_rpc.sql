-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 059: get_submit_logs RPC for admin submit-logs page
--
-- Purpose:
--   Replace the JS-side fallback path in
--   `app/api/admin/analytics/submit-logs/route.ts` with a server-side
--   PostgreSQL function. The fallback fetches up to 10,000 raw rows and
--   groups them in JS, which silently drops data above the limit and makes
--   per-user search totalCount inaccurate. This RPC pushes grouping,
--   filtering, and pagination into the database.
--
-- Behavior:
--   - Groups usage_stats rows by (date_trunc('minute', submitted_at), user_id)
--     so a single bulk submission appears as one row.
--   - Aggregates dates → days_count + date_from/date_to.
--   - Counts distinct device_ids (excluding 'legacy') for the multi-device
--     UI hint.
--   - Builds daily_details JSONB array sorted by date DESC.
--   - Filters by date range, source, and (optional) username substring.
--   - Returns ordered, paginated results.
--
-- Safety:
--   - Read-only function (STABLE). No data mutation.
--   - Existing JS fallback in route.ts stays in place, so applying or
--     reverting this migration does not break the admin page.
--   - search_path is locked to '' per project security policy (mig 010).
--
-- Manual application:
--   Run this in Supabase Dashboard → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_submit_logs(
  p_start_date TIMESTAMPTZ,
  p_end_date   TIMESTAMPTZ,
  p_search     TEXT,
  p_source     TEXT,
  p_limit      INTEGER,
  p_offset     INTEGER
)
RETURNS TABLE (
  submitted_at          TIMESTAMPTZ,
  user_id               UUID,
  username              TEXT,
  avatar_url            TEXT,
  ccplan                TEXT,
  rate_limit_tier       TEXT,
  days_count            INTEGER,
  date_from             DATE,
  date_to               DATE,
  total_tokens          BIGINT,
  total_cost            NUMERIC,
  submission_source     TEXT,
  primary_model         TEXT,
  league_reason         TEXT,
  league_reason_details TEXT,
  device_count          INTEGER,
  daily_details         JSONB
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH grouped AS (
    SELECT
      date_trunc('minute', us.submitted_at)                             AS submission_minute,
      us.user_id                                                        AS gid_user_id,
      MAX(us.submitted_at)                                              AS submitted_at,
      ARRAY_AGG(DISTINCT us.date ORDER BY us.date)                      AS dates,
      COUNT(DISTINCT CASE
        WHEN us.device_id IS NOT NULL AND us.device_id <> 'legacy'
        THEN us.device_id
      END)::INTEGER                                                     AS device_count,
      SUM(us.total_tokens)::BIGINT                                      AS total_tokens,
      ROUND(SUM(us.cost_usd)::numeric, 2)                               AS total_cost,
      MAX(us.submission_source)                                         AS submission_source,
      (ARRAY_AGG(us.primary_model)
        FILTER (WHERE us.primary_model IS NOT NULL))[1]                 AS primary_model,
      (ARRAY_AGG(us.league_reason)
        FILTER (WHERE us.league_reason IS NOT NULL))[1]                 AS league_reason,
      (ARRAY_AGG(us.league_reason_details)
        FILTER (WHERE us.league_reason_details IS NOT NULL))[1]         AS league_reason_details,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'date',          us.date,
          'total_tokens',  us.total_tokens,
          'cost_usd',      us.cost_usd,
          'primary_model', us.primary_model,
          'device_id',     us.device_id
        )
        ORDER BY us.date DESC
      )                                                                 AS daily_details
    FROM public.usage_stats us
    WHERE us.submitted_at >= p_start_date
      AND us.submitted_at <= p_end_date
      AND (p_source IS NULL OR p_source = '' OR us.submission_source = p_source)
    GROUP BY date_trunc('minute', us.submitted_at), us.user_id
  )
  SELECT
    g.submitted_at,
    g.gid_user_id                          AS user_id,
    u.username,
    u.avatar_url,
    u.ccplan,
    u.rate_limit_tier,
    array_length(g.dates, 1)               AS days_count,
    g.dates[1]                             AS date_from,
    g.dates[array_length(g.dates, 1)]      AS date_to,
    g.total_tokens,
    g.total_cost,
    g.submission_source,
    g.primary_model,
    g.league_reason,
    g.league_reason_details,
    g.device_count,
    g.daily_details
  FROM grouped g
  JOIN public.users u ON u.id = g.gid_user_id
  WHERE p_search IS NULL
     OR p_search = ''
     OR u.username ILIKE '%' || p_search || '%'
  ORDER BY g.submitted_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Companion count function — keeps totalCount accurate when search is applied.
-- The admin route currently runs a separate count query that ignores the
-- username filter, which makes pagination off when the operator searches.
-- This function returns the matching row count so the route can replace
-- that approximation.
CREATE OR REPLACE FUNCTION public.get_submit_logs_count(
  p_start_date TIMESTAMPTZ,
  p_end_date   TIMESTAMPTZ,
  p_search     TEXT,
  p_source     TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  WITH grouped AS (
    SELECT date_trunc('minute', us.submitted_at) AS submission_minute, us.user_id
    FROM public.usage_stats us
    WHERE us.submitted_at >= p_start_date
      AND us.submitted_at <= p_end_date
      AND (p_source IS NULL OR p_source = '' OR us.submission_source = p_source)
    GROUP BY date_trunc('minute', us.submitted_at), us.user_id
  )
  SELECT COUNT(*) INTO v_count
  FROM grouped g
  JOIN public.users u ON u.id = g.user_id
  WHERE p_search IS NULL
     OR p_search = ''
     OR u.username ILIKE '%' || p_search || '%';

  RETURN v_count;
END;
$$;

-- Refresh PostgREST schema cache so the RPCs are visible immediately.
NOTIFY pgrst, 'reload schema';
