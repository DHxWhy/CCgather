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
