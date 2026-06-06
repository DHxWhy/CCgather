import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

// =====================================================
// GET /api/auth/recovery-check - 삭제 대기 계정 확인
// =====================================================
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    // Call the get_pending_deletion_info function
    const { data, error } = await supabase.rpc("get_pending_deletion_info", {
      p_clerk_id: userId,
    });

    if (error) {
      console.error("Recovery check error:", error);
      return NextResponse.json({ error: "Failed to check recovery status" }, { status: 500 });
    }

    // Shadow-banned account: hide recovery (permanent block — no recovery modal).
    const { data: target } = await supabase
      .from("users")
      .select("shadow_banned")
      .eq("clerk_id", userId)
      .not("deleted_at", "is", null)
      .maybeSingle();
    if (target?.shadow_banned) {
      return NextResponse.json({ pending: false, banned: true });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/auth/recovery-check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
