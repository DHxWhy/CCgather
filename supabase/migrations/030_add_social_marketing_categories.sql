-- =====================================================
-- Add Social and Marketing Categories
-- =====================================================

-- Drop existing constraint and add new one with additional categories
ALTER TABLE tools DROP CONSTRAINT IF EXISTS tools_category_check;

ALTER TABLE tools ADD CONSTRAINT tools_category_check
  CHECK (category IN ('ai-coding', 'devops', 'productivity', 'design', 'api-data', 'open-source', 'learning', 'social', 'marketing'));
