-- =====================================================
-- CCGather Database Schema - Functions & Triggers
-- Migration: 003_functions
-- =====================================================

-- =====================================================
-- Level Calculation Function
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_level(tokens BIGINT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE
    WHEN tokens >= 100000000000 THEN 10  -- 100B+ Immortal
    WHEN tokens >= 30000000000 THEN 9    -- 30B+ Titan
    WHEN tokens >= 10000000000 THEN 8    -- 10B+ Legend
    WHEN tokens >= 3000000000 THEN 7     -- 3B+ Grandmaster
    WHEN tokens >= 1000000000 THEN 6     -- 1B+ Master
    WHEN tokens >= 500000000 THEN 5      -- 500M+ Expert
    WHEN tokens >= 200000000 THEN 4      -- 200M+ Architect
    WHEN tokens >= 50000000 THEN 3       -- 50M+ Builder
    WHEN tokens >= 10000000 THEN 2       -- 10M+ Coder
    ELSE 1                                -- Rookie
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- Update User Stats Trigger Function
-- =====================================================
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET
    total_tokens = (
      SELECT COALESCE(SUM(total_tokens), 0)
      FROM usage_stats
      WHERE user_id = NEW.user_id
    ),
    total_cost = (
      SELECT COALESCE(SUM(cost_usd), 0)
      FROM usage_stats
      WHERE user_id = NEW.user_id
    ),
    last_submission_at = NOW(),
    primary_model = NEW.primary_model,
    primary_model_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = NEW.user_id;

  -- Calculate and update level
  UPDATE users
  SET current_level = calculate_level(total_tokens)
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER on_usage_insert
  AFTER INSERT OR UPDATE ON usage_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats();

-- =====================================================
-- Calculate Global Ranks Function
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_global_ranks()
RETURNS VOID AS $$
BEGIN
  -- Update global ranks
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY total_tokens DESC) as new_rank
    FROM users
    WHERE profile_visible = TRUE
  )
  UPDATE users u
  SET global_rank = r.new_rank
  FROM ranked r
  WHERE u.id = r.id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Calculate Country Ranks Function
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_country_ranks()
RETURNS VOID AS $$
BEGIN
  -- Update country ranks
  WITH country_ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY country_code
        ORDER BY total_tokens DESC
      ) as new_country_rank
    FROM users
    WHERE profile_visible = TRUE AND country_code IS NOT NULL
  )
  UPDATE users u
  SET country_rank = cr.new_country_rank
  FROM country_ranked cr
  WHERE u.id = cr.id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Update Country Stats Function
-- =====================================================
CREATE OR REPLACE FUNCTION update_country_stats()
RETURNS VOID AS $$
BEGIN
  -- Upsert country stats
  INSERT INTO country_stats (country_code, country_name, total_users, total_tokens, total_cost, updated_at)
  SELECT
    country_code,
    country_code as country_name, -- Will be updated by application
    COUNT(*) as total_users,
    COALESCE(SUM(total_tokens), 0) as total_tokens,
    COALESCE(SUM(total_cost), 0) as total_cost,
    NOW() as updated_at
  FROM users
  WHERE country_code IS NOT NULL
  GROUP BY country_code
  ON CONFLICT (country_code) DO UPDATE SET
    total_users = EXCLUDED.total_users,
    total_tokens = EXCLUDED.total_tokens,
    total_cost = EXCLUDED.total_cost,
    updated_at = NOW();

  -- Update country global ranks
  WITH country_ranked AS (
    SELECT country_code, ROW_NUMBER() OVER (ORDER BY total_tokens DESC) as new_rank
    FROM country_stats
  )
  UPDATE country_stats cs
  SET global_rank = cr.new_rank
  FROM country_ranked cr
  WHERE cs.country_code = cr.country_code;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Updated At Trigger Function
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER badge_display_updated_at
  BEFORE UPDATE ON badge_display
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
