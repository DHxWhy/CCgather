"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Newspaper } from "lucide-react";
import NewsCard from "./NewsCard";
import { NEWS_FILTER_TAGS, type NewsFilterTag } from "./news-tags";
import type { ContentItem } from "@/types/automation";

const ITEMS_PER_PAGE = 10;

// Tag mapping for API calls
const TAG_MAPPING: Record<string, string[]> = {
  claude: ["claude", "anthropic", "claude-code", "update"],
  "dev-tools": ["dev-tools"],
  industry: ["industry", "openai", "google", "meta"],
};

interface NewsInfiniteGridProps {
  initialArticles: ContentItem[];
  initialTotal: number;
  tag: NewsFilterTag;
}

export default function NewsInfiniteGrid({
  initialArticles,
  initialTotal,
  tag,
}: NewsInfiniteGridProps) {
  const [articles, setArticles] = useState<ContentItem[]>(initialArticles);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialArticles.length < initialTotal);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reset when tag changes
  useEffect(() => {
    setArticles(initialArticles);
    setTotal(initialTotal);
    setHasMore(initialArticles.length < initialTotal);
  }, [initialArticles, initialTotal, tag]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const offset = articles.length;
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        offset: String(offset),
      });

      // Add tag filter
      if (tag !== "all") {
        const targetTags = TAG_MAPPING[tag];
        if (targetTags) {
          params.set("tags", targetTags.join(","));
        }
      }

      const res = await fetch(`/api/news/contents?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      const newArticles = data.items || [];

      setArticles((prev) => [...prev, ...newArticles]);
      setTotal(data.total || total);
      setHasMore(articles.length + newArticles.length < (data.total || total));
    } catch (error) {
      console.error("Failed to load more news:", error);
    } finally {
      setIsLoading(false);
    }
  }, [articles.length, hasMore, isLoading, tag, total]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { rootMargin: "200px" } // Load 200px before reaching the end
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

  const selectedFilter = NEWS_FILTER_TAGS.find((t) => t.id === tag);

  if (articles.length === 0 && !isLoading) {
    return (
      <div
        className="text-center py-16 bg-[var(--color-bg-secondary)]/50 rounded-2xl border border-[var(--border-default)]"
        role="status"
        aria-live="polite"
      >
        <Newspaper className="w-12 h-12 mx-auto mb-4 text-text-muted" aria-hidden="true" />
        <p className="text-sm text-[var(--color-text-primary)] font-medium">
          No news in this category
        </p>
        <p className="text-xs text-text-muted mt-1">Check back soon for updates</p>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {selectedFilter && (
            <div className={`p-1.5 rounded-md ${selectedFilter.bgColor}`}>
              <selectedFilter.icon className={`w-4 h-4 ${selectedFilter.color}`} />
            </div>
          )}
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {selectedFilter?.label || "All"} News
          </span>
          <span className="text-xs text-text-muted">({total})</span>
        </div>
      </div>

      {/* News List */}
      <div className="flex flex-col gap-4">
        {articles.map((article) => (
          <NewsCard key={article.id} article={article} variant="list" />
        ))}
      </div>

      {/* Load More Trigger */}
      <div ref={loadMoreRef} className="py-8 flex justify-center">
        {isLoading && (
          <div className="flex items-center gap-2 text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading more...</span>
          </div>
        )}
        {!hasMore && articles.length > 0 && (
          <p className="text-xs text-text-muted">All {total} articles loaded</p>
        )}
      </div>
    </>
  );
}
