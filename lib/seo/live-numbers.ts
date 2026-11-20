import "server-only";
import { getGlobalStats } from "@/lib/data/global-stats";
import { createServiceClient } from "@/lib/supabase/server";
import type { LiveNumbers } from "@/lib/seo/llms";

// The same numbers the landing page shows (all-time tokens, developers, countries) and the
// 30-day total /stats shows. A number that cannot be read is left out, never sent as 0.
export async function getLiveNumbers(now: Date = new Date()): Promise<LiveNumbers> {
  const global = await getGlobalStats();

  const live: LiveNumbers = { asOf: now.toISOString().slice(0, 10) };
  if (global.showStats) {
    live.developers = global.totalUsers;
    live.countries = global.totalCountries;
    live.tokensAllTime = global.totalTokens;
  }

  if (global.activity) {
    const { tokens30d, countries30d, countries24h } = global.activity;
    if (tokens30d > 0) live.tokens30d = tokens30d;
    if (countries30d > 0) live.countries30d = countries30d;
    if (countries24h > 0) live.countries24h = countries24h;
    return live;
  }

  const summary = await (
    createServiceClient() as never as {
      rpc: (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc("get_public_stats_summary");
  if (!summary.error) {
    const row = ((summary.data as { tokens_30d?: number | string }[] | null) ?? [])[0];
    const tokens30d = Number(row?.tokens_30d ?? 0);
    if (tokens30d > 0) live.tokens30d = tokens30d;
  } else {
    console.error("[live-numbers] public stats summary failed:", summary.error.message);
  }
  return live;
}
