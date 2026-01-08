-- CLI Device Code Flow for OAuth-like authentication
-- This enables secure CLI authentication via browser

CREATE TABLE IF NOT EXISTS cli_device_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  device_code text NOT NULL UNIQUE,
  user_code text NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  api_token text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'expired', 'used')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '15 minutes')
);

-- Index for efficient polling
CREATE INDEX idx_cli_device_codes_device_code ON cli_device_codes(device_code);
CREATE INDEX idx_cli_device_codes_user_code ON cli_device_codes(user_code);
CREATE INDEX idx_cli_device_codes_expires_at ON cli_device_codes(expires_at);

-- RLS policies
ALTER TABLE cli_device_codes ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (API routes)
CREATE POLICY "Service role has full access to cli_device_codes"
  ON cli_device_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to clean up expired device codes (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_device_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE cli_device_codes
  SET status = 'expired'
  WHERE expires_at < now() AND status = 'pending';

  -- Delete codes older than 1 hour
  DELETE FROM cli_device_codes
  WHERE created_at < now() - interval '1 hour';
END;
$$;
