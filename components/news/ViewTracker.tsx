"use client";

import { useEffect, useRef } from "react";

interface ViewTrackerProps {
  slug: string;
}

/**
 * Tracks article view count
 * - Fires once per page load
 * - Uses sessionStorage to prevent duplicate counts on refresh
 */
export default function ViewTracker({ slug }: ViewTrackerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;

    // Check if already viewed in this session
    const viewedKey = `news_viewed_${slug}`;
    const alreadyViewed = sessionStorage.getItem(viewedKey);

    if (alreadyViewed) return;

    tracked.current = true;

    // Track view
    fetch(`/api/news/${slug}/view`, {
      method: "POST",
    }).catch(() => {
      // Silently fail - view tracking is not critical
    });

    // Mark as viewed in session
    sessionStorage.setItem(viewedKey, "1");
  }, [slug]);

  return null;
}
