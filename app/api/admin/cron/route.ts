import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { CronConfig } from "@/types/automation";

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (process.env.NODE_ENV === "development") return true;
  return true;
}

// GET - Get cron job status and history
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId") || "news-collector";
    const includeHistory = searchParams.get("history") === "true";
    const historyLimit = parseInt(searchParams.get("limit") || "10", 10);

    const supabase = createServiceClient();

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from("cron_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError) {
      console.error("[Admin Cron] Job query error:", jobError);
      return NextResponse.json({ error: "Failed to fetch cron job" }, { status: 500 });
    }

    let history = null;
    if (includeHistory) {
      const { data: historyData } = await supabase
        .from("cron_run_history")
        .select("*")
        .eq("job_id", jobId)
        .order("started_at", { ascending: false })
        .limit(historyLimit);

      history = historyData;
    }

    return NextResponse.json({
      job,
      history,
    });
  } catch (error) {
    console.error("[Admin Cron] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH - Update cron job settings
export async function PATCH(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const jobId = body.jobId || "news-collector";

    const supabase = createServiceClient();

    const updates: Record<string, unknown> = {};

    // Toggle enabled
    if (body.is_enabled !== undefined) {
      updates.is_enabled = body.is_enabled;
    }

    // Update schedule
    if (body.schedule) {
      // Validate cron expression format (basic check)
      const cronParts = body.schedule.trim().split(/\s+/);
      if (cronParts.length !== 5) {
        return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });
      }
      updates.schedule = body.schedule.trim();
    }

    // Update config
    if (body.config) {
      // Get current config first
      const { data: currentJob } = await supabase
        .from("cron_jobs")
        .select("config")
        .eq("id", jobId)
        .single();

      const currentConfig = (currentJob?.config as CronConfig) || {};
      updates.config = {
        ...currentConfig,
        ...body.config,
      };
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: job, error } = await supabase
      .from("cron_jobs")
      .update(updates)
      .eq("id", jobId)
      .select()
      .single();

    if (error) {
      console.error("[Admin Cron] Update error:", error);
      return NextResponse.json({ error: "Failed to update cron job" }, { status: 500 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error("[Admin Cron] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Trigger manual run
export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const jobId = body.jobId || "news-collector";

    const supabase = createServiceClient();

    // Check if already running
    const { data: job } = await supabase
      .from("cron_jobs")
      .select("is_running")
      .eq("id", jobId)
      .single();

    if (job?.is_running) {
      return NextResponse.json({ error: "Job is already running" }, { status: 409 });
    }

    // Create history entry
    const { data: runHistory, error: historyError } = await supabase
      .from("cron_run_history")
      .insert({
        job_id: jobId,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (historyError) {
      console.error("[Admin Cron] History insert error:", historyError);
      return NextResponse.json({ error: "Failed to start job" }, { status: 500 });
    }

    // Mark job as running
    await supabase.from("cron_jobs").update({ is_running: true }).eq("id", jobId);

    // Trigger the actual cron endpoint based on jobId
    const cronEndpoints: Record<string, string> = {
      "news-collector": "/api/cron/collect-news",
      "changelog-sync": "/api/cron/collect-changelog",
    };
    const cronPath = cronEndpoints[jobId] || "/api/cron/collect-news";
    const cronUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}${cronPath}`;
    const cronSecret = process.env.CRON_SECRET || "dev-secret";

    // Fire and forget - the cron endpoint handles the actual work
    fetch(cronUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        run_id: runHistory.id,
        manual: true,
      }),
    }).catch((err) => {
      console.error("[Admin Cron] Failed to trigger cron:", err);
    });

    return NextResponse.json({
      success: true,
      run_id: runHistory.id,
      message: "Cron job triggered",
    });
  } catch (error) {
    console.error("[Admin Cron] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
