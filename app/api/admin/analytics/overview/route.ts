/**
 * Admin Analytics Overview API
 * Returns high-level metrics: DAU, Total Events, Signups, Session Duration
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { posthogApi } from "@/lib/posthog/api-client";
import { calculateTotalWithTrend } from "@/lib/posthog/utils";
import type { AnalyticsOverviewResponse } from "@/lib/types/analytics";

export async function GET(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("date_from") || "-7d";
    const dateTo = searchParams.get("date_to") || undefined;

    // Check if PostHog is configured
    if (!posthogApi.isConfigured()) {
      return NextResponse.json(
        {
          metrics: {
            dau: { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: "neutral" },
            totalEvents: {
              value: 0,
              previousValue: 0,
              change: 0,
              changePercent: 0,
              trend: "neutral",
            },
            signups: { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: "neutral" },
            avgSessionDuration: {
              value: 0,
              previousValue: 0,
              change: 0,
              changePercent: 0,
              trend: "neutral",
            },
          },
          topEvents: [],
          dateRange: { from: dateFrom, to: dateTo },
          error: "PostHog not configured",
        },
        { status: 200 }
      );
    }

    // Fetch trends data for multiple metrics in parallel
    const [pageviewsTrends, signupsTrends, eventsTrends] = await Promise.all([
      posthogApi.getTrends(["$pageview"], {
        dateRange: { date_from: dateFrom, date_to: dateTo },
        interval: "day",
      }),
      posthogApi.getTrends(["user_signup"], {
        dateRange: { date_from: dateFrom, date_to: dateTo },
        interval: "day",
      }),
      posthogApi.getTrends(["$pageview", "user_login", "leaderboard_view", "profile_panel_open"], {
        dateRange: { date_from: dateFrom, date_to: dateTo },
        interval: "day",
      }),
    ]);

    // Calculate metrics with trends
    const dau = calculateTotalWithTrend(pageviewsTrends, 0);
    const signups = calculateTotalWithTrend(signupsTrends, 0);

    // Calculate total events across all series
    // Note: PostHog returns data as number[] and days as string[]
    let totalEventsValue = 0;
    let totalEventsPrevious = 0;
    if (eventsTrends?.results) {
      for (const series of eventsTrends.results) {
        if (series.data && Array.isArray(series.data)) {
          const midpoint = Math.floor(series.data.length / 2);
          // series.data is number[] not TrendDataPoint[]
          const current = series.data.slice(midpoint).reduce((sum, count) => sum + (count || 0), 0);
          const previous = series.data
            .slice(0, midpoint)
            .reduce((sum, count) => sum + (count || 0), 0);
          totalEventsValue += current;
          totalEventsPrevious += previous;
        }
      }
    }
    const totalEventsChange = totalEventsValue - totalEventsPrevious;
    const totalEventsChangePercent =
      totalEventsPrevious > 0
        ? (totalEventsChange / totalEventsPrevious) * 100
        : totalEventsValue > 0
          ? 100
          : 0;

    // Build top events list
    const topEvents =
      eventsTrends?.results?.map((series) => ({
        event: series.label,
        count: series.count || 0,
      })) || [];

    const response: AnalyticsOverviewResponse = {
      metrics: {
        dau,
        totalEvents: {
          value: totalEventsValue,
          previousValue: totalEventsPrevious,
          change: totalEventsChange,
          changePercent: Math.round(totalEventsChangePercent * 10) / 10,
          trend: totalEventsChange > 0 ? "up" : totalEventsChange < 0 ? "down" : "neutral",
        },
        signups,
        avgSessionDuration: {
          value: 0,
          previousValue: 0,
          change: 0,
          changePercent: 0,
          trend: "neutral",
        },
      },
      topEvents,
      dateRange: { from: dateFrom, to: dateTo },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Analytics Overview] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
