import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAccess } from "@/lib/admin";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await checkAdminAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Mark as read instead of deleting
    const { error } = await supabase.from("admin_alerts").update({ is_read: true }).eq("id", id);

    if (error) {
      console.error("Failed to dismiss alert:", error);
      return NextResponse.json({ error: "Failed to dismiss alert" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin alert dismiss error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
