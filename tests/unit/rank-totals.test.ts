import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readUsageTotals, recalculateRanks } from "@/lib/services/rank-totals";

type Result = { data?: unknown; error: { message: string } | null };

interface Query {
  table: string;
  select?: string;
  filters: [op: string, column: string, value: unknown][];
  update?: Record<string, unknown>;
  single: boolean;
}

interface FakeBuilder extends PromiseLike<Result> {
  select(cols: string): FakeBuilder;
  eq(col: string, value: unknown): FakeBuilder;
  is(col: string, value: unknown): FakeBuilder;
  gt(col: string, value: unknown): FakeBuilder;
  order(col: string, options?: unknown): FakeBuilder;
  update(values: Record<string, unknown>): FakeBuilder;
  single(): FakeBuilder;
}

// PostgREST builders are PromiseLike (then only), so the fake is too.
function settle<T>(value: T): PromiseLike<T> {
  return {
    then<R1 = T, R2 = never>(
      onfulfilled?: ((v: T) => R1 | PromiseLike<R1>) | null,
      onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
    ): PromiseLike<R1 | R2> {
      return Promise.resolve(value).then(onfulfilled, onrejected);
    },
  };
}

interface FakeOptions {
  rpc?: Record<string, Result>;
  usageReads?: Result[];
  rankedUsers?: { id: string }[];
  countryUsers?: { id: string }[];
  readBack?: Result;
}

function fakeClient(opts: FakeOptions) {
  const rpcCalls: string[] = [];
  const queries: Query[] = [];
  const usageReads = [...(opts.usageReads ?? [])];

  const resolve = (q: Query): Result => {
    if (q.update) return { error: null };
    if (q.table === "usage_stats") {
      return usageReads.shift() ?? { data: null, error: { message: "unexpected usage read" } };
    }
    if (q.table === "users" && q.single) {
      return opts.readBack ?? { data: null, error: { message: "unexpected read-back" } };
    }
    if (q.table === "users" && q.select === "id") {
      const byCountry = q.filters.some(([op, col]) => op === "eq" && col === "country_code");
      return {
        data: byCountry ? (opts.countryUsers ?? []) : (opts.rankedUsers ?? []),
        error: null,
      };
    }
    return { data: null, error: { message: `unexpected query on ${q.table}` } };
  };

  const builder = (q: Query): FakeBuilder => {
    const b: FakeBuilder = {
      select(cols) {
        q.select = cols;
        return b;
      },
      eq(col, value) {
        q.filters.push(["eq", col, value]);
        return b;
      },
      is(col, value) {
        q.filters.push(["is", col, value]);
        return b;
      },
      gt(col, value) {
        q.filters.push(["gt", col, value]);
        return b;
      },
      order(col, options) {
        q.filters.push(["order", col, options]);
        return b;
      },
      update(values) {
        q.update = values;
        return b;
      },
      single() {
        q.single = true;
        return b;
      },
      then(onfulfilled, onrejected) {
        return settle(resolve(q)).then(onfulfilled, onrejected);
      },
    };
    return b;
  };

  const client = {
    rpc: vi.fn((name: string, _args?: Record<string, unknown>) => {
      rpcCalls.push(name);
      return settle(opts.rpc?.[name] ?? { data: null, error: { message: `no ${name}` } });
    }),
    from: vi.fn((table: string) => {
      const q: Query = { table, filters: [], single: false };
      queries.push(q);
      return builder(q);
    }),
  };
  const updates = () =>
    queries
      .filter((q) => q.update)
      .map((q) => ({ ...q.update, id: q.filters.find(([, col]) => col === "id")?.[2] }));
  return { client: client as unknown as SupabaseClient, rpcCalls, queries, updates };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readUsageTotals", () => {
  it("uses 082's per-device sums and never reads usage rows", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fake = fakeClient({
      rpc: {
        get_user_usage_totals: {
          data: [
            { device_id: "laptop", total_tokens: "300", cost_usd: "1.5", sessions: "2" },
            { device_id: "legacy", total_tokens: 100, cost_usd: 0.5, sessions: null },
          ],
          error: null,
        },
      },
    });

    const totals = await readUsageTotals(fake.client, "me");

    expect(totals).toEqual({
      rows: [
        { device_id: "laptop", total_tokens: 300, cost_usd: 1.5, sessions: 2 },
        { device_id: "legacy", total_tokens: 100, cost_usd: 0.5, sessions: 0 },
      ],
      error: null,
      fromDb: true,
    });
    expect(fake.client.rpc).toHaveBeenCalledWith("get_user_usage_totals", { p_user_id: "me" });
    expect(fake.queries).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to the usage rows, with a fixed log line, when 082 is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const row = { total_tokens: 5, cost_usd: 1, sessions: 1, device_id: "laptop" };
    const fake = fakeClient({
      rpc: { get_user_usage_totals: { data: null, error: { message: "Could not find" } } },
      usageReads: [{ data: [row], error: null }],
    });

    const totals = await readUsageTotals(fake.client, "me");

    expect(totals).toEqual({ rows: [row], error: null, fromDb: false });
    expect(warn).toHaveBeenCalledWith("[CLI Submit] totals RPC fallback:", "Could not find");
    expect(fake.queries[0]?.select).toBe("total_tokens, cost_usd, sessions, device_id");
    expect(fake.queries[0]?.filters).toEqual([["eq", "user_id", "me"]]);
  });

  it("drops device_id when the primary read fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const row = { total_tokens: 5, cost_usd: 1, sessions: 1 };
    const fake = fakeClient({
      usageReads: [
        { data: null, error: { message: "column device_id does not exist" } },
        { data: [row], error: null },
      ],
    });

    const totals = await readUsageTotals(fake.client, "me");

    expect(totals).toEqual({ rows: [row], error: null, fromDb: false });
    expect(fake.queries[1]?.select).toBe("total_tokens, cost_usd, sessions");
    expect(fake.queries[1]?.filters).toEqual([["eq", "user_id", "me"]]);
  });

  it("warns when the fallback read comes back at the 1000-row cap", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = Array.from({ length: 1000 }, () => ({
      total_tokens: 1,
      cost_usd: 0,
      sessions: 0,
      device_id: "laptop",
    }));
    const fake = fakeClient({ usageReads: [{ data: rows, error: null }] });

    await readUsageTotals(fake.client, "me");

    expect(warn).toHaveBeenCalledWith(
      "[CLI Submit] usage fallback read hit the 1000-row cap; totals may be short for user",
      "me"
    );
  });

  it("warns at the cap on the second fallback read too, and not one row below it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const page = (length: number) =>
      Array.from({ length }, () => ({ total_tokens: 1, cost_usd: 0, sessions: 0 }));
    const second = fakeClient({
      usageReads: [
        { data: null, error: { message: "no device_id" } },
        { data: page(1000), error: null },
      ],
    });
    await readUsageTotals(second.client, "me");
    expect(warn).toHaveBeenCalledWith(
      "[CLI Submit] usage fallback read hit the 1000-row cap; totals may be short for user",
      "me"
    );

    warn.mockClear();
    const below = fakeClient({ usageReads: [{ data: page(999), error: null }] });
    await readUsageTotals(below.client, "me");
    expect(warn).not.toHaveBeenCalledWith(
      "[CLI Submit] usage fallback read hit the 1000-row cap; totals may be short for user",
      "me"
    );
  });

  it("reports an error, not zero totals, when every read fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fake = fakeClient({
      usageReads: [
        { data: null, error: { message: "down" } },
        { data: null, error: { message: "still down" } },
      ],
    });

    const totals = await readUsageTotals(fake.client, "me");

    expect(totals).toEqual({ rows: null, error: { message: "still down" }, fromDb: false });
  });
});

describe("recalculateRanks", () => {
  const ok = { data: null, error: null };

  it("ranks in the database and reads the submitter's ranks back", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fake = fakeClient({
      rpc: { calculate_global_ranks: ok, calculate_country_ranks: ok },
      readBack: { data: { global_rank: 7, country_rank: 2 }, error: null },
    });

    const ranks = await recalculateRanks(fake.client, { id: "me", country_code: "KR" }, true);

    expect(ranks).toEqual({ rank: 7, countryRank: 2, fromDb: true });
    expect(fake.rpcCalls).toEqual(["calculate_global_ranks", "calculate_country_ranks"]);
    const readBack = fake.queries.find((q) => q.single);
    expect(readBack?.select).toBe("global_rank, country_rank");
    expect(readBack?.filters).toEqual([["eq", "id", "me"]]);
    expect(fake.updates()).toEqual([]);
    expect(fake.queries.filter((q) => q.select === "id")).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it("reads an unranked submitter back as 0 and no country rank", async () => {
    const fake = fakeClient({
      rpc: { calculate_global_ranks: ok, calculate_country_ranks: ok },
      readBack: { data: { global_rank: null, country_rank: null }, error: null },
    });

    const ranks = await recalculateRanks(fake.client, { id: "me" }, true);

    expect(ranks).toEqual({ rank: 0, countryRank: undefined, fromDb: true });
  });

  it("never calls the rank functions before 082 is known to be there", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fake = fakeClient({
      rankedUsers: [{ id: "u1" }, { id: "me" }, { id: "u3" }],
      countryUsers: [{ id: "me" }],
    });

    const ranks = await recalculateRanks(fake.client, { id: "me", country_code: "KR" }, false);

    expect(fake.rpcCalls).toEqual([]);
    expect(ranks).toEqual({ rank: 2, countryRank: 1, fromDb: false });
    expect(fake.updates()).toEqual([
      { global_rank: 1, id: "u1" },
      { global_rank: 2, id: "me" },
      { global_rank: 3, id: "u3" },
      { country_rank: 1, id: "me" },
    ]);
    expect(warn).toHaveBeenCalledWith("[CLI Submit] rank RPC fallback:", "082 not available");
    const criteria = [
      ["eq", "onboarding_completed", true],
      ["is", "deleted_at", null],
      ["eq", "shadow_banned", false],
      ["gt", "total_tokens", 0],
      ["order", "total_tokens", { ascending: false }],
      ["order", "created_at", { ascending: true }],
    ];
    const reads = fake.queries.filter((q) => q.select === "id");
    expect(reads.map((q) => q.filters)).toEqual([
      criteria,
      [["eq", "country_code", "KR"], ...criteria],
    ]);
  });

  it("falls back when only the country function fails, instead of reading a stale country rank", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fake = fakeClient({
      rpc: {
        calculate_global_ranks: ok,
        calculate_country_ranks: { data: null, error: { message: "lock" } },
      },
      readBack: { data: { global_rank: 7, country_rank: 99 }, error: null },
      rankedUsers: [{ id: "u1" }, { id: "me" }],
      countryUsers: [{ id: "me" }],
    });

    const ranks = await recalculateRanks(fake.client, { id: "me", country_code: "KR" }, true);

    expect(fake.rpcCalls).toEqual(["calculate_global_ranks", "calculate_country_ranks"]);
    expect(fake.queries.some((q) => q.single)).toBe(false);
    expect(ranks).toEqual({ rank: 2, countryRank: 1, fromDb: false });
    expect(warn).toHaveBeenCalledWith("[CLI Submit] rank RPC fallback:", "lock");
  });

  it("falls back with the RPC error when a rank function fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fake = fakeClient({
      rpc: { calculate_global_ranks: { data: null, error: { message: "boom" } } },
      rankedUsers: [{ id: "me" }],
    });

    const ranks = await recalculateRanks(fake.client, { id: "me" }, true);

    expect(fake.rpcCalls).toEqual(["calculate_global_ranks"]);
    expect(ranks).toEqual({ rank: 1, countryRank: undefined, fromDb: false });
    expect(warn).toHaveBeenCalledWith("[CLI Submit] rank RPC fallback:", "boom");
  });

  it("falls back with the read-back error when the ranks cannot be read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fake = fakeClient({
      rpc: { calculate_global_ranks: ok, calculate_country_ranks: ok },
      readBack: { data: null, error: { message: "timeout" } },
      rankedUsers: [{ id: "u1" }, { id: "me" }],
    });

    const ranks = await recalculateRanks(fake.client, { id: "me" }, true);

    expect(ranks).toEqual({ rank: 2, countryRank: undefined, fromDb: false });
    expect(warn).toHaveBeenCalledWith(
      "[CLI Submit] rank RPC fallback:",
      "rank read-back failed: timeout"
    );
  });

  it("skips the country ranking for a submitter without a country", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fake = fakeClient({ rankedUsers: [{ id: "me" }], countryUsers: [{ id: "me" }] });

    const ranks = await recalculateRanks(fake.client, { id: "me" }, false);

    expect(ranks.countryRank).toBeUndefined();
    expect(fake.queries.some((q) => q.filters.some(([, col]) => col === "country_code"))).toBe(
      false
    );
  });
});
