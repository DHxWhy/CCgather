import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// =====================================================
// Cron Job: 월간 명예의 전당 스냅샷 (전월 확정 박제)
// 실행 주기: 매월 1일 UTC 00:05 (한국 시간 09:05)
// Vercel Cron: 5 0 1 * *
// ?month=YYYY-MM-01 로 수동 재실행 가능 (멱등)
// =====================================================

export async function GET(request: NextRequest) {
  return handleSnapshot(request);
}

export async function POST(request: NextRequest) {
  return handleSnapshot(request);
}

async function handleSnapshot(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const vercelCron = request.headers.get("x-vercel-cron");
  const isAuthorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    vercelCron ||
    process.env.NODE_ENV === "development";

  if (!isAuthorized) {
    console.error("[Monthly HoF] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monthParam = request.nextUrl.searchParams.get("month");
  let targetMonth: string;
  if (monthParam && /^\d{4}-\d{2}-01$/.test(monthParam)) {
    targetMonth = monthParam;
  } else {
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    targetMonth = prev.toISOString().slice(0, 10);
  }

  const SEASON_ONE = "2026-07-01";
  if (targetMonth < SEASON_ONE) {
    console.warn(
      JSON.stringify({ evt: "monthly_hof_skip", targetMonth, reason: "before_season_one" })
    );
    return NextResponse.json({ skipped: true, targetMonth, reason: "before season 1 (2026-07)" });
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await (
      supabase as never as {
        rpc: (
          fn: string,
          args: Record<string, string>
        ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      }
    ).rpc("snapshot_monthly_hof", { target_month: targetMonth });

    if (error) {
      throw new Error(`snapshot_monthly_hof failed: ${error.message}`);
    }

    console.log(JSON.stringify({ evt: "monthly_hof_ok", targetMonth, userRows: data }));
    return NextResponse.json({ ok: true, targetMonth, userRows: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ evt: "monthly_hof_fail", targetMonth, error: message }));
    return NextResponse.json({ ok: false, targetMonth, error: message }, { status: 500 });
  }
}
