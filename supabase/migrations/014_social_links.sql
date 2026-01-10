-- Add social_links column to users table
-- Stores social media links as JSONB: {"github": "username", "twitter": "handle", "linkedin": "url", "website": "url"}

ALTER TABLE users ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN users.social_links IS 'Social media links: github, twitter, linkedin, website, etc.';
