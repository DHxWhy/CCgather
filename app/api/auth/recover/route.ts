import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

// =====================================================
// POST /api/auth/recover - 계정 복구
// =====================================================
export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    // Call the recover_user function
    const { data, error } = await supabase.rpc("recover_user", {
      target_clerk_id: userId,
    });

    if (error) {
      console.error("Recover user error:", error);
      return NextResponse.json({ error: "Failed to recover account" }, { status: 500 });
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "계정이 복구되었습니다!",
    });
  } catch (error) {
    console.error("POST /api/auth/recover error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
