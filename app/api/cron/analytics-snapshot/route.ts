import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { posthogApi } from "@/lib/posthog/api-client";

// =====================================================
// Cron Job: PostHog 지표 일별 적재 (analytics_daily)
// 실행 주기: 매일 UTC 00:20 (한국 시간 09:20)
// Vercel Cron: 20 0 * * *
// 기본 2일 재조회로 전일 실패분 자동 보완 (upsert 멱등).
// ?days=N (최대 92)으로 최초 백필 지원.
// =====================================================

const MAX_BACKFILL_DAYS = 92;

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
    console.error("[Analytics Snapshot] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const daysParam = parseInt(request.nextUrl.searchParams.get("days") || "2", 10);
  const days = Math.min(Math.max(Number.isNaN(daysParam) ? 2 : daysParam, 1), MAX_BACKFILL_DAYS);

  if (!posthogApi.isConfigured()) {
    console.warn(
      JSON.stringify({ evt: "analytics_snapshot_skip", reason: "posthog_not_configured" })
    );
    return NextResponse.json({ skipped: true, reason: "PostHog not configured" });
  }

  try {
    const [dailyRows, refRows] = await Promise.all([
      posthogApi.queryHogQL(
        `SELECT toDate(timestamp) AS d, uniq(distinct_id) AS visitors, count() AS pageviews
         FROM events
         WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${days} DAY
         GROUP BY d ORDER BY d
         LIMIT 10000`
      ),
      posthogApi.queryHogQL(
        `SELECT toDate(timestamp) AS d, coalesce(properties.$referring_domain, '$direct') AS ref, uniq(distinct_id) AS visitors
         FROM events
         WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${days} DAY
         GROUP BY d, ref ORDER BY d, visitors DESC
         LIMIT 10000`
      ),
    ]);

    const refsByDate = new Map<string, { domain: string; visitors: number }[]>();
    for (const row of refRows) {
      const [d, ref, visitors] = row as [string, string, number];
      if (!refsByDate.has(d)) refsByDate.set(d, []);
      const list = refsByDate.get(d)!;
      if (list.length < 10) {
        list.push({ domain: ref, visitors: Number(visitors) });
      }
    }

    const records = dailyRows.map((row) => {
      const [d, visitors, pageviews] = row as [string, number, number];
      return {
        date: d,
        visitors: Number(visitors),
        pageviews: Number(pageviews),
        top_referrers: refsByDate.get(d) ?? [],
        updated_at: new Date().toISOString(),
      };
    });

    if (records.length > 0) {
      const supabase = createServiceClient();
      const { error } = await (supabase as any)
        .from("analytics_daily")
        .upsert(records, { onConflict: "date" });
      if (error) {
        throw new Error(`analytics_daily upsert failed: ${error.message}`);
      }
    }

    console.log(JSON.stringify({ evt: "analytics_snapshot_ok", days, rows: records.length }));
    return NextResponse.json({ ok: true, days, rows: records.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ evt: "analytics_snapshot_fail", days, error: message }));
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
