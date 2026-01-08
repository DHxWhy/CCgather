-- Enable RLS on admin_alerts table
ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view admin_alerts
CREATE POLICY "Admins can view admin_alerts"
  ON admin_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.clerk_id = auth.uid()::text
      AND users.is_admin = TRUE
    )
  );

-- Policy: Only admins can insert admin_alerts
CREATE POLICY "Admins can insert admin_alerts"
  ON admin_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.clerk_id = auth.uid()::text
      AND users.is_admin = TRUE
    )
  );

-- Policy: Only admins can update admin_alerts
CREATE POLICY "Admins can update admin_alerts"
  ON admin_alerts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.clerk_id = auth.uid()::text
      AND users.is_admin = TRUE
    )
  );

-- Policy: Service role can do everything (for server-side operations)
CREATE POLICY "Service role has full access to admin_alerts"
  ON admin_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
