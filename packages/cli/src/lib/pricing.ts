import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ═══════════════════════════════════════════════════════════════════════════
// LiteLLM Dynamic Pricing Module
// Fetches Claude model pricing from LiteLLM's model_prices JSON,
// caches locally with 24h TTL, falls back to hardcoded prices.
//
// Pricing sources (verified 2026-05):
// - LiteLLM: https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
// - Anthropic official: https://claude.com/pricing
// ═══════════════════════════════════════════════════════════════════════════

const LITELLM_PRICING_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 5000;

interface ModelPricing {
  input: number; // per million tokens
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

interface PricingCache {
  fetchedAt: number; // epoch ms
  models: Record<string, ModelPricing>;
}

// Fallback pricing — used ONLY when LiteLLM fetch fails AND disk cache is missing.
// Per-million-token rates from Anthropic official pricing (claude.com/pricing).
// Opus 4 / 4.1 stayed at the legacy higher tier; Opus 4.5+ moved to a new lower tier.
const FALLBACK_PRICING: Record<string, ModelPricing> = {
  // Opus 4 / 4.1 (legacy higher tier)
  "opus-4": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  // Opus 4.5 / 4.6 / 4.7 (current generation lower tier)
  "opus-4-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  // Sonnet 4 family (4 / 4.5 / 4.6 — same price)
  "sonnet-4": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  // Haiku 4.5
  "haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  // Haiku 3.5 (legacy)
  "haiku-3-5": { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
  // Generic safety net (matches Sonnet pricing, the most common Claude tier)
  default: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
};

// Provider / region prefixes that may wrap a Claude model identifier in
// LiteLLM keys (e.g., "anthropic.claude-opus-4-7",
// "us.anthropic.claude-opus-4-7", "openrouter/anthropic/claude-opus-4-7").
// We strip these so matching works on the bare "claude-..." form. Order
// matters — longest prefix first so e.g. "openrouter/anthropic/" wins over
// "openrouter/".
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

// In-memory cache (populated by initPricing or from disk cache)
let pricingData: Record<string, ModelPricing> | null = null;

function getCacheFilePath(): string {
  const configDir =
    process.platform === "win32"
      ? path.join(
          process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
          "ccgather-nodejs"
        )
      : path.join(os.homedir(), ".config", "ccgather-nodejs");

  return path.join(configDir, "pricing-cache.json");
}

function loadCache(): PricingCache | null {
  try {
    const cachePath = getCacheFilePath();
    if (!fs.existsSync(cachePath)) return null;

    const raw = fs.readFileSync(cachePath, "utf-8");
    const cache = JSON.parse(raw) as PricingCache;

    if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) return null;
    if (!cache.models || Object.keys(cache.models).length === 0) return null;

    return cache;
  } catch {
    return null;
  }
}

function saveCache(models: Record<string, ModelPricing>): void {
  try {
    const cachePath = getCacheFilePath();
    const cacheDir = path.dirname(cachePath);

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const cache: PricingCache = {
      fetchedAt: Date.now(),
      models,
    };

    fs.writeFileSync(cachePath, JSON.stringify(cache), "utf-8");
  } catch {
    // Silently fail — pricing still works from memory or hardcoded fallback.
  }
}

/**
 * Strip a known provider prefix from a model identifier.
 * E.g., "anthropic.claude-opus-4-7" → "claude-opus-4-7"
 */
function stripProviderPrefix(key: string): string {
  for (const prefix of PROVIDER_PREFIXES) {
    if (key.startsWith(prefix)) {
      return key.slice(prefix.length);
    }
  }
  return key;
}

/**
 * Extract Claude model pricing from LiteLLM JSON.
 * Indexes each entry under both the original key and the prefix-stripped form
 * so a request like "claude-opus-4-7" matches whether LiteLLM stores it as
 * "claude-opus-4-7" or "anthropic.claude-opus-4-7".
 */
function extractClaudePricing(
  rawData: Record<string, Record<string, unknown>>
): Record<string, ModelPricing> {
  const result: Record<string, ModelPricing> = {};

  for (const [key, value] of Object.entries(rawData)) {
    const normalized = stripProviderPrefix(key);

    // Only process Claude models (after stripping provider prefix).
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

    // Index under the original key.
    result[key] = pricing;

    // Index under the prefix-stripped key (so anthropic.claude-* also matches claude-*).
    if (normalized !== key && !result[normalized]) {
      result[normalized] = pricing;
    }

    // Index under the date-suffix-stripped key (e.g., "claude-opus-4-7-20260416" → "claude-opus-4-7").
    const withoutDate = normalized.replace(/-\d{8}$/, "");
    if (withoutDate !== normalized && !result[withoutDate]) {
      result[withoutDate] = pricing;
    }

    // Index under the version-suffix-stripped key (e.g., "claude-sonnet-4-5-20250929-v1:0").
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

/**
 * Initialize pricing data (call once before scanning).
 * Order: in-memory → disk cache → LiteLLM fetch → hardcoded fallback.
 * Safe to call multiple times (no-op if already initialized).
 */
export async function initPricing(): Promise<void> {
  if (pricingData) return;

  // 1. Try disk cache (24h TTL).
  const cached = loadCache();
  if (cached) {
    pricingData = cached.models;
    return;
  }

  // 2. Fetch from LiteLLM.
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(LITELLM_PRICING_URL, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const rawData = (await response.json()) as Record<string, Record<string, unknown>>;
      const extracted = extractClaudePricing(rawData);

      if (Object.keys(extracted).length > 0) {
        pricingData = extracted;
        saveCache(extracted);
        return;
      }
    }
  } catch {
    // Fetch failed (timeout, network error, etc.) — fall through to hardcoded fallback.
  }

  // 3. Hardcoded fallback (pricingData stays null; matchModel uses FALLBACK_PRICING).
  pricingData = null;
}

/**
 * Resolve hardcoded fallback pricing for a model name.
 * Order matters — most specific match first.
 */
function fallbackForModel(model: string): ModelPricing {
  const m = model.toLowerCase();

  // Opus 4.5 / 4.6 / 4.7 — current generation, lower tier
  if (/opus-?4[-.]?(5|6|7)/.test(m)) return FALLBACK_PRICING["opus-4-5"];

  // Other Opus (Opus 4, 4.1, 3, ...) — legacy higher tier
  if (m.includes("opus")) return FALLBACK_PRICING["opus-4"];

  // Haiku 4.x
  if (/haiku-?4/.test(m)) return FALLBACK_PRICING["haiku-4-5"];
  // Haiku 3.x
  if (m.includes("haiku")) return FALLBACK_PRICING["haiku-3-5"];

  // Sonnet (4 / 4.5 / 4.6 — same price)
  if (m.includes("sonnet")) return FALLBACK_PRICING["sonnet-4"];

  return FALLBACK_PRICING["default"];
}

/**
 * Match a model name to LiteLLM pricing data using multi-level matching:
 * 1. Exact match (original or prefix-stripped)
 * 2. Date-suffix removed
 * 3. Version-suffix removed
 * 4. Family prefix match (longest-key wins)
 * 5. Hardcoded fallback by family detection
 */
function matchModel(model: string): ModelPricing {
  if (pricingData) {
    const normalized = stripProviderPrefix(model);

    // 1. Exact match (try original then prefix-stripped form).
    if (pricingData[model]) return pricingData[model];
    if (pricingData[normalized]) return pricingData[normalized];

    // 2. Without date suffix.
    const withoutDate = normalized.replace(/-\d{8}$/, "");
    if (pricingData[withoutDate]) return pricingData[withoutDate];

    // 3. Without version suffix.
    const withoutVersion = normalized.replace(/-v\d+:\d+$/, "").replace(/-\d{8}$/, "");
    if (pricingData[withoutVersion]) return pricingData[withoutVersion];

    // 4. Family prefix match (longest key wins).
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

  // 5. Hardcoded fallback by family detection.
  return fallbackForModel(model);
}

/**
 * Estimate cost based on model and tokens (including cache tokens).
 * Same signature as the previous hardcoded version.
 * Call initPricing() once before using this for best accuracy.
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheWriteTokens: number = 0,
  cacheReadTokens: number = 0
): number {
  const price = matchModel(model);

  const inputCost = (inputTokens / 1_000_000) * price.input;
  const outputCost = (outputTokens / 1_000_000) * price.output;
  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * price.cacheWrite;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * price.cacheRead;

  return Math.round((inputCost + outputCost + cacheWriteCost + cacheReadCost) * 100) / 100;
}
