import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function isAdmin(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("users").select("is_admin").eq("clerk_id", userId).single();
  return data?.is_admin === true;
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await isAdmin(userId);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
