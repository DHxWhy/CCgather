import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAdminAccess } from "@/lib/admin";

interface UserRow {
  last_submission_at: string | null;
  total_tokens: number | null;
  ccplan: string | null;
}

export async function GET() {
  try {
    if (!(await checkAdminAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select(
        `
        id,
        username,
        display_name,
        avatar_url,
        email,
        country_code,
        total_tokens,
        total_cost,
        global_rank,
        created_at,
        onboarding_completed,
        last_submission_at,
        ccplan,
        ccplan_updated_at
      `
      )
      .order("created_at", { ascending: false });

    if (usersError) {
      console.error("[Admin Users] Error:", usersError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // Get per-user device count
    const { data: deviceData } = await supabase.from("usage_stats").select("user_id, device_id");

    const deviceCountMap = new Map<string, Set<string>>();
    deviceData?.forEach((d: { user_id: string; device_id: string }) => {
      if (d.device_id && d.device_id !== "legacy") {
        if (!deviceCountMap.has(d.user_id)) deviceCountMap.set(d.user_id, new Set());
        deviceCountMap.get(d.user_id)!.add(d.device_id);
      }
    });

    const usersWithDeviceCount = (users || []).map((u: { id: string }) => ({
      ...u,
      device_count: deviceCountMap.get(u.id)?.size || 0,
    }));

    // Calculate stats
    const totalUsers = users?.length || 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeToday =
      users?.filter((u: UserRow) => {
        if (!u.last_submission_at) return false;
        return new Date(u.last_submission_at) >= today;
      }).length || 0;

    const totalTokens =
      users?.reduce((sum: number, u: UserRow) => sum + (u.total_tokens || 0), 0) || 0;

    // Calculate plan distribution
    const knownPlans = ["free", "pro", "max", "team", "enterprise"];
    const planStats = {
      free: 0,
      pro: 0,
      max: 0,
      business: 0, // team + enterprise combined
      null: 0, // unset
      unknown: 0, // other values
    };

    users?.forEach((u: UserRow) => {
      const plan = u.ccplan?.toLowerCase();
      if (!plan) {
        planStats.null++;
      } else if (plan === "free") {
        planStats.free++;
      } else if (plan === "pro") {
        planStats.pro++;
      } else if (plan === "max") {
        planStats.max++;
      } else if (plan === "team" || plan === "enterprise") {
        planStats.business++;
      } else if (!knownPlans.includes(plan)) {
        planStats.unknown++;
      }
    });

    return NextResponse.json({
      users: usersWithDeviceCount,
      stats: {
        totalUsers,
        activeToday,
        totalTokens,
        planStats,
      },
    });
  } catch (error) {
    console.error("[Admin Users] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
