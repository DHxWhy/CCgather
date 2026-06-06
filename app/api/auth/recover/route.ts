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
    // Shadow-banned account: permanent block — never recoverable (강제 탈퇴 + 재가입 차단).
    const { data: target } = await supabase
      .from("users")
      .select("shadow_banned")
      .eq("clerk_id", userId)
      .not("deleted_at", "is", null)
      .maybeSingle();
    if (target?.shadow_banned) {
      return NextResponse.json({ error: "This account cannot be recovered." }, { status: 403 });
    }

    // Call the recover_user function.
    // 라이브 시그니처는 recover_user(p_clerk_id text) — 옛 코드의 target_clerk_id 는
    // PostgREST PGRST202(함수 미발견) → 항상 500 이라 복구가 통째로 죽어 있었음.
    const { data, error } = await supabase.rpc("recover_user", {
      p_clerk_id: userId,
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
