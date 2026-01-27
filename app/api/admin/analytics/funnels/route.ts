/**
 * Admin Analytics Funnels API
 * Returns funnel analysis: Signup funnel, Engagement funnel
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { posthogApi } from "@/lib/posthog/api-client";
import { calculateFunnelConversion, processFunnelSteps } from "@/lib/posthog/utils";
import type { AnalyticsFunnelResponse } from "@/lib/types/analytics";

// Predefined funnel configurations
const FUNNELS = {
  signup: {
    name: "Signup Funnel",
    steps: ["$pageview", "user_signup", "profile_complete"],
  },
  engagement: {
    name: "Engagement Funnel",
    steps: ["$pageview", "leaderboard_view", "profile_panel_open", "cli_install_click"],
  },
  news_to_signup: {
    name: "News → Signup Funnel",
    steps: ["news_article_view", "news_leaderboard_cta_click", "leaderboard_view", "user_signup"],
  },
};

export async function GET(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("date_from") || "-7d";
    const dateTo = searchParams.get("date_to") || undefined;
    const funnelType =
      (searchParams.get("funnel") as "signup" | "engagement" | "news_to_signup") || "signup";

    const funnelConfig = FUNNELS[funnelType] || FUNNELS.signup;

    if (!posthogApi.isConfigured()) {
      return NextResponse.json(
        {
          funnel: funnelConfig.name,
          steps: [],
          overallConversion: 0,
          dateRange: { from: dateFrom, to: dateTo },
          error: "PostHog not configured",
        },
        { status: 200 }
      );
    }

    const funnelData = await posthogApi.getFunnel(funnelConfig.steps, {
      dateRange: { date_from: dateFrom, date_to: dateTo },
    });

    // Transform funnel data
    const rawSteps =
      funnelData?.results?.map((step) => ({
        name: step.name,
        count: step.count || 0,
      })) || [];

    const steps = processFunnelSteps(rawSteps);
    const overallConversion = calculateFunnelConversion(rawSteps);

    const response: AnalyticsFunnelResponse = {
      funnel: funnelConfig.name,
      steps,
      overallConversion,
      dateRange: { from: dateFrom, to: dateTo },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Analytics Funnels] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
