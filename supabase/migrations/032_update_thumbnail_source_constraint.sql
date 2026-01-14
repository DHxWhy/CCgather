-- Update thumbnail_source check constraint to include new model types
-- Adds 'imagen' and 'gemini_flash' as valid thumbnail sources

-- Drop the existing constraint
ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_thumbnail_source_check;

-- Add updated constraint with new values
ALTER TABLE contents ADD CONSTRAINT contents_thumbnail_source_check
  CHECK (thumbnail_source IN ('gemini', 'imagen', 'gemini_flash', 'og_image', 'manual', 'default'));

-- Update any existing 'gemini' sources to 'imagen' for clarity (optional - keeping backward compatibility)
-- Keeping 'gemini' as valid for backward compatibility with existing data
