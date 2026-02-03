import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAdminAccess } from "@/lib/admin";

export async function GET() {
  try {
    if (!(await checkAdminAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Parallel queries for efficiency
    const [feedbackResult, usersResult, submitsResult] = await Promise.all([
      // New feedback count (status = 'new')
      supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "new"),

      // New users in last 24 hours
      supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .gte("created_at", yesterday.toISOString()),

      // New submissions in last 24 hours (unique by submitted_at minute + user_id)
      supabase
        .from("usage_stats")
        .select("submitted_at, user_id")
        .gte("submitted_at", yesterday.toISOString())
        .order("submitted_at", { ascending: false }),
    ]);

    // Count unique submissions (grouped by user_id + minute)
    const uniqueSubmits = new Set<string>();
    if (submitsResult.data) {
      submitsResult.data.forEach((row: { submitted_at: string; user_id: string }) => {
        const date = new Date(row.submitted_at);
        date.setSeconds(0, 0);
        uniqueSubmits.add(`${date.toISOString()}_${row.user_id}`);
      });
    }

    return NextResponse.json({
      newFeedback: feedbackResult.count || 0,
      newUsers: usersResult.count || 0,
      newSubmits: uniqueSubmits.size,
    });
  } catch (error) {
    console.error("[Admin Notifications] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
