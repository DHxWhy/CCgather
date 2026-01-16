-- Improve Slug Generation for SEO
-- Version: 031
-- Date: 2026-01-16
-- Purpose: SEO-optimized slug generation with stopword removal and length limit

-- ============================================
-- 1. Create improved slug generation function
-- ============================================

CREATE OR REPLACE FUNCTION generate_news_slug(title TEXT, content_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  slug_exists BOOLEAN;
  counter INTEGER := 1;
  -- Common stopwords to remove (English)
  stopwords TEXT[] := ARRAY[
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'it', 'its', 'this', 'that', 'these', 'those', 'what', 'which', 'who',
    'whom', 'how', 'when', 'where', 'why', 'all', 'each', 'every', 'both',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'into',
    'over', 'after', 'before', 'between', 'under', 'again', 'further',
    'then', 'once', 'here', 'there', 'about', 'above', 'below', 'up',
    'down', 'out', 'off', 'through', 'during', 'against', 'while',
    'form', 'forms', 'group', 'groups', 'scale', 'new', 'now', 'also'
  ];
  word TEXT;
  words TEXT[];
  filtered_words TEXT[];
BEGIN
  -- Step 1: Lowercase and basic cleanup
  base_slug := lower(title);

  -- Step 2: Remove special characters except alphanumeric, Korean, spaces, hyphens
  base_slug := regexp_replace(base_slug, '[^a-z0-9가-힣\s-]', '', 'g');

  -- Step 3: Replace multiple spaces/hyphens with single space
  base_slug := regexp_replace(base_slug, '[\s-]+', ' ', 'g');
  base_slug := trim(base_slug);

  -- Step 4: Split into words and filter stopwords
  words := string_to_array(base_slug, ' ');
  filtered_words := ARRAY[]::TEXT[];

  FOREACH word IN ARRAY words LOOP
    -- Keep word if it's not a stopword and has length > 1
    IF word IS NOT NULL AND length(word) > 1 AND NOT (word = ANY(stopwords)) THEN
      filtered_words := array_append(filtered_words, word);
    END IF;
  END LOOP;

  -- Step 5: Join with hyphens
  base_slug := array_to_string(filtered_words, '-');

  -- Step 6: Truncate to 60 characters at word boundary
  IF length(base_slug) > 60 THEN
    base_slug := left(base_slug, 60);
    -- Remove trailing partial word (cut at last hyphen)
    IF position('-' in base_slug) > 0 THEN
      base_slug := regexp_replace(base_slug, '-[^-]*$', '');
    END IF;
  END IF;

  -- Step 7: Remove trailing hyphens
  base_slug := regexp_replace(base_slug, '-+$', '');

  -- Step 8: Check for uniqueness and add counter if needed
  final_slug := base_slug;

  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.contents
      WHERE slug = final_slug AND id != content_id
    ) INTO slug_exists;

    EXIT WHEN NOT slug_exists;

    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Update trigger function (unchanged logic)
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if slug is not provided and title exists
  IF NEW.slug IS NULL AND NEW.title IS NOT NULL THEN
    NEW.slug := generate_news_slug(NEW.title, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Comments
-- ============================================

COMMENT ON FUNCTION generate_news_slug(TEXT, UUID) IS
'SEO-optimized slug generator: removes stopwords, limits to 60 chars, ensures uniqueness';
