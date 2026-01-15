import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// =====================================================
// Cron Job: 만료된 삭제 대기 유저 완전 삭제
// 실행 주기: 매일 UTC 00:00 (한국 시간 09:00)
// Vercel Cron: 0 0 * * *
// =====================================================

// Vercel Cron requires GET method
export async function GET(request: NextRequest) {
  return handleCleanup(request);
}

// POST for manual triggers
export async function POST(request: NextRequest) {
  return handleCleanup(request);
}

async function handleCleanup(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "dev-secret";

    if (authHeader !== `Bearer ${cronSecret}`) {
      // In Vercel, cron jobs don't send auth header but have vercel-cron header
      const vercelCron = request.headers.get("x-vercel-cron");
      if (!vercelCron && process.env.NODE_ENV !== "development") {
        console.error("[Cron Cleanup] Unauthorized request");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log("[Cron Cleanup] Starting cleanup of deleted users...");

    const supabase = createServiceClient();

    // Call the cleanup_deleted_users function
    const { data, error } = await supabase.rpc("cleanup_deleted_users");

    if (error) {
      console.error("[Cron Cleanup] Error:", error);
      return NextResponse.json(
        { error: "Failed to cleanup deleted users", details: error.message },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;

    console.log("[Cron Cleanup] Completed:", {
      deleted_count: data.deleted_count,
      executed_at: data.executed_at,
      duration_ms: duration,
    });

    return NextResponse.json({
      success: true,
      deleted_count: data.deleted_count,
      executed_at: data.executed_at,
      duration_ms: duration,
    });
  } catch (error) {
    console.error("[Cron Cleanup] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
