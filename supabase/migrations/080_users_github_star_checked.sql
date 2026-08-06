-- 080: negative-cache timestamp for the CLI star-status check
-- Written when a live check answered a definitive "not starred"; verify
-- reuses it for 6h so repeat submits skip the Clerk + GitHub fan-out.
-- Service-role only (078's allowlist keeps new columns hidden from anon).

ALTER TABLE users ADD COLUMN IF NOT EXISTS github_star_checked_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
