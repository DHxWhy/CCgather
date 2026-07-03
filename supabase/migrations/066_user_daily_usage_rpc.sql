CREATE OR REPLACE FUNCTION public.get_user_daily_usage(p_user_id uuid)
RETURNS TABLE(date date, tokens bigint, cost numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT us.date,
         COALESCE(SUM(us.total_tokens), 0)::bigint AS tokens,
         COALESCE(SUM(us.cost_usd), 0)::numeric   AS cost
  FROM public.usage_stats us
  WHERE us.user_id = p_user_id
  GROUP BY us.date
  ORDER BY us.date ASC;
$$;

NOTIFY pgrst, 'reload schema';
