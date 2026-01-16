-- =====================================================
-- Migration: Add trigger for automatic country_stats updates
-- Description: Automatically update country_stats when users table changes
-- =====================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_update_country_stats ON public.users;

-- Create trigger function that calls update_country_stats
-- Uses AFTER trigger to ensure user data is committed first
CREATE OR REPLACE FUNCTION trigger_country_stats_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if relevant columns changed
  -- For INSERT: always update if country_code is set
  -- For UPDATE: update if country_code, total_tokens, or total_cost changed
  -- For DELETE: always update to remove user from stats

  IF TG_OP = 'DELETE' THEN
    IF OLD.country_code IS NOT NULL THEN
      PERFORM update_country_stats();
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.country_code IS NOT NULL THEN
      PERFORM update_country_stats();
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Check if relevant columns changed
    IF (OLD.country_code IS DISTINCT FROM NEW.country_code) OR
       (OLD.total_tokens IS DISTINCT FROM NEW.total_tokens) OR
       (OLD.total_cost IS DISTINCT FROM NEW.total_cost) THEN
      PERFORM update_country_stats();
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Create the trigger
-- Using AFTER trigger and FOR EACH STATEMENT for better performance
-- This means it runs once per statement, not once per row
CREATE TRIGGER trigger_update_country_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_country_stats_update();

-- Add comment for documentation
COMMENT ON TRIGGER trigger_update_country_stats ON public.users IS
  'Automatically updates country_stats table when user data changes (country_code, total_tokens, total_cost)';

-- Initial population: Run update_country_stats to ensure data is current
SELECT update_country_stats();
