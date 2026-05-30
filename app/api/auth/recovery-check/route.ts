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

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/auth/recovery-check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
