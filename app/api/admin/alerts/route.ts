import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAccess } from "@/lib/admin";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    if (!(await checkAdminAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: alerts, error } = await supabase
      .from("admin_alerts")
      .select("*")
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Failed to fetch alerts:", error);
      return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
    }

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Admin alerts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
