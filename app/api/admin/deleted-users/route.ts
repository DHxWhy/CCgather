import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAdminAccess } from "@/lib/admin";

export async function GET() {
  try {
    if (!(await checkAdminAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    const { data: users, error } = await supabase
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
        deleted_at,
        ccplan
      `
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (error) {
      console.error("[Admin Deleted Users] Error:", error);
      return NextResponse.json({ error: "Failed to fetch deleted users" }, { status: 500 });
    }

    return NextResponse.json({
      users: users || [],
      total: users?.length || 0,
    });
  } catch (error) {
    console.error("[Admin Deleted Users] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
