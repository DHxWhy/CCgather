import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(path.resolve(__dirname, "../../", p), "utf-8");
const squash = (s: string) => s.replace(/\s+/g, " ");

// Read inside the suite: until 082 exists, only the SQL suite fails.
let SQL = "";
const ROUTE = read("app/api/cli/submit/route.ts");

function fn(name: string): string {
  const start = SQL.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const end = SQL.indexOf("$function$;", start);
  return SQL.slice(start, end);
}

const CRITERIA =
  "onboarding_completed = true AND deleted_at IS NULL AND shadow_banned = false AND total_tokens > 0";

describe("082 rank functions use the submit route's criteria", () => {
  beforeAll(() => {
    SQL = squash(read("supabase/migrations/082_rank_and_totals_functions.sql"));
  });

  it.each(["calculate_global_ranks", "calculate_country_ranks"])("%s", (name) => {
    const body = fn(name);
    expect(body).toContain(`WHERE ${CRITERIA}`);
    expect(body).toContain("ORDER BY total_tokens DESC, created_at ASC, id ASC");
    expect(body).toContain("pg_advisory_xact_lock(hashtext('ccgather_rank_recompute'))");
    expect(body).toMatch(/IS DISTINCT FROM (r\.new_rank|cr\.new_country_rank)/);
  });

  it("clears every rank outside the ranked set, not just shadow bans", () => {
    expect(fn("calculate_global_ranks")).toContain(
      "SET global_rank = NULL WHERE u.global_rank IS NOT NULL AND (u.onboarding_completed = true AND u.deleted_at IS NULL AND u.shadow_banned = false AND u.total_tokens > 0) IS NOT TRUE"
    );
    expect(fn("calculate_country_ranks")).toContain(
      "SET country_rank = NULL WHERE u.country_rank IS NOT NULL AND (u.onboarding_completed = true AND u.deleted_at IS NULL AND u.shadow_banned = false AND u.total_tokens > 0 AND u.country_code IS NOT NULL) IS NOT TRUE"
    );
  });

  it("sums usage per device, with '' as the legacy device", () => {
    const body = fn("get_user_usage_totals");
    expect(body).toContain("COALESCE(NULLIF(us.device_id, ''), 'legacy')");
    expect(body).toContain("WHERE us.user_id = p_user_id GROUP BY 1");
  });

  it.each([
    "public.calculate_global_ranks()",
    "public.calculate_country_ranks()",
    "public.get_user_usage_totals(uuid)",
  ])("only service_role may run %s", (signature) => {
    expect(SQL).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC, anon, authenticated;`);
    expect(SQL).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`);
  });

  it("reloads the PostgREST schema cache", () => {
    expect(SQL.trimEnd().endsWith("NOTIFY pgrst, 'reload schema';")).toBe(true);
  });
});

describe("082 grants nothing beyond service_role", () => {
  beforeAll(() => {
    SQL = squash(read("supabase/migrations/082_rank_and_totals_functions.sql"));
  });

  it("grants only to service_role and defines no SECURITY DEFINER function", () => {
    const grants = SQL.match(/GRANT [^;]+;/g) ?? [];
    expect(grants).toHaveLength(3);
    for (const grant of grants) expect(grant).toMatch(/ TO service_role;$/);
    expect(SQL).not.toContain("SECURITY DEFINER");
  });
});

describe("submit route uses rank-totals (082 first, old path as fallback)", () => {
  it("sums usage through readUsageTotals and ranks through recalculateRanks", () => {
    expect(ROUTE).toContain(
      'import { readUsageTotals, recalculateRanks } from "@/lib/services/rank-totals";'
    );
    expect(ROUTE).toContain(
      "const usageTotals = await readUsageTotals(supabase, authenticatedUser.id);"
    );
    expect(ROUTE).toMatch(
      /recalculateRanks\(\s*supabase,\s*authenticatedUser,\s*usageTotals\.fromDb\s*\)/
    );
  });

  it("no longer ranks in the route itself", () => {
    expect(ROUTE).not.toContain(".update({ global_rank: index + 1 })");
    expect(ROUTE).not.toContain('rpc("calculate_global_ranks")');
    expect(ROUTE).not.toContain('rpc("get_user_usage_totals"');
  });
});
