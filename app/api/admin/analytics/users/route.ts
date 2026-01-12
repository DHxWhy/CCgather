/**
 * Admin Analytics Users API
 * Returns user metrics: DAU, WAU, MAU with country breakdown
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { posthogApi } from "@/lib/posthog/api-client";
import { calculateTotalWithTrend } from "@/lib/posthog/utils";
import { createServiceClient } from "@/lib/supabase/server";
import type { AnalyticsUsersResponse } from "@/types/analytics";

export async function GET(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("date_from") || "-30d";
    const dateTo = searchParams.get("date_to") || undefined;

    if (!posthogApi.isConfigured()) {
      return NextResponse.json(
        {
          metrics: {
            dau: { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: "neutral" },
            wau: { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: "neutral" },
            mau: { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: "neutral" },
          },
          byCountry: [],
          dateRange: { from: dateFrom, to: dateTo },
          error: "PostHog not configured",
        },
        { status: 200 }
      );
    }

    // Fetch user activity trends for different periods
    const [dailyTrends, weeklyTrends, monthlyTrends] = await Promise.all([
      posthogApi.getTrends(["$pageview"], {
        dateRange: { date_from: "-1d" },
        interval: "hour",
      }),
      posthogApi.getTrends(["$pageview"], {
        dateRange: { date_from: "-7d" },
        interval: "day",
      }),
      posthogApi.getTrends(["$pageview"], {
        dateRange: { date_from: "-30d" },
        interval: "day",
      }),
    ]);

    // Calculate DAU, WAU, MAU
    const dau = calculateTotalWithTrend(dailyTrends, 0);
    const wau = calculateTotalWithTrend(weeklyTrends, 0);
    const mau = calculateTotalWithTrend(monthlyTrends, 0);

    // Get country breakdown from our database
    const supabase = createServiceClient();
    const { data: countryData } = await supabase
      .from("users")
      .select("country_code")
      .not("country_code", "is", null);

    // Count users by country
    const countryCounts = new Map<string, number>();
    let totalUsers = 0;

    if (countryData) {
      for (const user of countryData) {
        if (user.country_code) {
          const count = countryCounts.get(user.country_code) || 0;
          countryCounts.set(user.country_code, count + 1);
          totalUsers++;
        }
      }
    }

    // Convert to sorted array
    const byCountry = Array.from(countryCounts.entries())
      .map(([code, count]) => ({
        country: code,
        countryCode: code,
        users: count,
        percentage: totalUsers > 0 ? Math.round((count / totalUsers) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 10); // Top 10 countries

    const response: AnalyticsUsersResponse = {
      metrics: {
        dau,
        wau,
        mau,
      },
      byCountry,
      dateRange: { from: dateFrom, to: dateTo },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Analytics Users] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
