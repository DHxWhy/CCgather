import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { CACHE_TAG_LEADERBOARD, edgeCacheHeaders, EDGE_TTL_LIVE_SEC } from "@/lib/cache/edge-cache";

export interface WhatsNewLive {
  deployedAt: string | null;
  commit: string | null;
  ref: string | null;
  syncedLast24h: number;
}

export async function GET() {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .gte("last_submission_at", since.toISOString())
    .is("deleted_at", null)
    .eq("shadow_banned", false);

  if (error) {
    console.error("[whats-new] synced-24h count failed:", error);
  }

  const body: WhatsNewLive = {
    deployedAt: process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
    commit: process.env.NEXT_PUBLIC_BUILD_SHA ?? null,
    ref: process.env.NEXT_PUBLIC_BUILD_REF || null,
    syncedLast24h: count ?? 0,
  };

  return NextResponse.json(body, {
    headers: edgeCacheHeaders(EDGE_TTL_LIVE_SEC, [CACHE_TAG_LEADERBOARD]),
  });
}
