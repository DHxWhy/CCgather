-- Add api_key column to users table for CLI authentication
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;

-- Create index for fast API key lookups
CREATE INDEX IF NOT EXISTS idx_users_api_key ON public.users(api_key) WHERE api_key IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.users.api_key IS 'API key for CLI authentication (format: ccg_xxx)';
