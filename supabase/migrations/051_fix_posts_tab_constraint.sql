-- =====================================================
-- Migration: Fix posts.tab constraint
--
-- Issue: tab column has 'vibes' as default and doesn't allow 'general'
-- Solution: Change 'vibes' to 'general' in constraint and default
-- =====================================================

-- Step 1: Drop the existing CHECK constraint
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_tab_check;

-- Step 2: Update existing 'vibes' rows to 'general'
UPDATE public.posts SET tab = 'general' WHERE tab = 'vibes';

-- Step 3: Update existing 'canu' rows to 'general' (removing unused tab)
UPDATE public.posts SET tab = 'general' WHERE tab = 'canu';

-- Step 4: Add new CHECK constraint with 'general' instead of 'vibes'
ALTER TABLE public.posts
  ADD CONSTRAINT posts_tab_check
  CHECK (tab IN ('general', 'showcase', 'help'));

-- Step 5: Change default value to 'general'
ALTER TABLE public.posts ALTER COLUMN tab SET DEFAULT 'general';
