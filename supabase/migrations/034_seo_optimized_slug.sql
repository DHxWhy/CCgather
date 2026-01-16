-- SEO Optimized Slug Generation
-- Version: 034
-- Date: 2026-01-16
-- Purpose: SEO-first slug generation with 50 char limit and date-based deduplication

-- ============================================
-- 1. Create SEO-optimized slug generation function
-- ============================================

CREATE OR REPLACE FUNCTION generate_news_slug(title TEXT, content_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  slug_exists BOOLEAN;
  content_date DATE;
  date_suffix TEXT;

  -- Stopwords to remove (common English words that don't add SEO value)
  stopwords TEXT[] := ARRAY[
    -- Articles & Conjunctions
    'a', 'an', 'the', 'and', 'or', 'but', 'nor',
    -- Prepositions
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
    'into', 'onto', 'upon', 'out', 'off', 'up', 'down', 'over', 'under',
    'through', 'between', 'among', 'about', 'above', 'below', 'after',
    'before', 'during', 'against', 'within', 'without',
    -- Auxiliary verbs
    'is', 'was', 'are', 'were', 'been', 'be', 'being',
    'have', 'has', 'had', 'having',
    'do', 'does', 'did', 'doing',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
    -- Pronouns
    'it', 'its', 'this', 'that', 'these', 'those',
    'what', 'which', 'who', 'whom', 'whose',
    -- Adverbs & Others
    'how', 'when', 'where', 'why', 'then', 'now', 'here', 'there',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'not', 'only', 'same', 'so', 'than', 'too',
    'very', 'just', 'also', 'well', 'even', 'still', 'already',
    -- Common weak words
    'new', 'first', 'latest', 'announces', 'launches', 'reveals', 'introduces'
  ];

  word TEXT;
  words TEXT[];
  filtered_words TEXT[];
BEGIN
  -- Step 1: Lowercase and basic cleanup
  base_slug := lower(trim(title));

  -- Step 2: Remove special characters (keep alphanumeric, Korean, spaces, hyphens)
  base_slug := regexp_replace(base_slug, '[^a-z0-9가-힣\s-]', '', 'g');

  -- Step 3: Normalize spaces and hyphens
  base_slug := regexp_replace(base_slug, '[\s-]+', ' ', 'g');
  base_slug := trim(base_slug);

  -- Step 4: Split into words and filter stopwords
  words := string_to_array(base_slug, ' ');
  filtered_words := ARRAY[]::TEXT[];

  FOREACH word IN ARRAY words LOOP
    -- Keep word if: not null, length > 1, not a stopword
    IF word IS NOT NULL AND length(word) > 1 AND NOT (word = ANY(stopwords)) THEN
      filtered_words := array_append(filtered_words, word);
    END IF;
  END LOOP;

  -- Step 5: Join with hyphens
  base_slug := array_to_string(filtered_words, '-');

  -- Step 6: Truncate to 50 characters at word boundary
  IF length(base_slug) > 50 THEN
    base_slug := left(base_slug, 50);
    -- Remove trailing partial word (cut at last hyphen)
    IF position('-' in base_slug) > 0 THEN
      base_slug := regexp_replace(base_slug, '-[^-]*$', '');
    END IF;
  END IF;

  -- Step 7: Clean up trailing hyphens
  base_slug := regexp_replace(base_slug, '-+$', '');

  -- Step 8: Check for uniqueness
  final_slug := base_slug;

  SELECT EXISTS(
    SELECT 1 FROM public.contents
    WHERE slug = final_slug AND id != content_id
  ) INTO slug_exists;

  -- Step 9: If duplicate, add date suffix (e.g., -jan-16)
  IF slug_exists THEN
    -- Get the created_at date for this content, or use current date
    SELECT COALESCE(
      (SELECT created_at::date FROM public.contents WHERE id = content_id),
      CURRENT_DATE
    ) INTO content_date;

    date_suffix := '-' || lower(to_char(content_date, 'Mon-DD'));

    -- Ensure total length stays under 50 chars
    IF length(base_slug) + length(date_suffix) > 50 THEN
      base_slug := left(base_slug, 50 - length(date_suffix));
      base_slug := regexp_replace(base_slug, '-[^-]*$', '');
    END IF;

    final_slug := base_slug || date_suffix;

    -- If still duplicate (same title, same day), add counter
    SELECT EXISTS(
      SELECT 1 FROM public.contents
      WHERE slug = final_slug AND id != content_id
    ) INTO slug_exists;

    IF slug_exists THEN
      final_slug := final_slug || '-2';
    END IF;
  END IF;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Update trigger function (unchanged)
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
-- 3. Update existing contents with old-style slugs
-- ============================================

-- Update slugs that have UUID suffix (8 hex chars at end)
UPDATE public.contents
SET slug = generate_news_slug(title, id)
WHERE slug ~ '-[a-f0-9]{8}$';

-- Update slugs that are longer than 50 characters
UPDATE public.contents
SET slug = generate_news_slug(title, id)
WHERE length(slug) > 50;

-- ============================================
-- 4. Comments
-- ============================================

COMMENT ON FUNCTION generate_news_slug(TEXT, UUID) IS
'SEO-optimized slug generator:
- Removes 80+ stopwords for cleaner URLs
- 50 char limit (mobile-friendly)
- Date suffix for duplicates (-jan-16)
- Preserves Korean characters';
