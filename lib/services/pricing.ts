// ═══════════════════════════════════════════════════════════════════════════
// Server-side Claude Pricing Service
//
// Mirrors the CLI pricing logic in `packages/cli/src/lib/pricing.ts` so the
// server can recompute cost_usd from raw token counts + primary_model on
// every submission. This makes cost values independent of the CLI version
// the user is running — even an outdated CLI with stale fallback prices
// gets corrected at the server boundary.
//
// Sources:
// - LiteLLM:        https://github.com/BerriAI/litellm
// - Anthropic API:  https://claude.com/pricing
//
// Cache strategy: in-process Map with 24h TTL. Each serverless instance
// fetches once, then reuses for the cold-start lifetime. Refetch is
// triggered automatically once the TTL expires.
// ═══════════════════════════════════════════════════════════════════════════

const LITELLM_PRICING_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

interface ModelPricing {
  input: number; // per million tokens
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

// Fallback pricing — used ONLY when the LiteLLM fetch fails.
// Per-million-token rates from Anthropic official pricing (claude.com/pricing).
// `satisfies` keeps literal-key inference so indexing returns ModelPricing
// (no `undefined`) under noUncheckedIndexedAccess.
const FALLBACK_PRICING = {
  "fable-5": { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1 },
  // Opus 4 / 4.1 (legacy higher tier)
  "opus-4": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  // Opus 4.5 / 4.6 / 4.7 (current generation lower tier)
  "opus-4-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  // Sonnet 4 family
  "sonnet-4": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  // Haiku 4.5
  "haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  // Haiku 3.5 (legacy)
  "haiku-3-5": { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
  default: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
} as const satisfies Record<string, ModelPricing>;

// Provider / region prefixes that may wrap a Claude model identifier in
// LiteLLM keys or in `model` strings sent by SDKs/gateways. We strip these
// so matching works on the bare "claude-..." form. Order matters — longest
// prefix first so e.g. "openrouter/anthropic/" wins over "openrouter/".
const PROVIDER_PREFIXES = [
  // Anthropic native / Bedrock cross-region inference profiles
  "anthropic.",
  "us.anthropic.",
  "eu.anthropic.",
  "apac.anthropic.",
  "au.anthropic.",
  "jp.anthropic.",
  "global.anthropic.",
  // Vendor namespaces with anthropic sub-prefix
  "openrouter/anthropic/",
  "vercel_ai_gateway/anthropic/",
  "replicate/anthropic/",
  "perplexity/anthropic/",
  "deepinfra/anthropic/",
  "gmi/anthropic/",
  // Generic vendor namespaces
  "anthropic/",
  "openrouter/openai/",
  "openrouter/",
  "azure_ai/",
  "azure/",
  "vertex_ai/",
  "databricks/",
  "github_copilot/",
  "vercel_ai_gateway/",
  "snowflake/",
  "heroku/",
] as const;

interface PricingCacheEntry {
  fetchedAt: number;
  models: Record<string, ModelPricing>;
}

// In-process cache shared across requests within a single serverless instance.
let pricingCache: PricingCacheEntry | null = null;
let inflightFetch: Promise<Record<string, ModelPricing> | null> | null = null;

function stripProviderPrefix(key: string): string {
  for (const prefix of PROVIDER_PREFIXES) {
    if (key.startsWith(prefix)) {
      return key.slice(prefix.length);
    }
  }
  return key;
}

function extractClaudePricing(
  rawData: Record<string, Record<string, unknown>>
): Record<string, ModelPricing> {
  const result: Record<string, ModelPricing> = {};

  for (const [key, value] of Object.entries(rawData)) {
    const normalized = stripProviderPrefix(key);
    if (!normalized.startsWith("claude-")) continue;

    const inputCostPerToken = value.input_cost_per_token as number | undefined;
    const outputCostPerToken = value.output_cost_per_token as number | undefined;
    if (inputCostPerToken == null || outputCostPerToken == null) continue;

    const input = inputCostPerToken * 1_000_000;
    const output = outputCostPerToken * 1_000_000;

    const cacheWritePerToken = value.cache_creation_input_token_cost as number | undefined;
    const cacheReadPerToken = value.cache_read_input_token_cost as number | undefined;

    const cacheWrite = cacheWritePerToken != null ? cacheWritePerToken * 1_000_000 : input * 1.25;
    const cacheRead = cacheReadPerToken != null ? cacheReadPerToken * 1_000_000 : input * 0.1;

    const pricing: ModelPricing = {
      input: Math.round(input * 1000) / 1000,
      output: Math.round(output * 1000) / 1000,
      cacheWrite: Math.round(cacheWrite * 1000) / 1000,
      cacheRead: Math.round(cacheRead * 1000) / 1000,
    };

    result[key] = pricing;
    if (normalized !== key && !result[normalized]) {
      result[normalized] = pricing;
    }
    const withoutDate = normalized.replace(/-\d{8}$/, "");
    if (withoutDate !== normalized && !result[withoutDate]) {
      result[withoutDate] = pricing;
    }
    const withoutVersion = normalized.replace(/-v\d+:\d+$/, "").replace(/-\d{8}$/, "");
    if (
      withoutVersion !== normalized &&
      withoutVersion !== withoutDate &&
      !result[withoutVersion]
    ) {
      result[withoutVersion] = pricing;
    }
  }

  return result;
}

async function fetchPricingFromLiteLLM(): Promise<Record<string, ModelPricing> | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(LITELLM_PRICING_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const rawData = (await response.json()) as Record<string, Record<string, unknown>>;
    const extracted = extractClaudePricing(rawData);

    if (Object.keys(extracted).length === 0) return null;

    return extracted;
  } catch {
    return null;
  }
}

async function ensurePricingData(): Promise<Record<string, ModelPricing> | null> {
  if (pricingCache && Date.now() - pricingCache.fetchedAt < CACHE_TTL_MS) {
    return pricingCache.models;
  }

  // Coalesce concurrent refresh attempts into a single in-flight fetch.
  if (inflightFetch) return inflightFetch;

  inflightFetch = (async () => {
    const fresh = await fetchPricingFromLiteLLM();
    if (fresh) {
      pricingCache = { fetchedAt: Date.now(), models: fresh };
      return fresh;
    }
    // Fall back to a stale cache if available (better than nothing).
    return pricingCache?.models ?? null;
  })();

  try {
    return await inflightFetch;
  } finally {
    inflightFetch = null;
  }
}

function fallbackForModel(model: string): ModelPricing {
  const m = model.toLowerCase();
  if (m.includes("fable") || m.includes("mythos")) return FALLBACK_PRICING["fable-5"];
  // 현행 저tier($5/$25): opus-4-5~4-19 minor(4-8 포함) OR opus-5+(Opus 5,6…).
  // Opus 4/4.1/3 만 레거시 $15/$75. LiteLLM 미등재 신모델의 3배 과청구 방지용 stopgap.
  if (/opus-?(4[-.]?([5-9]|1\d)|[5-9]|1\d)/.test(m)) return FALLBACK_PRICING["opus-4-5"];
  if (m.includes("opus")) return FALLBACK_PRICING["opus-4"];
  if (/haiku-?4/.test(m)) return FALLBACK_PRICING["haiku-4-5"];
  if (m.includes("haiku")) return FALLBACK_PRICING["haiku-3-5"];
  if (m.includes("sonnet")) return FALLBACK_PRICING["sonnet-4"];
  return FALLBACK_PRICING["default"];
}

function matchModel(model: string, pricingData: Record<string, ModelPricing> | null): ModelPricing {
  if (pricingData) {
    const normalized = stripProviderPrefix(model);

    if (pricingData[model]) return pricingData[model];
    if (pricingData[normalized]) return pricingData[normalized];

    const withoutDate = normalized.replace(/-\d{8}$/, "");
    if (pricingData[withoutDate]) return pricingData[withoutDate];

    const withoutVersion = normalized.replace(/-v\d+:\d+$/, "").replace(/-\d{8}$/, "");
    if (pricingData[withoutVersion]) return pricingData[withoutVersion];

    // ★ Opus tier 가드 (Diana 발견, 2026-05-29): 아래 fuzzy startsWith 루프가
    // 합성키 "claude-opus-4"(레거시 $15/$75)로 신규 minor("claude-opus-4-8" 등)를
    // 오매칭 → 3배 과다청구. exact/date/version 이 모두 미스한 opus 는 fuzzy 를
    // 건너뛰고 family-tier fallback(정확한 regex 분류)으로 직행한다.
    // opus-4-5/6/7 은 LiteLLM exact 키가 있어 위에서 이미 반환되므로 이 가드에
    // 걸리지 않음(LiteLLM 권위 유지). LiteLLM 미등재 신규 opus(4-8+)만 여기서 처리.
    if (/opus/i.test(normalized)) {
      return fallbackForModel(model);
    }

    const modelLower = normalized.toLowerCase();
    let bestMatch: { key: string; pricing: ModelPricing } | null = null;
    for (const [key, pricing] of Object.entries(pricingData)) {
      const keyLower = key.toLowerCase();
      if (
        modelLower.startsWith(keyLower) ||
        keyLower.startsWith(modelLower.replace(/-\d{8}$/, ""))
      ) {
        if (!bestMatch || key.length > bestMatch.key.length) {
          bestMatch = { key, pricing };
        }
      }
    }
    if (bestMatch) return bestMatch.pricing;
  }

  return fallbackForModel(model);
}

export interface DayCostInputs {
  model: string | null | undefined;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

/**
 * Compute the USD cost for a single day's token totals.
 * Caller-provided model is used to pick the pricing tier; if null/empty,
 * the default tier is applied (matches CLI behavior).
 */
export function computeDayCost(
  pricingData: Record<string, ModelPricing> | null,
  inputs: DayCostInputs
): number {
  const model = inputs.model || "default";
  const price = matchModel(model, pricingData);

  const inputCost = (inputs.inputTokens / 1_000_000) * price.input;
  const outputCost = (inputs.outputTokens / 1_000_000) * price.output;
  const cacheWriteCost = (inputs.cacheWriteTokens / 1_000_000) * price.cacheWrite;
  const cacheReadCost = (inputs.cacheReadTokens / 1_000_000) * price.cacheRead;

  return Math.round((inputCost + outputCost + cacheWriteCost + cacheReadCost) * 100) / 100;
}

export interface ModelTokenSplit {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export interface ModelSplitCostInputs {
  modelTokens: unknown;
  declaredModels: Record<string, number> | null | undefined;
  dayTotals: Omit<DayCostInputs, "model">;
}

const MAX_MODELS_PER_DAY = 50;
const MAX_MODEL_KEY_LENGTH = 200;

function isTokenCount(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function readSplit(value: unknown): ModelTokenSplit | null {
  if (value === null || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    !isTokenCount(v.inputTokens) ||
    !isTokenCount(v.outputTokens) ||
    !isTokenCount(v.cacheWriteTokens) ||
    !isTokenCount(v.cacheReadTokens)
  ) {
    return null;
  }
  return {
    inputTokens: v.inputTokens,
    outputTokens: v.outputTokens,
    cacheWriteTokens: v.cacheWriteTokens,
    cacheReadTokens: v.cacheReadTokens,
  };
}

function rawCost(price: ModelPricing, t: ModelTokenSplit): number {
  return (
    (t.inputTokens / 1_000_000) * price.input +
    (t.outputTokens / 1_000_000) * price.output +
    (t.cacheWriteTokens / 1_000_000) * price.cacheWrite +
    (t.cacheReadTokens / 1_000_000) * price.cacheRead
  );
}

/**
 * Price a day per model; returns null when the split can't be trusted so the
 * caller falls back to `computeDayCost`.
 *
 * SECURITY — every input is user-supplied. The split is accepted only as a
 * refinement of the already-declared `day.models` (the field `primary_model`
 * comes from), and is clamped to the priciest single-model reading of the day.
 * Drop any of those checks and a caller can keep the day totals intact while
 * billing them to a pricier model than `primary_model` reports: cost inflation
 * with no visible signal. The clamp holds even if the upstream price table
 * stops having one model that is priciest on all four token types.
 * Summed unrounded, rounded once — per-model rounding drops sub-cent models.
 */
export function computeDayCostByModel(
  pricingData: Record<string, ModelPricing> | null,
  inputs: ModelSplitCostInputs
): number | null {
  const { modelTokens, declaredModels, dayTotals } = inputs;

  if (!declaredModels || typeof declaredModels !== "object") return null;
  if (modelTokens === null || typeof modelTokens !== "object" || Array.isArray(modelTokens)) {
    return null;
  }
  if (
    !isTokenCount(dayTotals.inputTokens) ||
    !isTokenCount(dayTotals.outputTokens) ||
    !isTokenCount(dayTotals.cacheWriteTokens) ||
    !isTokenCount(dayTotals.cacheReadTokens)
  ) {
    return null;
  }

  const declaredKeys = Object.keys(declaredModels);
  const entries = Object.entries(modelTokens as Record<string, unknown>);
  if (entries.length === 0) return null;
  if (declaredKeys.length === 0 || declaredKeys.length > MAX_MODELS_PER_DAY) return null;

  const splits: { model: string; split: ModelTokenSplit }[] = [];
  let sumInput = 0;
  let sumOutput = 0;
  let sumCacheWrite = 0;
  let sumCacheRead = 0;

  for (const [model, value] of entries) {
    if (model.length > MAX_MODEL_KEY_LENGTH) return null;

    const declaredTotal = declaredModels[model];
    if (!isTokenCount(declaredTotal)) return null;

    const split = readSplit(value);
    if (!split) return null;

    const splitTotal =
      split.inputTokens + split.outputTokens + split.cacheWriteTokens + split.cacheReadTokens;
    if (splitTotal !== declaredTotal) return null;

    sumInput += split.inputTokens;
    sumOutput += split.outputTokens;
    sumCacheWrite += split.cacheWriteTokens;
    sumCacheRead += split.cacheReadTokens;
    splits.push({ model, split });
  }

  if (
    sumInput !== dayTotals.inputTokens ||
    sumOutput !== dayTotals.outputTokens ||
    sumCacheWrite !== dayTotals.cacheWriteTokens ||
    sumCacheRead !== dayTotals.cacheReadTokens
  ) {
    return null;
  }

  // `matchModel` is O(pricing table) for ids without an exact hit, and this runs
  // per model per day (up to 50 x 730 per request) — memoize within the call.
  const priceCache = new Map<string, ModelPricing>();
  const priceOf = (model: string): ModelPricing => {
    let price = priceCache.get(model);
    if (!price) {
      price = matchModel(model, pricingData);
      priceCache.set(model, price);
    }
    return price;
  };

  let total = 0;
  for (const { model, split } of splits) {
    total += rawCost(priceOf(model), split);
  }

  let ceiling = 0;
  for (const model of declaredKeys) {
    ceiling = Math.max(ceiling, rawCost(priceOf(model), dayTotals));
  }

  return Math.round(Math.min(total, ceiling) * 100) / 100;
}

/**
 * Get the latest pricing table (LiteLLM with 24h cache, fallback to null
 * which causes computeDayCost to use the hardcoded fallback per-model).
 */
export async function getPricingData(): Promise<Record<string, ModelPricing> | null> {
  return ensurePricingData();
}
