"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// =====================================================
// Types
// =====================================================

interface TranslationItem {
  id: string;
  type: "post" | "comment";
  text: string;
}

interface TranslationResult {
  id: string;
  type: "post" | "comment";
  translated_text: string;
  from_cache: boolean;
}

interface TranslationState {
  translations: Map<string, string>; // key: "post:id" or "comment:id"
  isLoading: boolean;
  error: string | null;
}

// Statistics for UI display
export interface TranslationStats {
  postsCount: number;
  commentsCount: number;
  totalCount: number;
}

interface UseLazyTranslationOptions {
  enabled: boolean;
  targetLanguage: string;
  debounceMs?: number;
  /** Minimum shimmer display time for UX (ms) */
  minShimmerMs?: number;
}

// =====================================================
// useLazyTranslation Hook
// =====================================================

// =====================================================
// Constants for UX timing
// =====================================================

/** Minimum shimmer time for API calls (2 shimmer cycles at 1.5s animation = 3s) */
const DEFAULT_MIN_SHIMMER_MS = 3000;
/** Minimum shimmer time for cache hits (same as API for consistent UX) */
const CACHE_HIT_SHIMMER_MS = 3000;

export function useLazyTranslation(items: TranslationItem[], options: UseLazyTranslationOptions) {
  const {
    enabled,
    targetLanguage,
    debounceMs = 300,
    minShimmerMs = DEFAULT_MIN_SHIMMER_MS,
  } = options;

  const [state, setState] = useState<TranslationState>({
    translations: new Map(),
    isLoading: false,
    error: null,
  });

  // Track pending items to avoid duplicate requests
  const pendingItemsRef = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  // Use ref to access translations without causing dependency loop
  const translationsRef = useRef<Map<string, string>>(new Map());
  translationsRef.current = state.translations;

  // Store items in ref to access latest without dependency
  const itemsRef = useRef<TranslationItem[]>([]);
  itemsRef.current = items;

  // Create stable key from items for dependency comparison
  const itemsKey = items.map((i) => `${i.type}:${i.id}`).join(",");

  // Calculate statistics for UI display
  const stats: TranslationStats = {
    postsCount: items.filter((i) => i.type === "post").length,
    commentsCount: items.filter((i) => i.type === "comment").length,
    totalCount: items.length,
  };

  // Get translation for an item (use ref to avoid dependency loop)
  const getTranslation = useCallback(
    (id: string, type: "post" | "comment"): string | undefined => {
      return translationsRef.current.get(`${type}:${id}`);
    },
    [] // Empty deps - use ref to avoid infinite re-renders
  );

  // Check if item needs translation
  const needsTranslation = useCallback(
    (originalLanguage: string): boolean => {
      return enabled && originalLanguage !== targetLanguage;
    },
    [enabled, targetLanguage]
  );

  // Fetch translations
  const fetchTranslations = useCallback(
    async (itemsToTranslate: TranslationItem[]) => {
      if (itemsToTranslate.length === 0) return;

      // Filter out already pending or translated items (use ref to avoid dependency loop)
      const newItems = itemsToTranslate.filter((item) => {
        const key = `${item.type}:${item.id}`;
        return !translationsRef.current.has(key) && !pendingItemsRef.current.has(key);
      });

      if (newItems.length === 0) return;

      // Mark as pending
      newItems.forEach((item) => {
        pendingItemsRef.current.add(`${item.type}:${item.id}`);
      });

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Track start time for minimum shimmer duration
      const startTime = Date.now();

      try {
        const response = await fetch("/api/community/translate-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: newItems,
            targetLanguage,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("Translation failed");
        }

        const data = await response.json();
        const results: TranslationResult[] = data.translations || [];

        // Calculate if we need intentional delay for UX
        // Cache hits get shorter delay, API translations get full delay
        const allCacheHits = results.length > 0 && results.every((r) => r.from_cache);
        const targetShimmerMs = allCacheHits ? CACHE_HIT_SHIMMER_MS : minShimmerMs;

        const elapsed = Date.now() - startTime;
        const remainingDelay = targetShimmerMs - elapsed;

        // Intentional delay: ensure shimmer is visible long enough for user to perceive
        // "Oh, it's translating..." → "Wow, that was fast!" experience
        if (remainingDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingDelay));
        }

        // Update state with new translations
        setState((prev) => {
          const newTranslations = new Map(prev.translations);
          results.forEach((result) => {
            newTranslations.set(`${result.type}:${result.id}`, result.translated_text);
          });
          return {
            translations: newTranslations,
            isLoading: false,
            error: null,
          };
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Request was cancelled, ignore
          return;
        }
        console.error("[LazyTranslation] Error:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Translation failed",
        }));
      } finally {
        // Remove from pending
        newItems.forEach((item) => {
          pendingItemsRef.current.delete(`${item.type}:${item.id}`);
        });
      }
    },
    [targetLanguage, minShimmerMs]
  );

  // Debounced effect to fetch translations when items change
  useEffect(() => {
    if (!enabled || itemsRef.current.length === 0) return;

    const timeoutId = setTimeout(() => {
      fetchTranslations(itemsRef.current);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
    // Use itemsKey for stable dependency instead of items array reference
  }, [enabled, itemsKey, fetchTranslations, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    translations: state.translations,
    isLoading: state.isLoading,
    error: state.error,
    getTranslation,
    needsTranslation,
    fetchTranslations,
    stats,
  };
}

// =====================================================
// Helper: Extract translation items from posts
// =====================================================

export interface FeedPostForTranslation {
  id: string;
  content: string;
  original_language: string;
  preview_comments?: Array<{
    id: string;
    content: string;
    original_language?: string;
  }>;
  // All comments/replies for batch translation (from API)
  all_comments_for_translation?: Array<{
    id: string;
    content: string;
    original_language: string;
  }>;
}

export function extractTranslationItems(
  posts: FeedPostForTranslation[],
  targetLanguage: string
): TranslationItem[] {
  const items: TranslationItem[] = [];
  const addedIds = new Set<string>(); // Prevent duplicates

  posts.forEach((post) => {
    // Add post if needs translation
    if (post.original_language !== targetLanguage) {
      items.push({
        id: post.id,
        type: "post",
        text: post.content,
      });
      addedIds.add(`post:${post.id}`);
    }

    // Use all_comments_for_translation if available (includes all comments + replies)
    // Otherwise fallback to preview_comments for backwards compatibility
    const commentsToTranslate = post.all_comments_for_translation || post.preview_comments;

    commentsToTranslate?.forEach((comment) => {
      const commentKey = `comment:${comment.id}`;
      if (addedIds.has(commentKey)) return; // Skip duplicates

      const commentLang = comment.original_language || detectLanguage(comment.content);
      if (commentLang !== targetLanguage) {
        items.push({
          id: comment.id,
          type: "comment",
          text: comment.content,
        });
        addedIds.add(commentKey);
      }
    });
  });

  return items;
}

// Simple language detection (same as server)
function detectLanguage(text: string): string {
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return "ja";
  if (/[\u4E00-\u9FFF]/.test(text) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "zh";
  return "en";
}
