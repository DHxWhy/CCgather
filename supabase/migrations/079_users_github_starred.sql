-- 079: GitHub star status cache for CLI star nudge
-- Set once when the server confirms the user has starred DHxWhy/CCgather.
-- Read/written only via service_role (CLI verify route) — 078's allowlist
-- GRANT model keeps this column invisible to anon/authenticated automatically.

ALTER TABLE users ADD COLUMN IF NOT EXISTS github_starred_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
