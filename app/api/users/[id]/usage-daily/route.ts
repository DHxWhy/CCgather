import { NextRequest, NextResponse } from "next/server";
import { edgeCacheHeaders, EDGE_TTL_USER_SEC, userCacheTag } from "@/lib/cache/edge-cache";
import { createClient } from "@/lib/supabase/server";
import { aggregateByDate } from "@/lib/utils/usage-aggregation";

const cacheHeaders = (userId: string) =>
  edgeCacheHeaders(EDGE_TTL_USER_SEC, [userCacheTag(userId)]);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const rpc = await supabase.rpc("get_user_daily_usage", { p_user_id: id });
  if (!rpc.error && Array.isArray(rpc.data)) {
    const daily = (
      rpc.data as Array<{ date: string; tokens: number | string; cost: number | string }>
    ).map((r) => ({
      date: String(r.date),
      tokens: Number(r.tokens) || 0,
      cost: Number(r.cost) || 0,
    }));
    return NextResponse.json({ daily }, { headers: cacheHeaders(id) });
  }

  const { data: rows, error } = await supabase
    .from("usage_stats")
    .select("date, total_tokens, cost_usd")
    .eq("user_id", id)
    .order("date", { ascending: true });

  if (error) {
    console.error("[usage-daily] fallback query error:", error);
    return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
  }

  const daily = aggregateByDate(
    rows,
    (r) => r.date,
    (r) => r.total_tokens || 0,
    (r) => r.cost_usd || 0
  );

  return NextResponse.json({ daily }, { headers: cacheHeaders(id) });
}
