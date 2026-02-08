-- 054_device_aware_usage.sql
-- Multi-device support: Allow same user to submit from different devices on the same day
-- without data being overwritten. Each device's data is stored independently.

-- Step 1: Add device_id column (existing rows get 'legacy' as default)
ALTER TABLE usage_stats
ADD COLUMN IF NOT EXISTS device_id VARCHAR(16) NOT NULL DEFAULT 'legacy';

-- Step 2: Drop old unique constraint (user_id, date)
-- The constraint was created as inline UNIQUE(user_id, date) in 001_init.sql,
-- so PostgreSQL auto-named it usage_stats_user_id_date_key.
-- We use a DO block to dynamically find and drop it for robustness.
DO $$
DECLARE
  _constraint_name TEXT;
BEGIN
  SELECT c.conname INTO _constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE t.relname = 'usage_stats'
    AND n.nspname = 'public'
    AND c.contype = 'u'
    AND EXISTS (
      SELECT 1
      FROM unnest(c.conkey) WITH ORDINALITY AS cols(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = cols.attnum
      WHERE a.attname IN ('user_id', 'date')
      GROUP BY c.oid
      HAVING COUNT(*) = 2
    )
    AND (SELECT COUNT(*) FROM unnest(c.conkey)) = 2;

  IF _constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE usage_stats DROP CONSTRAINT %I', _constraint_name);
  END IF;
END
$$;

-- Step 3: Add new unique constraint (user_id, date, device_id)
ALTER TABLE usage_stats
ADD CONSTRAINT usage_stats_user_id_date_device_key UNIQUE (user_id, date, device_id);

-- Step 4: Index for efficient per-user queries (used by usage-summary, history APIs)
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_date
ON usage_stats (user_id, date);

-- Step 5: Comment for documentation
COMMENT ON COLUMN usage_stats.device_id IS 'Stable device identifier (first 16 chars of SHA256 of hostname:homedir:platform). Default "legacy" for pre-migration data.';
