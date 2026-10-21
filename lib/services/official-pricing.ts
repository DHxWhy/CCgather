// ═══════════════════════════════════════════════════════════════════════════
// Official Claude pricing — parser + safety checks for the pricing snapshot.
//
// Pure functions only (no IO). `scripts/sync-claude-pricing.ts` fetches the
// official page and LiteLLM, runs these, and rewrites
// `lib/constants/claude-pricing.json`, which the server pricing service reads
// before LiteLLM. Source page (markdown form):
//   https://platform.claude.com/docs/en/about-claude/pricing.md
// ═══════════════════════════════════════════════════════════════════════════

export interface OfficialModelPricing {
  input: number; // USD per million tokens
  output: number;
  cacheWrite: number; // 5-minute cache write
  cacheWrite1h?: number; // 1-hour cache write
  cacheRead: number;
}

const PRICE_FIELDS = ["input", "output", "cacheWrite", "cacheWrite1h", "cacheRead"] as const;

export type PricingTable = Record<string, OfficialModelPricing>;

export interface PricingSnapshot {
  source: string;
  models: PricingTable;
}

export const OFFICIAL_PRICING_MD_URL =
  "https://platform.claude.com/docs/en/about-claude/pricing.md";

/** Model families the UI knows how to group; anything else is shown as "Other". */
export const KNOWN_FAMILIES = ["opus", "sonnet", "haiku", "fable", "mythos"] as const;

// Page layout changed or the fetch returned a stub — refuse to overwrite.
export const MIN_MODELS = 10;
// A per-token price moving by more than this is treated as suspicious.
export const MAX_PRICE_CHANGE_RATIO = 0.5;

function parseDollars(cell: string): number | null {
  const m = cell.match(/\$\s*([\d,]*\.?\d+)/);
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** "Claude Opus 5.5 ([retired…](…))" → "claude-opus-5-5" */
export function modelNameToId(cell: string): string | null {
  const name = cell
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // markdown links → text
    .replace(/<[^>]+>/g, "") // <sup> etc.
    .replace(/\([^)]*\)/g, "") // "(limited availability)" / "(retired …)"
    .trim()
    .toLowerCase();
  if (!/^claude [a-z]+ \d+(\.\d+)?$/.test(name)) return null;
  return name.replace(/\./g, "-").replace(/\s+/g, "-");
}

export function parseOfficialPricing(markdown: string): PricingTable {
  const start = markdown.indexOf("## Model pricing");
  if (start < 0) return {};
  const nextSection = markdown.indexOf("\n## ", start + 1);
  const section = markdown.slice(start, nextSection < 0 ? undefined : nextSection);

  const models: PricingTable = {};
  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1);
    if (cells.length < 6) continue;
    const [modelCell, inputCell, write5mCell, write1hCell, readCell, outputCell] = cells;
    const id = modelNameToId(modelCell ?? "");
    if (!id) continue;
    // A model split by prompt length (Haiku 5.5: "up to" / "over 100,000 tokens") appears
    // twice under one id. Keep the first row — the standard tier LiteLLM/ccusage use —
    // so the long-prompt surcharge row cannot overwrite it.
    if (models[id]) continue;
    const input = parseDollars(inputCell ?? "");
    const cacheWrite = parseDollars(write5mCell ?? "");
    const cacheWrite1h = parseDollars(write1hCell ?? "");
    const cacheRead = parseDollars(readCell ?? "");
    const output = parseDollars(outputCell ?? "");
    if (input == null || output == null || cacheWrite == null || cacheRead == null) continue;
    models[id] = {
      input,
      output,
      cacheWrite,
      ...(cacheWrite1h != null ? { cacheWrite1h } : {}),
      cacheRead,
    };
  }
  return models;
}

export interface SnapshotDiff {
  added: string[];
  removed: string[];
  // null = the field was not published on that side (a column appearing or disappearing)
  changed: {
    id: string;
    field: keyof OfficialModelPricing;
    from: number | null;
    to: number | null;
  }[];
}

export function diffPricing(prev: PricingTable, next: PricingTable): SnapshotDiff {
  const added = Object.keys(next).filter((id) => !(id in prev));
  const removed = Object.keys(prev).filter((id) => !(id in next));
  const changed: SnapshotDiff["changed"] = [];
  for (const [id, n] of Object.entries(next)) {
    const p = prev[id];
    if (!p) continue;
    for (const field of PRICE_FIELDS) {
      const from = p[field] ?? null;
      const to = n[field] ?? null;
      if (from !== to) changed.push({ id, field, from, to });
    }
  }
  return { added, removed, changed };
}

export interface SnapshotCheck {
  ok: boolean;
  blockers: string[];
  warnings: string[];
}

/**
 * Decide whether a freshly parsed table may replace the committed snapshot.
 * Additions are the expected case (new model) and pass; removals, large price
 * swings, and malformed rows block so a page-layout change cannot silently
 * rewrite production pricing.
 */
export function checkSnapshot(
  prev: PricingTable,
  next: PricingTable,
  litellm: PricingTable | null
): SnapshotCheck {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const count = Object.keys(next).length;

  if (count < MIN_MODELS) blockers.push(`parsed only ${count} models (< ${MIN_MODELS})`);

  // The committed-snapshot test requires both of these; blocking here keeps a page
  // anomaly from reaching the test gate, which alerts hourly without deduplication.
  const anyOneHour = Object.values(next).some((p) => p.cacheWrite1h !== undefined);
  for (const [id, p] of Object.entries(next)) {
    if (anyOneHour && p.cacheWrite1h === undefined) {
      blockers.push(`${id}: missing 1h cache write price`);
    }
    if (p.cacheWrite1h !== undefined && p.cacheWrite1h <= p.cacheWrite) {
      blockers.push(`${id}: implausible 1h cache write ${p.cacheWrite1h} ≤ 5m ${p.cacheWrite}`);
    }
  }

  for (const [id, p] of Object.entries(next)) {
    if (
      !(p.input > 0 && p.output > 0 && p.cacheWrite > 0 && p.cacheRead > 0) ||
      (p.cacheWrite1h !== undefined && !(p.cacheWrite1h > 0))
    ) {
      blockers.push(`${id}: non-positive price`);
    }
    if (p.cacheRead > p.input || p.output < p.input) {
      blockers.push(`${id}: implausible price shape ${JSON.stringify(p)}`);
    }
    const family = id.split("-")[1] ?? "";
    if (!(KNOWN_FAMILIES as readonly string[]).includes(family)) {
      warnings.push(`${id}: new model family "${family}" — UI groups it as "Other"`);
    }
  }

  const diff = diffPricing(prev, next);
  for (const id of diff.removed) blockers.push(`${id}: removed from the official table`);
  for (const c of diff.changed) {
    if (c.from === null) continue; // a newly published column, like a new model, passes
    if (c.to === null) {
      blockers.push(`${c.id}.${c.field}: dropped from the official table`);
      continue;
    }
    const ratio = Math.abs(c.to - c.from) / c.from;
    if (ratio > MAX_PRICE_CHANGE_RATIO) {
      blockers.push(`${c.id}.${c.field}: ${c.from} → ${c.to} (>${MAX_PRICE_CHANGE_RATIO * 100}%)`);
    }
  }

  if (litellm) {
    const added = new Set(diff.added);
    for (const [id, p] of Object.entries(next)) {
      const l = litellm[id];
      if (!l) {
        if (added.has(id)) warnings.push(`${id}: not listed on LiteLLM yet`);
        continue;
      }
      for (const field of PRICE_FIELDS) {
        const official = p[field];
        const other = l[field];
        if (official === undefined || other === undefined) continue;
        if (Math.abs(other - official) > 1e-6) {
          warnings.push(`${id}.${field}: official ${official} vs LiteLLM ${other}`);
        }
      }
    }
  }

  return { ok: blockers.length === 0, blockers, warnings };
}
