/**
 * FULL AUDIT: run validators against EVERY user's real usage_stats data.
 * Goal: confirm 0 HARD violations across the entire live dataset (no legit
 * user would be blocked when validation goes to hard mode).
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { runAllValidations } from "../lib/services/submit-validators";

const env = fs
  .readFileSync(path.join(process.cwd(), ".env.local"), "utf-8")
  .split("\n")
  .reduce<Record<string, string>>((a, l) => {
    const m = l.match(/^([A-Z_]+)=(.+)$/);
    if (m) a[m[1]] = m[2].replace(/^["']|["']$/g, "");
    return a;
  }, {});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // All users who have any usage_stats rows
  const { data: users } = await supabase
    .from("users")
    .select("id, username, total_tokens, total_cost")
    .order("total_tokens", { ascending: false });

  if (!users) {
    console.log("no users");
    return;
  }

  let usersWithData = 0;
  let usersWithHard = 0;
  let usersWithSoft = 0;
  const hardDetails: string[] = [];
  const softSummary = new Map<string, number>();
  const flagCodeFreq = new Map<string, number>();

  for (const u of users) {
    const { data: rows } = await supabase
      .from("usage_stats")
      .select(
        "date, total_tokens, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, device_id"
      )
      .eq("user_id", u.id);

    if (!rows || rows.length === 0) continue;
    usersWithData++;

    // Simulate REAL submission: a single CLI submit comes from ONE device and
    // contains one row per date. Group by device_id so we don't synthesize
    // duplicate-date payloads that never occur in practice.
    const byDevice = new Map<string, typeof rows>();
    for (const r of rows) {
      const dev = (r.device_id as string) ?? "legacy";
      if (!byDevice.has(dev)) byDevice.set(dev, []);
      byDevice.get(dev)!.push(r);
    }

    let userHasHard = false;
    let userHasSoft = false;
    const userHardFlags: string[] = [];

    for (const [, devRows] of byDevice) {
      const payload = {
        totalTokens: Number(u.total_tokens),
        totalSpent: Number(u.total_cost),
        dailyUsage: devRows.map((r) => ({
          date: r.date,
          tokens: Number(r.total_tokens),
          cost: Number(r.cost_usd),
          inputTokens: Number(r.input_tokens),
          outputTokens: Number(r.output_tokens),
          cacheReadTokens: Number(r.cache_read_tokens),
          cacheWriteTokens: Number(r.cache_write_tokens),
        })),
      };
      const res = runAllValidations(payload, "log");
      for (const c of res.codes) flagCodeFreq.set(c, (flagCodeFreq.get(c) ?? 0) + 1);
      if (res.hardViolations.length > 0) {
        userHasHard = true;
        userHardFlags.push(...res.hardViolations.map((f) => `${f.code}: ${f.detail}`));
      }
      if (res.softViolations.length > 0) {
        userHasSoft = true;
        for (const f of res.softViolations)
          softSummary.set(f.code, (softSummary.get(f.code) ?? 0) + 1);
      }
    }

    if (userHasHard) {
      usersWithHard++;
      hardDetails.push(
        `  🔴 @${u.username} (${rows.length}d, ${Number(u.total_tokens).toLocaleString()} tok):`
      );
      for (const f of userHardFlags.slice(0, 4)) hardDetails.push(`       └ ${f}`);
    }
    if (userHasSoft) usersWithSoft++;
  }

  console.log("═".repeat(64));
  console.log(" FULL VALIDATOR AUDIT — all users with usage data");
  console.log("═".repeat(64));
  console.log(`Total users            : ${users.length}`);
  console.log(`Users with usage data  : ${usersWithData}`);
  console.log(
    `Users with HARD flags  : ${usersWithHard} ${usersWithHard === 0 ? "✅ (0 legit users blocked in hard mode)" : "🔴 REVIEW NEEDED"}`
  );
  console.log(`Users with SOFT flags  : ${usersWithSoft}`);

  if (hardDetails.length > 0) {
    console.log("\n🔴 HARD violations (would block in hard mode):");
    hardDetails.forEach((d) => console.log(d));
  }

  if (softSummary.size > 0) {
    console.log("\n⚠️  SOFT flag distribution (admin review queue, no block):");
    for (const [code, count] of [...softSummary.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${code.padEnd(30)} : ${count} users`);
    }
  }

  console.log("\nAll flag code frequency (users triggering each):");
  if (flagCodeFreq.size === 0) {
    console.log("     (none — completely clean across all users)");
  } else {
    for (const [code, count] of [...flagCodeFreq.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${code.padEnd(30)} : ${count} users`);
    }
  }
  console.log("═".repeat(64));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
