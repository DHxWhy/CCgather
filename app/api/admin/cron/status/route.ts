import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAdminAccess } from "@/lib/admin";

// GET - Get current run status and logs
export async function GET(request: NextRequest) {
  try {
    if (!(await checkAdminAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: run, error } = await supabase
      .from("cron_run_history")
      .select("*")
      .eq("id", runId)
      .single();

    if (error) {
      console.error("[Cron Status] Query error:", error);
      return NextResponse.json({ error: "Failed to fetch run status" }, { status: 500 });
    }

    return NextResponse.json({
      id: run.id,
      status: run.status,
      started_at: run.started_at,
      finished_at: run.finished_at,
      duration_ms: run.duration_ms,
      items_found: run.items_found,
      items_valid: run.items_valid,
      items_saved: run.items_saved,
      items_skipped: run.items_skipped,
      log: run.log || [],
      error_message: run.error_message,
    });
  } catch (error) {
    console.error("[Cron Status] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
