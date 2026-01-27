/**
 * PostHog Analytics Utility Functions
 */

import type { MetricWithTrend, TrendDataPoint } from "@/lib/types/analytics";
import type { TrendsQueryResult } from "./api-client";

/**
 * Convert PostHog response format to our internal TrendDataPoint format
 * PostHog returns: { data: number[], days: string[] }
 * We need: Array<{ date: string; count: number }>
 */
export function convertToTrendDataPoints(
  series: { data: number[]; days: string[] } | undefined
): TrendDataPoint[] {
  if (!series?.data || !series?.days) {
    return [];
  }
  return series.days.map((date, index) => ({
    date,
    count: series.data[index] || 0,
  }));
}

/**
 * Calculate metric with trend from trends data
 */
export function calculateMetricWithTrend(
  trendsData: TrendsQueryResult | null,
  seriesIndex = 0
): MetricWithTrend {
  const defaultMetric: MetricWithTrend = {
    value: 0,
    previousValue: 0,
    change: 0,
    changePercent: 0,
    trend: "neutral",
  };

  const series = trendsData?.results?.[seriesIndex];
  if (!series?.data || !series?.days) {
    return defaultMetric;
  }

  const data = series.data;
  if (data.length === 0) {
    return defaultMetric;
  }

  // Get current and previous values from data array
  const current = data[data.length - 1] || 0;
  const previous = data.length > 1 ? data[data.length - 2] || 0 : 0;

  const change = current - previous;
  const changePercent = previous > 0 ? (change / previous) * 100 : current > 0 ? 100 : 0;

  return {
    value: current,
    previousValue: previous,
    change,
    changePercent: Math.round(changePercent * 10) / 10,
    trend: change > 0 ? "up" : change < 0 ? "down" : "neutral",
  };
}

/**
 * Sum all events in a trends result
 */
export function sumTrendsEvents(trendsData: TrendsQueryResult | null, seriesIndex = 0): number {
  const series = trendsData?.results?.[seriesIndex];
  if (!series?.data) {
    return 0;
  }

  // data is now number[] instead of TrendDataPoint[]
  return series.data.reduce((sum: number, count: number) => sum + (count || 0), 0);
}

/**
 * Calculate total metric with trend
 */
export function calculateTotalWithTrend(
  trendsData: TrendsQueryResult | null,
  seriesIndex = 0
): MetricWithTrend {
  const defaultMetric: MetricWithTrend = {
    value: 0,
    previousValue: 0,
    change: 0,
    changePercent: 0,
    trend: "neutral",
  };

  const series = trendsData?.results?.[seriesIndex];
  if (!series?.data) {
    return defaultMetric;
  }

  // data is now number[] instead of TrendDataPoint[]
  const data = series.data;
  const midpoint = Math.floor(data.length / 2);

  // Split data into current and previous periods
  const currentPeriod = data.slice(midpoint);
  const previousPeriod = data.slice(0, midpoint);

  const currentTotal = currentPeriod.reduce((sum, count) => sum + (count || 0), 0);
  const previousTotal = previousPeriod.reduce((sum, count) => sum + (count || 0), 0);

  const change = currentTotal - previousTotal;
  const changePercent =
    previousTotal > 0 ? (change / previousTotal) * 100 : currentTotal > 0 ? 100 : 0;

  return {
    value: currentTotal,
    previousValue: previousTotal,
    change,
    changePercent: Math.round(changePercent * 10) / 10,
    trend: change > 0 ? "up" : change < 0 ? "down" : "neutral",
  };
}

/**
 * Calculate funnel conversion rate
 */
export function calculateFunnelConversion(steps: Array<{ count: number }> | null): number {
  if (!steps?.length) return 0;

  const first = steps[0]?.count || 0;
  const last = steps[steps.length - 1]?.count || 0;

  return first > 0 ? Math.round((last / first) * 1000) / 10 : 0;
}

/**
 * Process funnel steps with dropoff calculation
 */
export function processFunnelSteps(steps: Array<{ name: string; count: number }> | null): Array<{
  name: string;
  count: number;
  percentage: number;
  dropOff: number;
  dropOffPercent: number;
}> {
  if (!steps?.length) return [];

  const firstCount = steps[0]?.count || 1;

  return steps.map((step, index) => {
    const previousCount = index > 0 ? (steps[index - 1]?.count ?? step.count) : step.count;
    const dropOff = previousCount - step.count;
    const dropOffPercent = previousCount > 0 ? (dropOff / previousCount) * 100 : 0;

    return {
      name: step.name,
      count: step.count,
      percentage: Math.round((step.count / firstCount) * 1000) / 10,
      dropOff,
      dropOffPercent: Math.round(dropOffPercent * 10) / 10,
    };
  });
}

/**
 * Group events by property
 */
export function groupEventsByProperty<T extends { properties?: Record<string, unknown> }>(
  events: T[],
  propertyKey: string
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const event of events) {
    const value = String(event.properties?.[propertyKey] || "unknown");
    const existing = grouped.get(value) || [];
    existing.push(event);
    grouped.set(value, existing);
  }

  return grouped;
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  return `${Math.round(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`;
}

/**
 * Calculate average session duration from pageview/pageleave events
 */
export function calculateAvgSessionDuration(
  events: Array<{ event: string; properties?: { duration?: number } }>
): string {
  const durations = events
    .filter((e) => e.event === "$pageleave" && e.properties?.duration)
    .map((e) => e.properties!.duration as number);

  if (durations.length === 0) return "0s";

  const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
  return formatDuration(avgMs);
}

/**
 * Get date range string for display
 */
export function getDateRangeLabel(from: string): string {
  const labels: Record<string, string> = {
    "-1d": "어제",
    "-7d": "지난 7일",
    "-14d": "지난 14일",
    "-30d": "지난 30일",
    "-90d": "지난 90일",
  };

  return labels[from] || from;
}
