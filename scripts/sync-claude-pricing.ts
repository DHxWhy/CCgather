// Refreshes lib/constants/claude-pricing.json from the official pricing page.
// Run by .github/workflows/pricing-sync.yml; safe to run locally:
//   bun scripts/sync-claude-pricing.ts
// Writes `status=unchanged|updated|blocked` (+ report file) to $GITHUB_OUTPUT.
// Exits non-zero only when the official page itself cannot be fetched.

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import {
  checkSnapshot,
  diffPricing,
  OFFICIAL_PRICING_MD_URL,
  parseOfficialPricing,
  type PricingSnapshot,
  type PricingTable,
} from "../lib/services/official-pricing";

const SNAPSHOT_PATH = "lib/constants/claude-pricing.json";
const REPORT_PATH = process.env.PRICING_REPORT_PATH ?? "/tmp/pricing-report.md";
const LITELLM_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const TIMEOUT_MS = 20_000;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

// LiteLLM is only a cross-check; its absence must not block the official update.
async function fetchLiteLLM(ids: string[]): Promise<PricingTable | null> {
  try {
    const raw = JSON.parse(await fetchText(LITELLM_URL)) as Record<string, Record<string, number>>;
    const out: PricingTable = {};
    for (const id of ids) {
      const v = raw[id];
      if (!v?.input_cost_per_token || !v.output_cost_per_token) continue;
      const perM = (perToken: number) => Math.round(perToken * 1e9) / 1e3;
      const input = perM(v.input_cost_per_token);
      out[id] = {
        input,
        output: perM(v.output_cost_per_token),
        cacheWrite: v.cache_creation_input_token_cost
          ? perM(v.cache_creation_input_token_cost)
          : input * 1.25,
        cacheRead: v.cache_read_input_token_cost
          ? perM(v.cache_read_input_token_cost)
          : input * 0.1,
      };
    }
    return out;
  } catch (err) {
    console.warn(`LiteLLM cross-check skipped: ${String(err)}`);
    return null;
  }
}

function setOutput(key: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${key}=${value}\n`);
}

const prev = (JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as PricingSnapshot).models;
const next = parseOfficialPricing(await fetchText(OFFICIAL_PRICING_MD_URL));
const diff = diffPricing(prev, next);

if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
  console.log(`unchanged (${Object.keys(next).length} models)`);
  setOutput("status", "unchanged");
  process.exit(0);
}

const check = checkSnapshot(prev, next, await fetchLiteLLM(Object.keys(next)));
const lines = [
  ...diff.added.map((id) => `- 추가: \`${id}\` ${JSON.stringify(next[id])}`),
  ...diff.removed.map((id) => `- 제거: \`${id}\``),
  ...diff.changed.map((c) => `- 변경: \`${c.id}\` ${c.field} ${c.from} → ${c.to}`),
  ...check.blockers.map((b) => `- ⛔ ${b}`),
  ...check.warnings.map((w) => `- ⚠️ ${w}`),
];
writeFileSync(REPORT_PATH, lines.join("\n") + "\n");
console.log(lines.join("\n"));

if (!check.ok) {
  setOutput("status", "blocked");
  process.exit(0);
}

const snapshot: PricingSnapshot = { source: OFFICIAL_PRICING_MD_URL, models: next };
writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + "\n");
setOutput("status", "updated");
setOutput("summary", [...diff.added, ...diff.changed.map((c) => c.id)].slice(0, 5).join(", "));
