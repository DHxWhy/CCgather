import type { SupabaseClient } from "@supabase/supabase-js";

export interface UsageTotalsRow {
  total_tokens: number;
  cost_usd: number;
  sessions: number;
  device_id?: string;
}

export interface UsageTotals {
  rows: UsageTotalsRow[] | null; // null only when every read failed
  error: { message: string } | null;
  fromDb: boolean; // 082's get_user_usage_totals answered
}

/**
 * A user's usage, summed per device. 082's get_user_usage_totals sums inside the
 * database: a plain SELECT returns at most 1000 rows, which a user reaches with ~3
 * devices in a year. Without 082 it falls back to the two-query strategy: the primary
 * query includes device_id for the breakdown, the second omits it to survive a
 * missing column.
 */
export async function readUsageTotals(
  supabase: SupabaseClient,
  userId: string
): Promise<UsageTotals> {
  const totalsRpc = await supabase.rpc("get_user_usage_totals", { p_user_id: userId });
  if (!totalsRpc.error && Array.isArray(totalsRpc.data)) {
    const rows = (
      totalsRpc.data as {
        device_id: string;
        total_tokens: number | string | null;
        cost_usd: number | string | null;
        sessions: number | string | null;
      }[]
    ).map((row) => ({
      device_id: row.device_id,
      total_tokens: Number(row.total_tokens) || 0,
      cost_usd: Number(row.cost_usd) || 0,
      sessions: Number(row.sessions) || 0,
    }));
    return { rows, error: null, fromDb: true };
  }
  console.warn("[CLI Submit] totals RPC fallback:", totalsRpc.error?.message ?? "no rows array");

  const primary = await supabase
    .from("usage_stats")
    .select("total_tokens, cost_usd, sessions, device_id")
    .eq("user_id", userId);
  if (!primary.error && primary.data) {
    return { rows: primary.data as UsageTotalsRow[], error: null, fromDb: false };
  }

  console.warn(
    "[CLI Submit] Primary SUM query failed, trying fallback without device_id:",
    primary.error
  );
  const fallback = await supabase
    .from("usage_stats")
    .select("total_tokens, cost_usd, sessions")
    .eq("user_id", userId);
  if (!fallback.error && fallback.data) {
    return { rows: fallback.data as UsageTotalsRow[], error: null, fromDb: false };
  }
  return {
    rows: null,
    error: fallback.error || { message: "No data returned from fallback" },
    fromDb: false,
  };
}

export interface SubmitterRanks {
  rank: number; // 0 when the submitter is not ranked
  countryRank: number | undefined;
  fromDb: boolean;
}

/**
 * Recompute every user's global and country rank and return the submitter's.
 * With 082 (`useDbFunctions`: its get_user_usage_totals answered) one statement per
 * scope does it, on the criteria the admin page uses; the functions return nothing, so
 * the submitter's ranks are read back. Before 082 the rank functions are 064's — other
 * criteria, and they succeed — so they run only once 082 is known to be there.
 * Otherwise the JS path runs: it reads at most 1000 users and sends one UPDATE per user.
 */
export async function recalculateRanks(
  supabase: SupabaseClient,
  user: { id: string; country_code?: string | null },
  useDbFunctions: boolean
): Promise<SubmitterRanks> {
  let reason = "082 not available";
  if (useDbFunctions) {
    const globalRanks = await supabase.rpc("calculate_global_ranks");
    const countryRanks = globalRanks.error ? null : await supabase.rpc("calculate_country_ranks");
    if (!globalRanks.error && countryRanks && !countryRanks.error) {
      const { data: ranks, error: ranksError } = await supabase
        .from("users")
        .select("global_rank, country_rank")
        .eq("id", user.id)
        .single();
      if (!ranksError && ranks) {
        return {
          rank: ranks.global_rank ?? 0,
          countryRank: ranks.country_rank ?? undefined,
          fromDb: true,
        };
      }
      reason = `rank read-back failed: ${ranksError?.message ?? "no row"}`;
    } else {
      reason = globalRanks.error?.message ?? countryRanks?.error?.message ?? "rank RPC failed";
    }
  }
  console.warn("[CLI Submit] rank RPC fallback:", reason);

  let rank = 0;
  let countryRank: number | undefined;

  // FIX: Update ALL users' global_rank (not just self) to prevent rank drift
  const { data: rankData } = await supabase
    .from("users")
    .select("id")
    .eq("onboarding_completed", true)
    .is("deleted_at", null)
    .eq("shadow_banned", false)
    .gt("total_tokens", 0)
    .order("total_tokens", { ascending: false })
    .order("created_at", { ascending: true });

  if (rankData && rankData.length > 0) {
    // Update ALL users' global_rank
    const updatePromises = rankData.map((row: { id: string }, index: number) =>
      supabase
        .from("users")
        .update({ global_rank: index + 1 })
        .eq("id", row.id)
    );
    await Promise.all(updatePromises);

    // Get current user's rank
    const currentUserIndex = rankData.findIndex((row: { id: string }) => row.id === user.id);
    if (currentUserIndex >= 0) {
      rank = currentUserIndex + 1;
    }
  }

  // Get country rank for badge calculation
  // FIX: Update ALL users' country_rank in the same country (not just self)
  if (user.country_code) {
    const { data: countryRankData } = await supabase
      .from("users")
      .select("id")
      .eq("country_code", user.country_code)
      .eq("onboarding_completed", true)
      .is("deleted_at", null)
      .eq("shadow_banned", false)
      .gt("total_tokens", 0)
      .order("total_tokens", { ascending: false })
      .order("created_at", { ascending: true });

    if (countryRankData && countryRankData.length > 0) {
      // Update ALL users' country_rank in this country
      const updatePromises = countryRankData.map((row: { id: string }, index: number) =>
        supabase
          .from("users")
          .update({ country_rank: index + 1 })
          .eq("id", row.id)
      );
      await Promise.all(updatePromises);

      // Get current user's rank for badge calculation
      const currentUserIndex = countryRankData.findIndex(
        (row: { id: string }) => row.id === user.id
      );
      if (currentUserIndex >= 0) {
        countryRank = currentUserIndex + 1;
      }
    }
  }

  return { rank, countryRank, fromDb: false };
}
