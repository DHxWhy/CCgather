import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { CACHE_TAG_LEADERBOARD, edgeCacheHeaders, EDGE_TTL_LIVE_SEC } from "@/lib/cache/edge-cache";

export interface WhatsNewLive {
  deployedAt: string | null;
  commit: string | null;
  ref: string | null;
  syncedToday: number;
}

export async function GET() {
  const supabase = createServiceClient();
  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .gte("last_submission_at", startOfDayUtc.toISOString())
    .is("deleted_at", null)
    .eq("shadow_banned", false);

  if (error) {
    console.error("[whats-new] synced-today count failed:", error);
  }

  const body: WhatsNewLive = {
    deployedAt: process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
    commit: process.env.NEXT_PUBLIC_BUILD_SHA ?? null,
    ref: process.env.NEXT_PUBLIC_BUILD_REF || null,
    syncedToday: count ?? 0,
  };

  return NextResponse.json(body, {
    headers: edgeCacheHeaders(EDGE_TTL_LIVE_SEC, [CACHE_TAG_LEADERBOARD]),
  });
}
