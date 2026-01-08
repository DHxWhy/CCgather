-- Enable RLS on admin_alerts table
ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;

-- Set super_admin for specific email
UPDATE users
SET is_admin = TRUE
WHERE email = 'black7177@gmail.com';

-- Policy: Only super_admin (black7177@gmail.com) can view admin_alerts
CREATE POLICY "Super admin can view admin_alerts"
  ON admin_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.clerk_id = auth.uid()::text
      AND users.email = 'black7177@gmail.com'
      AND users.is_admin = TRUE
    )
  );

-- Policy: Only super_admin can insert admin_alerts
CREATE POLICY "Super admin can insert admin_alerts"
  ON admin_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.clerk_id = auth.uid()::text
      AND users.email = 'black7177@gmail.com'
      AND users.is_admin = TRUE
    )
  );

-- Policy: Only super_admin can update admin_alerts
CREATE POLICY "Super admin can update admin_alerts"
  ON admin_alerts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.clerk_id = auth.uid()::text
      AND users.email = 'black7177@gmail.com'
      AND users.is_admin = TRUE
    )
  );

-- Policy: Only super_admin can delete admin_alerts
CREATE POLICY "Super admin can delete admin_alerts"
  ON admin_alerts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.clerk_id = auth.uid()::text
      AND users.email = 'black7177@gmail.com'
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
