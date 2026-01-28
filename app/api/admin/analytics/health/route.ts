/**
 * Admin Analytics Health Check API
 * Returns PostHog connection status and latency
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { posthogApi } from "@/lib/posthog/api-client";

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const health = await posthogApi.healthCheck();

    return NextResponse.json({
      posthog: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Analytics Health] Error:", error);
    return NextResponse.json(
      {
        posthog: {
          status: "error",
          latency_ms: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
