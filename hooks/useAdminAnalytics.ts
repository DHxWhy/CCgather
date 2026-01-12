"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  AnalyticsOverviewResponse,
  AnalyticsTrendsResponse,
  AnalyticsUsersResponse,
  AnalyticsFunnelResponse,
  AnalyticsRetentionResponse,
  AnalyticsContentResponse,
} from "@/types/analytics";

interface AnalyticsQueryOptions {
  dateFrom?: string;
  dateTo?: string;
  interval?: "hour" | "day" | "week" | "month";
  events?: string[];
  funnel?: "signup" | "engagement";
  enabled?: boolean;
}

async function fetchAnalytics<T>(
  endpoint: string,
  params?: Record<string, string | string[] | undefined>
): Promise<T> {
  const searchParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          searchParams.set(key, value.join(","));
        } else {
          searchParams.set(key, value);
        }
      }
    });
  }

  const url = `/api/admin/analytics/${endpoint}${searchParams.toString() ? `?${searchParams}` : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch analytics");
  }

  return response.json();
}

/**
 * Fetch analytics overview metrics
 */
export function useAnalyticsOverview(options: AnalyticsQueryOptions = {}) {
  const { dateFrom = "-7d", dateTo, enabled = true } = options;

  return useQuery<AnalyticsOverviewResponse>({
    queryKey: ["analytics", "overview", dateFrom, dateTo],
    queryFn: () =>
      fetchAnalytics<AnalyticsOverviewResponse>("overview", {
        date_from: dateFrom,
        date_to: dateTo,
      }),
    staleTime: 60 * 1000, // 1 minute
    enabled,
  });
}

/**
 * Fetch analytics trends data
 */
export function useAnalyticsTrends(options: AnalyticsQueryOptions = {}) {
  const { dateFrom = "-7d", dateTo, interval = "day", events, enabled = true } = options;

  return useQuery<AnalyticsTrendsResponse>({
    queryKey: ["analytics", "trends", dateFrom, dateTo, interval, events],
    queryFn: () =>
      fetchAnalytics<AnalyticsTrendsResponse>("trends", {
        date_from: dateFrom,
        date_to: dateTo,
        interval,
        events: events?.join(","),
      }),
    staleTime: 60 * 1000,
    enabled,
  });
}

/**
 * Fetch user analytics metrics
 */
export function useAnalyticsUsers(options: AnalyticsQueryOptions = {}) {
  const { dateFrom = "-30d", dateTo, enabled = true } = options;

  return useQuery<AnalyticsUsersResponse>({
    queryKey: ["analytics", "users", dateFrom, dateTo],
    queryFn: () =>
      fetchAnalytics<AnalyticsUsersResponse>("users", {
        date_from: dateFrom,
        date_to: dateTo,
      }),
    staleTime: 60 * 1000,
    enabled,
  });
}

/**
 * Fetch funnel analytics
 */
export function useAnalyticsFunnels(options: AnalyticsQueryOptions = {}) {
  const { dateFrom = "-7d", dateTo, funnel = "signup", enabled = true } = options;

  return useQuery<AnalyticsFunnelResponse>({
    queryKey: ["analytics", "funnels", dateFrom, dateTo, funnel],
    queryFn: () =>
      fetchAnalytics<AnalyticsFunnelResponse>("funnels", {
        date_from: dateFrom,
        date_to: dateTo,
        funnel,
      }),
    staleTime: 60 * 1000,
    enabled,
  });
}

/**
 * Fetch retention analytics
 */
export function useAnalyticsRetention(options: AnalyticsQueryOptions = {}) {
  const { dateFrom = "-30d", dateTo, enabled = true } = options;

  return useQuery<AnalyticsRetentionResponse>({
    queryKey: ["analytics", "retention", dateFrom, dateTo],
    queryFn: () =>
      fetchAnalytics<AnalyticsRetentionResponse>("retention", {
        date_from: dateFrom,
        date_to: dateTo,
      }),
    staleTime: 60 * 1000,
    enabled,
  });
}

/**
 * Fetch content analytics
 */
export function useAnalyticsContent(options: AnalyticsQueryOptions = {}) {
  const { dateFrom = "-7d", dateTo, enabled = true } = options;

  return useQuery<AnalyticsContentResponse>({
    queryKey: ["analytics", "content", dateFrom, dateTo],
    queryFn: () =>
      fetchAnalytics<AnalyticsContentResponse>("content", {
        date_from: dateFrom,
        date_to: dateTo,
      }),
    staleTime: 60 * 1000,
    enabled,
  });
}

/**
 * Fetch analytics health status
 */
export function useAnalyticsHealth() {
  return useQuery<{ posthog: { status: string; latency_ms: number }; timestamp: string }>({
    queryKey: ["analytics", "health"],
    queryFn: () => fetchAnalytics("health"),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  });
}
