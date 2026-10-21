import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAdminAccess } from "@/lib/admin";
import { planCategory } from "@/lib/services/auth-plan";

interface UserRow {
  last_submission_at: string | null;
  total_tokens: number | null;
  ccplan: string | null;
  deleted_at: string | null;
  shadow_banned: boolean | null;
}

// 관리자 표 "자동 제출" 열의 신호 3종 (마이그 081, CLI 2.3.1 부터 채워짐).
// 별도 best-effort 조회라 마이그 전 DB 에서도 목록은 깨지지 않고 전원 "미확인".
interface AutoSubmitRow {
  id: string;
  auto_sync_enabled: boolean | null;
  auto_sync_reported_at: string | null;
  last_scheduled_submit_at: string | null;
}
type AutoSubmitSignals = Omit<AutoSubmitRow, "id">;
const EMPTY_AUTO_SUBMIT: AutoSubmitSignals = {
  auto_sync_enabled: null,
  auto_sync_reported_at: null,
  last_scheduled_submit_at: null,
};

async function fetchAutoSubmitSignals(
  supabase: ReturnType<typeof createServiceClient>
): Promise<Map<string, AutoSubmitSignals>> {
  const map = new Map<string, AutoSubmitSignals>();
  const { data, error } = await supabase
    .from("users")
    .select("id, auto_sync_enabled, auto_sync_reported_at, last_scheduled_submit_at");
  if (error) {
    console.error(
      "[Admin Users] auto-submit signals unavailable (migration 081 applied?):",
      error.message
    );
    return map;
  }
  for (const row of (data ?? []) as AutoSubmitRow[]) {
    map.set(row.id, {
      auto_sync_enabled: row.auto_sync_enabled,
      auto_sync_reported_at: row.auto_sync_reported_at,
      last_scheduled_submit_at: row.last_scheduled_submit_at,
    });
  }
  return map;
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
        shadow_banned,
        onboarding_completed,
        last_submission_at,
        ccplan,
        ccplan_updated_at,
        deleted_at
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

    const autoSubmitMap = await fetchAutoSubmitSignals(supabase);

    const usersWithDeviceCount = (users || []).map((u: { id: string }) => ({
      ...u,
      ...(autoSubmitMap.get(u.id) ?? EMPTY_AUTO_SUBMIT),
      device_count: deviceCountMap.get(u.id)?.size || 0,
    }));

    // Calculate stats — exclude withdrawn (soft-deleted) AND shadow-banned (abuser)
    // users from active metrics so totals/tokens reflect only legitimate members.
    const activeUsers = (users || []).filter((u: UserRow) => !u.deleted_at && !u.shadow_banned);
    const withdrawn = (users?.length || 0) - activeUsers.length;
    const totalUsers = activeUsers.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeToday = activeUsers.filter((u: UserRow) => {
      if (!u.last_submission_at) return false;
      return new Date(u.last_submission_at) >= today;
    }).length;

    const totalTokens = activeUsers.reduce(
      (sum: number, u: UserRow) => sum + (u.total_tokens || 0),
      0
    );

    // Calculate plan distribution
    const planStats = {
      free: 0,
      pro: 0,
      max: 0,
      business: 0, // team + enterprise combined
      api: 0, // API key, Console and cloud providers
      null: 0, // unset
      unknown: 0, // other values
    };

    activeUsers.forEach((u: UserRow) => {
      if (!u.ccplan) {
        planStats.null++;
      } else {
        planStats[planCategory(u.ccplan)]++;
      }
    });

    return NextResponse.json({
      users: usersWithDeviceCount,
      stats: {
        totalUsers,
        activeToday,
        totalTokens,
        planStats,
        withdrawn,
      },
    });
  } catch (error) {
    console.error("[Admin Users] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH — shadow ban 토글 (admin 전용)
// 리더보드·통계에서 숨김/복원. 본인 데이터·화면은 보존(shadow).
// ─────────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  try {
    if (!(await checkAdminAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { userId?: unknown; shadowBanned?: unknown };
    const { userId, shadowBanned } = body;

    if (typeof userId !== "string" || typeof shadowBanned !== "boolean") {
      return NextResponse.json(
        { error: "Invalid payload: userId(string) and shadowBanned(boolean) required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { error: updateError } = await supabase
      .from("users")
      .update({ shadow_banned: shadowBanned })
      .eq("id", userId);

    if (updateError) {
      console.error("[Admin Users] shadow_banned update error:", updateError);
      return NextResponse.json({ error: "Failed to update shadow_banned" }, { status: 500 });
    }

    // 순위·국가 통계 즉시 재계산 (함수가 shadow_banned=false만 집계).
    // 리더보드 행 숨김은 쿼리 필터로 이미 즉시 반영되므로, 재계산 실패해도
    // 노출 차단은 유효 — graceful 하게 로깅만 하고 성공 응답.
    try {
      const results = await Promise.all([
        supabase.rpc("calculate_global_ranks"),
        supabase.rpc("calculate_country_ranks"),
        supabase.rpc("update_country_stats"),
      ]);
      const recalcErr = results.find((r) => r.error)?.error;
      if (recalcErr) {
        console.error("[Admin Users] rank/stats recalc partial error:", recalcErr);
      }
    } catch (recalcError) {
      console.error("[Admin Users] rank/stats recalc failed (shadow_banned applied):", recalcError);
    }

    return NextResponse.json({ success: true, userId, shadow_banned: shadowBanned });
  } catch (error) {
    console.error("[Admin Users] PATCH unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
