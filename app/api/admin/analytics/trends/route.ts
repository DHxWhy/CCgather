/**
 * Admin Analytics Trends API
 * Returns time-series event data for charting
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { posthogApi } from "@/lib/posthog/api-client";
import type { AnalyticsTrendsResponse } from "@/lib/types/analytics";

export async function GET(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("date_from") || "-7d";
    const dateTo = searchParams.get("date_to") || undefined;
    const interval = (searchParams.get("interval") as "hour" | "day" | "week" | "month") || "day";
    const eventsParam = searchParams.get("events");

    // Default events to track
    const events = eventsParam
      ? eventsParam.split(",")
      : ["$pageview", "user_signup", "leaderboard_view", "cli_sync_complete"];

    if (!posthogApi.isConfigured()) {
      return NextResponse.json(
        {
          results: [],
          dateRange: { from: dateFrom, to: dateTo },
          interval,
          error: "PostHog not configured",
        },
        { status: 200 }
      );
    }

    const trendsData = await posthogApi.getTrends(events, {
      dateRange: { date_from: dateFrom, date_to: dateTo },
      interval,
    });

    // Transform to response format
    // PostHog returns: { data: number[], days: string[] }
    // We need: { data: Array<{ date: string; count: number }> }
    const results =
      trendsData?.results?.map((series) => {
        // Convert PostHog format to our internal format
        const convertedData = (series.days || []).map((date: string, index: number) => ({
          date,
          count: series.data?.[index] || 0,
        }));
        return {
          label: series.label,
          data: convertedData,
          total:
            series.count ||
            series.data?.reduce((sum: number, count: number) => sum + (count || 0), 0) ||
            0,
        };
      }) || [];

    const response: AnalyticsTrendsResponse = {
      results,
      dateRange: { from: dateFrom, to: dateTo },
      interval,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Analytics Trends] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
