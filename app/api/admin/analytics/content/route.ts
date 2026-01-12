/**
 * Admin Analytics Content API
 * Returns content engagement metrics: Views, Clicks, CTR by category
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { posthogApi } from "@/lib/posthog/api-client";
import { calculateTotalWithTrend } from "@/lib/posthog/utils";
import type { AnalyticsContentResponse } from "@/types/analytics";

export async function GET(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("date_from") || "-7d";
    const dateTo = searchParams.get("date_to") || undefined;

    if (!posthogApi.isConfigured()) {
      return NextResponse.json(
        {
          metrics: {
            totalViews: {
              value: 0,
              previousValue: 0,
              change: 0,
              changePercent: 0,
              trend: "neutral",
            },
            avgTime: { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: "neutral" },
            ctr: { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: "neutral" },
          },
          byCategory: [],
          topArticles: [],
          dateRange: { from: dateFrom, to: dateTo },
          error: "PostHog not configured",
        },
        { status: 200 }
      );
    }

    // Fetch content-related trends
    const [viewsTrends, clicksTrends] = await Promise.all([
      posthogApi.getTrends(["news_tab_view"], {
        dateRange: { date_from: dateFrom, date_to: dateTo },
        interval: "day",
      }),
      posthogApi.getTrends(["news_article_click"], {
        dateRange: { date_from: dateFrom, date_to: dateTo },
        interval: "day",
      }),
    ]);

    // Calculate metrics
    const totalViews = calculateTotalWithTrend(viewsTrends, 0);
    const totalClicks = calculateTotalWithTrend(clicksTrends, 0);

    // Calculate CTR
    const ctrValue = totalViews.value > 0 ? (totalClicks.value / totalViews.value) * 100 : 0;
    const ctrPrevious =
      totalViews.previousValue > 0
        ? (totalClicks.previousValue / totalViews.previousValue) * 100
        : 0;
    const ctrChange = ctrValue - ctrPrevious;

    // Get events with category breakdown
    const events = await posthogApi.getEvents(100, "news_article_click");

    // Aggregate by category
    const categoryMap = new Map<string, { views: number; clicks: number }>();
    const articleMap = new Map<
      string,
      { title: string; category: string; views: number; clicks: number }
    >();

    if (events?.results) {
      for (const event of events.results) {
        const category = String(event.properties?.category || "unknown");
        const articleId = String(event.properties?.article_id || "unknown");
        const sourceName = String(event.properties?.source_name || "Unknown");

        // Category aggregation
        const catStats = categoryMap.get(category) || { views: 0, clicks: 0 };
        catStats.clicks++;
        categoryMap.set(category, catStats);

        // Article aggregation
        const articleStats = articleMap.get(articleId) || {
          title: sourceName,
          category,
          views: 0,
          clicks: 0,
        };
        articleStats.clicks++;
        articleMap.set(articleId, articleStats);
      }
    }

    // Convert to arrays
    const byCategory = Array.from(categoryMap.entries())
      .map(([category, stats]) => ({
        category,
        views: stats.views || stats.clicks, // Use clicks as proxy for views
        clicks: stats.clicks,
        ctr: stats.views > 0 ? Math.round((stats.clicks / stats.views) * 1000) / 10 : 100,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    const topArticles = Array.from(articleMap.entries())
      .map(([id, stats]) => ({
        id,
        title: stats.title,
        category: stats.category,
        views: stats.views || stats.clicks,
        clicks: stats.clicks,
        ctr: stats.views > 0 ? Math.round((stats.clicks / stats.views) * 1000) / 10 : 100,
        avgTime: "N/A",
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    const response: AnalyticsContentResponse = {
      metrics: {
        totalViews,
        avgTime: { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: "neutral" },
        ctr: {
          value: Math.round(ctrValue * 10) / 10,
          previousValue: Math.round(ctrPrevious * 10) / 10,
          change: Math.round(ctrChange * 10) / 10,
          changePercent: ctrPrevious > 0 ? Math.round((ctrChange / ctrPrevious) * 1000) / 10 : 0,
          trend: ctrChange > 0 ? "up" : ctrChange < 0 ? "down" : "neutral",
        },
      },
      byCategory,
      topArticles,
      dateRange: { from: dateFrom, to: dateTo },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Analytics Content] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
