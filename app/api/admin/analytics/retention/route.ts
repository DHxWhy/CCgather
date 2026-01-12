/**
 * Admin Analytics Retention API
 * Returns cohort retention data
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { posthogApi } from "@/lib/posthog/api-client";
import type { AnalyticsRetentionResponse } from "@/types/analytics";

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
          cohorts: [],
          dateRange: { from: dateFrom, to: dateTo },
          error: "PostHog not configured",
        },
        { status: 200 }
      );
    }

    const retentionData = await posthogApi.getRetention({
      dateRange: { date_from: dateFrom, date_to: dateTo },
    });

    // Transform retention data to cohorts
    const cohorts =
      retentionData?.results?.map((row) => ({
        date: row.date,
        size: row.values?.[0] || 0,
        retention: row.values || [],
      })) || [];

    const response: AnalyticsRetentionResponse = {
      cohorts,
      dateRange: { from: dateFrom, to: dateTo },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Analytics Retention] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
