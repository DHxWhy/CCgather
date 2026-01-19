"use client";

import { useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";

interface ViewTrackerProps {
  slug: string;
  title: string;
  category?: string;
}

/**
 * Tracks article view count
 * - Fires once per page load
 * - Uses sessionStorage to prevent duplicate counts on refresh
 * - Sends PostHog event for funnel tracking
 */
export default function ViewTracker({ slug, title, category }: ViewTrackerProps) {
  const tracked = useRef(false);
  const posthog = usePostHog();

  useEffect(() => {
    if (tracked.current) return;

    // Check if already viewed in this session
    const viewedKey = `news_viewed_${slug}`;
    const alreadyViewed = sessionStorage.getItem(viewedKey);

    if (alreadyViewed) return;

    tracked.current = true;

    // Track view in DB
    fetch(`/api/news/${slug}/view`, {
      method: "POST",
    }).catch(() => {
      // Silently fail - view tracking is not critical
    });

    // Track view in PostHog for funnel analysis
    if (posthog) {
      posthog.capture("news_article_view", {
        article_slug: slug,
        article_title: title,
        category: category,
        referrer: document.referrer || undefined,
      });
    }

    // Mark as viewed in session
    sessionStorage.setItem(viewedKey, "1");
  }, [slug, title, category, posthog]);

  return null;
}
