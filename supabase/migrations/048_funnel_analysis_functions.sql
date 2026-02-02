-- =====================================================
-- Funnel Analysis Functions
-- Migration: 048_funnel_analysis_functions
-- =====================================================

-- Function: Get count of activated users (2+ submissions)
CREATE OR REPLACE FUNCTION get_activated_users_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(DISTINCT user_id)
  INTO result
  FROM (
    SELECT user_id
    FROM usage_stats
    GROUP BY user_id
    HAVING COUNT(*) >= 2
  ) AS activated;

  RETURN COALESCE(result, 0);
END;
$$;

-- Function: Get time to first submit distribution
CREATE OR REPLACE FUNCTION get_time_to_first_submit_distribution()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  WITH user_first_submit AS (
    SELECT
      u.id,
      u.created_at AS signed_up_at,
      MIN(us.submitted_at) AS first_submit_at
    FROM users u
    LEFT JOIN usage_stats us ON u.id = us.user_id
    WHERE u.deleted_at IS NULL
    GROUP BY u.id, u.created_at
  ),
  time_diff AS (
    SELECT
      id,
      CASE
        WHEN first_submit_at IS NULL THEN 'never'
        WHEN EXTRACT(EPOCH FROM (first_submit_at - signed_up_at)) / 3600 <= 1 THEN 'within_1_hour'
        WHEN EXTRACT(EPOCH FROM (first_submit_at - signed_up_at)) / 3600 <= 24 THEN 'within_24_hours'
        WHEN EXTRACT(EPOCH FROM (first_submit_at - signed_up_at)) / 3600 <= 168 THEN 'within_7_days'
        ELSE 'over_7_days'
      END AS time_bucket
    FROM user_first_submit
  )
  SELECT json_build_object(
    'within_1_hour', COUNT(*) FILTER (WHERE time_bucket = 'within_1_hour'),
    'within_24_hours', COUNT(*) FILTER (WHERE time_bucket = 'within_24_hours'),
    'within_7_days', COUNT(*) FILTER (WHERE time_bucket = 'within_7_days'),
    'over_7_days', COUNT(*) FILTER (WHERE time_bucket = 'over_7_days'),
    'never', COUNT(*) FILTER (WHERE time_bucket = 'never')
  )
  INTO result
  FROM time_diff;

  RETURN result;
END;
$$;

-- Function: Get daily funnel data
CREATE OR REPLACE FUNCTION get_daily_funnel_data(days_count INTEGER DEFAULT 30)
RETURNS TABLE (
  date DATE,
  signups INTEGER,
  first_submits INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (days_count - 1),
      CURRENT_DATE,
      '1 day'::interval
    )::date AS date
  ),
  daily_signups AS (
    SELECT
      DATE(created_at) AS signup_date,
      COUNT(*) AS count
    FROM users
    WHERE deleted_at IS NULL
      AND created_at >= CURRENT_DATE - (days_count - 1)
    GROUP BY DATE(created_at)
  ),
  user_first_submits AS (
    SELECT
      u.id,
      DATE(MIN(us.submitted_at)) AS first_submit_date
    FROM users u
    JOIN usage_stats us ON u.id = us.user_id
    WHERE u.deleted_at IS NULL
      AND us.submitted_at >= CURRENT_DATE - (days_count - 1)
    GROUP BY u.id
  ),
  daily_first_submits AS (
    SELECT
      first_submit_date,
      COUNT(*) AS count
    FROM user_first_submits
    GROUP BY first_submit_date
  )
  SELECT
    ds.date,
    COALESCE(dsu.count, 0)::INTEGER AS signups,
    COALESCE(dfs.count, 0)::INTEGER AS first_submits
  FROM date_series ds
  LEFT JOIN daily_signups dsu ON ds.date = dsu.signup_date
  LEFT JOIN daily_first_submits dfs ON ds.date = dfs.first_submit_date
  ORDER BY ds.date;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_activated_users_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_time_to_first_submit_distribution() TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_funnel_data(INTEGER) TO authenticated;
