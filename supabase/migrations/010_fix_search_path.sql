-- =====================================================
-- CCGather Database Schema - Security Fix
-- Migration: 010_fix_search_path
-- Description: Add search_path to all functions for security
-- =====================================================

-- =====================================================
-- 1. Fix calculate_level function
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
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = '';

-- =====================================================
-- 2. Fix update_user_stats function
-- =====================================================
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET
    total_tokens = (
      SELECT COALESCE(SUM(total_tokens), 0)
      FROM public.usage_stats
      WHERE user_id = NEW.user_id
    ),
    total_cost = (
      SELECT COALESCE(SUM(cost_usd), 0)
      FROM public.usage_stats
      WHERE user_id = NEW.user_id
    ),
    last_submission_at = NOW(),
    primary_model = NEW.primary_model,
    primary_model_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = NEW.user_id;

  -- Calculate and update level
  UPDATE public.users
  SET current_level = public.calculate_level(total_tokens)
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- =====================================================
-- 3. Fix calculate_global_ranks function
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_global_ranks()
RETURNS VOID AS $$
BEGIN
  -- Update global ranks
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY total_tokens DESC) as new_rank
    FROM public.users
    WHERE profile_visible = TRUE
  )
  UPDATE public.users u
  SET global_rank = r.new_rank
  FROM ranked r
  WHERE u.id = r.id;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- =====================================================
-- 4. Fix calculate_country_ranks function
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
    FROM public.users
    WHERE profile_visible = TRUE AND country_code IS NOT NULL
  )
  UPDATE public.users u
  SET country_rank = cr.new_country_rank
  FROM country_ranked cr
  WHERE u.id = cr.id;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- =====================================================
-- 5. Fix update_country_stats function
-- =====================================================
CREATE OR REPLACE FUNCTION update_country_stats()
RETURNS VOID AS $$
BEGIN
  -- Upsert country stats
  INSERT INTO public.country_stats (country_code, country_name, total_users, total_tokens, total_cost, updated_at)
  SELECT
    country_code,
    country_code as country_name, -- Will be updated by application
    COUNT(*) as total_users,
    COALESCE(SUM(total_tokens), 0) as total_tokens,
    COALESCE(SUM(total_cost), 0) as total_cost,
    NOW() as updated_at
  FROM public.users
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
    FROM public.country_stats
  )
  UPDATE public.country_stats cs
  SET global_rank = cr.new_rank
  FROM country_ranked cr
  WHERE cs.country_code = cr.country_code;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- =====================================================
-- 6. Fix update_updated_at function
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- =====================================================
-- 7. Fix update_updated_at_column function
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- =====================================================
-- 8. Fix recalculate_ccplan_ranks function
-- =====================================================
CREATE OR REPLACE FUNCTION recalculate_ccplan_ranks()
RETURNS void AS $$
BEGIN
  -- Update ccplan_rank for each tier based on total_tokens
  WITH ranked AS (
    SELECT
      id,
      ccplan,
      ROW_NUMBER() OVER (
        PARTITION BY ccplan
        ORDER BY total_tokens DESC NULLS LAST
      ) as new_rank
    FROM public.users
    WHERE onboarding_completed = true
      AND ccplan IS NOT NULL
  )
  UPDATE public.users u
  SET ccplan_rank = r.new_rank
  FROM ranked r
  WHERE u.id = r.id;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- =====================================================
-- 9. Fix update_user_ccplan_rank function
-- =====================================================
CREATE OR REPLACE FUNCTION update_user_ccplan_rank(target_user_id UUID)
RETURNS void AS $$
DECLARE
  user_ccplan public.ccplan_type;
BEGIN
  -- Get user's ccplan
  SELECT ccplan INTO user_ccplan FROM public.users WHERE id = target_user_id;

  IF user_ccplan IS NULL THEN
    RETURN;
  END IF;

  -- Recalculate ranks for users in the same ccplan
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        ORDER BY total_tokens DESC NULLS LAST
      ) as new_rank
    FROM public.users
    WHERE onboarding_completed = true
      AND ccplan = user_ccplan
  )
  UPDATE public.users u
  SET ccplan_rank = r.new_rank
  FROM ranked r
  WHERE u.id = r.id;
END;
$$ LANGUAGE plpgsql
SET search_path = '';
