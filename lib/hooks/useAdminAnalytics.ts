"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  AnalyticsOverviewResponse,
  AnalyticsTrendsResponse,
  AnalyticsUsersResponse,
  AnalyticsFunnelResponse,
  AnalyticsRetentionResponse,
} from "@/lib/types/analytics";

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

// ============================================
// DB 기반 핵심 KPI (PostHog 독립)
// ============================================

interface CoreMetricWithTrend {
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "neutral";
}

interface DistributionItem {
  code?: string;
  plan?: string;
  model?: string;
  count: number;
  percentage: number;
}

interface CoreKPIResponse {
  metrics: {
    wauSubmitters: CoreMetricWithTrend;
    mauSubmitters: CoreMetricWithTrend;
    stickiness: CoreMetricWithTrend;
    totalSubmissions: CoreMetricWithTrend;
    newSignups: CoreMetricWithTrend;
    firstSubmitRate: CoreMetricWithTrend;
  };
  distributions: {
    country: DistributionItem[];
    plan: DistributionItem[];
    model: DistributionItem[];
  };
  totals: {
    activeUsers: number;
    periodDays: number;
  };
  generatedAt: string;
}

/**
 * Fetch DB-based core KPI metrics (PostHog 독립)
 */
export function useCoreKPI(options: { days?: number; enabled?: boolean } = {}) {
  const { days = 7, enabled = true } = options;

  return useQuery<CoreKPIResponse>({
    queryKey: ["analytics", "core", days],
    queryFn: () => fetchAnalytics<CoreKPIResponse>("core", { days: String(days) }),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled,
  });
}

interface RetentionCohort {
  cohortWeek: string;
  cohortSize: number;
  retentionByWeek: number[];
}

interface RetentionDBResponse {
  cohorts: RetentionCohort[];
  summary: {
    w1Retention: number;
    w4Retention: number;
    avgRetention: number;
    totalCohorts: number;
  };
  generatedAt: string;
}

/**
 * Fetch DB-based retention metrics
 */
export function useRetentionDB(options: { weeks?: number; enabled?: boolean } = {}) {
  const { weeks = 8, enabled = true } = options;

  return useQuery<RetentionDBResponse>({
    queryKey: ["analytics", "retention-db", weeks],
    queryFn: () => fetchAnalytics<RetentionDBResponse>("retention-db", { weeks: String(weeks) }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  });
}

// ============================================
// Submit Logs (제출 로그)
// ============================================

export interface SubmitLogItem {
  submitted_at: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  ccplan: string | null;
  rate_limit_tier: string | null;
  days_count: number;
  date_from: string;
  date_to: string;
  total_tokens: number;
  total_cost: number;
  submission_source: string;
  primary_model: string | null;
  // League placement audit
  league_reason: string | null;
  league_reason_details: string | null;
}

interface SubmitLogsResponse {
  logs: SubmitLogItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  filters: {
    startDate: string;
    endDate: string;
    search: string | null;
    source: string | null;
  };
  generatedAt: string;
}

interface SubmitLogsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}

// ============================================
// Traffic Sources (유입 경로 분석)
// ============================================

interface TrafficSourceMetric {
  count: number;
  percent: number;
  icon: string;
}

interface TrafficTrendItem {
  date: string;
  direct: number;
  search: number;
  social: number;
  referral: number;
}

interface TopDomainItem {
  domain: string;
  count: number;
  percent: number;
  type: "direct" | "search" | "social" | "referral";
  icon: string;
}

interface TrafficSourcesResponse {
  summary: {
    direct: TrafficSourceMetric;
    search: TrafficSourceMetric;
    social: TrafficSourceMetric;
    referral: TrafficSourceMetric;
  };
  trend: TrafficTrendItem[];
  topDomains: TopDomainItem[];
  totalVisitors: number;
  dateRange: { from: string; to: string | undefined };
  error?: string;
}

/**
 * Fetch traffic sources analytics
 */
export function useTrafficSources(options: AnalyticsQueryOptions = {}) {
  const { dateFrom = "-7d", dateTo, enabled = true } = options;

  return useQuery<TrafficSourcesResponse>({
    queryKey: ["analytics", "traffic-sources", dateFrom, dateTo],
    queryFn: () =>
      fetchAnalytics<TrafficSourcesResponse>("traffic-sources", {
        date_from: dateFrom,
        date_to: dateTo,
      }),
    staleTime: 60 * 1000, // 1 minute
    enabled,
  });
}

/**
 * Fetch submit logs (제출 1회당 1건)
 */
export function useSubmitLogs(options: SubmitLogsOptions = {}) {
  const {
    page = 1,
    pageSize = 50,
    search = "",
    source = "",
    startDate = "",
    endDate = "",
    enabled = true,
  } = options;

  return useQuery<SubmitLogsResponse>({
    queryKey: ["analytics", "submit-logs", page, pageSize, search, source, startDate, endDate],
    queryFn: () =>
      fetchAnalytics<SubmitLogsResponse>("submit-logs", {
        page: String(page),
        pageSize: String(pageSize),
        search: search || undefined,
        source: source || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    staleTime: 30 * 1000, // 30 seconds
    enabled,
  });
}
