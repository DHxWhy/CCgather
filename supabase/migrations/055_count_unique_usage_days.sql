-- =====================================================
-- 055: Count unique usage days RPC function
-- Replaces client-side SELECT + Set().size with server-side COUNT(DISTINCT)
-- =====================================================

CREATE OR REPLACE FUNCTION count_unique_usage_days(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(DISTINCT date)::INTEGER FROM usage_stats WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql STABLE;
