/**
 * News Utilities
 * Helper functions for news-related components
 */

import type { ContentItem } from "@/types/automation";
import { CATEGORY_THUMBNAILS, CATEGORY_GRADIENTS, CATEGORY_EMOJIS } from "@/lib/constants/news";

/**
 * Normalize category key for lookup
 */
function normalizeCategoryKey(article: ContentItem): string {
  const category = article.content_type || article.category || "general";
  return category.toLowerCase().replace(/\s+/g, "-");
}

/**
 * 4-step thumbnail fallback logic
 * 1. AI generated thumbnail (ai_thumbnail)
 * 2. Admin generated thumbnail (thumbnail_source: 'gemini', 'manual', 'default')
 * 3. Category default thumbnail
 * 4. null (emoji + gradient fallback)
 *
 * Excludes OG images (thumbnail_source === 'og_image')
 */
export function getThumbnailSrc(article: ContentItem): string | null {
  // Step 1: AI generated thumbnail first
  if (article.ai_thumbnail) {
    return article.ai_thumbnail;
  }

  // Step 2: Admin/manual thumbnail (exclude OG images only)
  if (article.thumbnail_url && article.thumbnail_source !== "og_image") {
    return article.thumbnail_url;
  }

  // Step 3: Category default image
  const categoryKey = normalizeCategoryKey(article);
  if (CATEGORY_THUMBNAILS[categoryKey]) {
    return CATEGORY_THUMBNAILS[categoryKey];
  }

  // Step 4: null → emoji + gradient fallback
  return null;
}

/**
 * Get category gradient colors
 */
export function getCategoryGradient(article: ContentItem): { from: string; to: string } {
  const categoryKey = normalizeCategoryKey(article);
  return (
    CATEGORY_GRADIENTS[categoryKey] ??
    CATEGORY_GRADIENTS.general ?? { from: "#F97316", to: "#9333EA" }
  );
}

/**
 * Get category emoji
 */
export function getCategoryEmoji(article: ContentItem, titleEmoji?: string): string {
  if (titleEmoji) return titleEmoji;
  const categoryKey = normalizeCategoryKey(article);
  return CATEGORY_EMOJIS[categoryKey] ?? CATEGORY_EMOJIS.general ?? "📰";
}
