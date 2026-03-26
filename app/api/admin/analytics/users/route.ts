/**
 * Admin Analytics Users API
 * Returns user metrics: DAU, WAU, MAU with country breakdown
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { posthogApi } from "@/lib/posthog/api-client";
import { calculateMetricWithTrend, calculateTotalWithTrend } from "@/lib/posthog/utils";
import { createServiceClient } from "@/lib/supabase/server";
import type { AnalyticsUsersResponse } from "@/lib/types/analytics";

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

    // Fetch unique user counts for DAU/WAU/MAU
    // Each metric uses a fixed window relative to dateTo (end of user-selected range)
    // DAU: last 2 days (for trend comparison), WAU: last 14 days, MAU: last 60 days
    const [dailyResult, weeklyResult, monthlyResult] = await Promise.allSettled([
      posthogApi.getTrends(["$pageview"], {
        dateRange: { date_from: "-2d", date_to: dateTo },
        interval: "day",
        math: "dau",
      }),
      posthogApi.getTrends(["$pageview"], {
        dateRange: { date_from: "-14d", date_to: dateTo },
        interval: "week",
        math: "weekly_active",
      }),
      posthogApi.getTrends(["$pageview"], {
        dateRange: { date_from: "-60d", date_to: dateTo },
        interval: "month",
        math: "monthly_active",
      }),
    ]);

    const dailyTrends = dailyResult.status === "fulfilled" ? dailyResult.value : null;
    const weeklyTrends = weeklyResult.status === "fulfilled" ? weeklyResult.value : null;
    const monthlyTrends = monthlyResult.status === "fulfilled" ? monthlyResult.value : null;

    if (dailyResult.status === "rejected") {
      console.warn("[Analytics Users] DAU fetch failed:", dailyResult.reason);
    }
    if (weeklyResult.status === "rejected") {
      console.warn("[Analytics Users] WAU fetch failed:", weeklyResult.reason);
    }
    if (monthlyResult.status === "rejected") {
      console.warn("[Analytics Users] MAU fetch failed:", monthlyResult.reason);
    }

    // Calculate DAU (single day value), WAU and MAU (aggregated totals)
    const dau = calculateMetricWithTrend(dailyTrends, 0);
    const wau = calculateTotalWithTrend(weeklyTrends, 0);
    const mau = calculateTotalWithTrend(monthlyTrends, 0);

    // NOTE: This queries registered users from DB, not PostHog web visitors.
    // Shows "가입 사용자 국가 분포" (registered user country distribution).
    const supabase = createServiceClient();
    const regionNames = new Intl.DisplayNames(["ko"], { type: "region" });
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

    // Convert to sorted array with resolved country names
    const byCountry = Array.from(countryCounts.entries())
      .map(([code, count]) => ({
        country: regionNames.of(code) ?? code,
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
