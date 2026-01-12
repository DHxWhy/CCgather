"use client";

import { usePostHog } from "posthog-js/react";
import { useCallback } from "react";
import type { AnalyticsEventName, AnalyticsEventProperties } from "@/types/analytics";

/**
 * Custom hook for PostHog analytics event tracking
 */
export function useAnalytics() {
  const posthog = usePostHog();

  /**
   * Track a custom event with type-safe properties
   */
  const track = useCallback(
    <T extends AnalyticsEventName>(
      eventName: T,
      properties?: T extends keyof AnalyticsEventProperties
        ? AnalyticsEventProperties[T]
        : Record<string, unknown>
    ) => {
      if (!posthog) {
        if (process.env.NODE_ENV === "development") {
          console.log("[Analytics] Event (no client):", eventName, properties);
        }
        return;
      }

      posthog.capture(eventName, properties);

      if (process.env.NODE_ENV === "development") {
        console.log("[Analytics] Event:", eventName, properties);
      }
    },
    [posthog]
  );

  /**
   * Identify a user with additional properties
   */
  const identify = useCallback(
    (
      userId: string,
      properties?: {
        email?: string;
        username?: string;
        country?: string;
        plan?: string;
        [key: string]: unknown;
      }
    ) => {
      if (!posthog) return;
      posthog.identify(userId, properties);
    },
    [posthog]
  );

  /**
   * Reset user identity (on logout)
   */
  const reset = useCallback(() => {
    if (!posthog) return;
    posthog.reset();
  }, [posthog]);

  /**
   * Set user properties without identifying
   */
  const setUserProperties = useCallback(
    (properties: Record<string, unknown>) => {
      if (!posthog) return;
      posthog.setPersonProperties(properties);
    },
    [posthog]
  );

  /**
   * Track page view manually
   */
  const trackPageView = useCallback(
    (url?: string) => {
      if (!posthog) return;
      posthog.capture("$pageview", {
        $current_url: url || window.location.href,
      });
    },
    [posthog]
  );

  /**
   * Check if a feature flag is enabled
   */
  const isFeatureEnabled = useCallback(
    (flagName: string): boolean => {
      if (!posthog) return false;
      return posthog.isFeatureEnabled(flagName) ?? false;
    },
    [posthog]
  );

  return {
    track,
    identify,
    reset,
    setUserProperties,
    trackPageView,
    isFeatureEnabled,
    posthog,
  };
}

/**
 * Pre-built event tracking functions for common actions
 */
export const analyticsEvents = {
  // User Events
  trackSignup: (method: "clerk" | "google" | "github", country?: string) => ({
    name: "user_signup" as const,
    properties: { method, country },
  }),

  trackLogin: (method: "clerk" | "google" | "github") => ({
    name: "user_login" as const,
    properties: { method },
  }),

  trackProfileComplete: (country: string, plan?: string) => ({
    name: "profile_complete" as const,
    properties: { country, plan },
  }),

  // CLI Events
  trackCliInstallClick: (source: "leaderboard" | "profile" | "onboarding" | "hero") => ({
    name: "cli_install_click" as const,
    properties: { source },
  }),

  trackCliSync: (tokens: number, cost: number) => ({
    name: "cli_sync_complete" as const,
    properties: { tokens, cost },
  }),

  // Leaderboard Events
  trackLeaderboardView: (period: string, countryFilter?: string) => ({
    name: "leaderboard_view" as const,
    properties: { period, country_filter: countryFilter },
  }),

  trackLeaderboardFilter: (filterType: "period" | "country", value: string) => ({
    name: "leaderboard_filter" as const,
    properties: { filter_type: filterType, value },
  }),

  trackMyRankView: (rank: number | null) => ({
    name: "my_rank_view" as const,
    properties: { rank },
  }),

  // Profile Events
  trackProfilePanelOpen: (userId: string, username: string) => ({
    name: "profile_panel_open" as const,
    properties: { target_user_id: userId, target_username: username },
  }),

  // News Events
  trackNewsArticleClick: (articleId: string, category: string, sourceName: string) => ({
    name: "news_article_click" as const,
    properties: { article_id: articleId, category, source_name: sourceName },
  }),

  trackNewsCategoryFilter: (category: string) => ({
    name: "news_category_filter" as const,
    properties: { category },
  }),

  // Engagement Events
  trackCtaClick: (ctaName: string, location: string) => ({
    name: "cta_click" as const,
    properties: { cta_name: ctaName, location },
  }),
};
