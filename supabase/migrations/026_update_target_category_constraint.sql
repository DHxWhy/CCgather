-- Update category constraint for automation_targets
-- Add new categories: press, claude_code
-- Remove unused: news, blog (replaced by press, claude_code)

-- Step 1: Drop the old constraint first
ALTER TABLE public.automation_targets
DROP CONSTRAINT IF EXISTS automation_targets_category_check;

-- Step 2: Update existing data BEFORE adding new constraint
UPDATE public.automation_targets
SET category = 'press'
WHERE category = 'news';

UPDATE public.automation_targets
SET category = 'claude_code'
WHERE category = 'blog';

UPDATE public.automation_targets
SET category = 'claude_code'
WHERE category = 'community';

-- Step 3: Add new constraint after data is updated
ALTER TABLE public.automation_targets
ADD CONSTRAINT automation_targets_category_check
CHECK (category IN ('official', 'claude_code', 'press', 'youtube'));

COMMENT ON COLUMN public.automation_targets.category IS 'Target category: official (Anthropic), claude_code (CC related), press (AI news), youtube';
