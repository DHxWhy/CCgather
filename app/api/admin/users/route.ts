import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

// Admin check middleware
async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;

  // In development, allow all authenticated users
  if (process.env.NODE_ENV === "development") return true;

  // TODO: Check against admin list in production
  return true;
}

export async function GET() {
  try {
    if (!(await isAdmin())) {
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
        last_submission_at
      `
      )
      .order("created_at", { ascending: false });

    if (usersError) {
      console.error("[Admin Users] Error:", usersError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // Calculate stats
    const totalUsers = users?.length || 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeToday =
      users?.filter((u) => {
        if (!u.last_submission_at) return false;
        return new Date(u.last_submission_at) >= today;
      }).length || 0;

    const totalTokens = users?.reduce((sum, u) => sum + (u.total_tokens || 0), 0) || 0;

    return NextResponse.json({
      users: users || [],
      stats: {
        totalUsers,
        activeToday,
        totalTokens,
      },
    });
  } catch (error) {
    console.error("[Admin Users] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
