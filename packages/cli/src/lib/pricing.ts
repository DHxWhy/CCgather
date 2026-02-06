import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ═══════════════════════════════════════════════════════════════════════════
// LiteLLM Dynamic Pricing Module
// Fetches Claude model pricing from LiteLLM's model_prices JSON,
// caches locally with 24h TTL, falls back to hardcoded prices.
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

// Fallback pricing (LiteLLM-corrected, per million tokens)
const FALLBACK_PRICING: Record<string, ModelPricing> = {
  "opus-4": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "sonnet-4": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  haiku: { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  default: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
};

// In-memory cache (populated by initPricing or from disk cache)
let pricingData: Record<string, ModelPricing> | null = null;

/**
 * Get cache file path
 * Uses OS-specific config directory for persistent caching
 */
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

/**
 * Load cached pricing data from disk
 * Returns null if cache is missing, expired, or corrupt
 */
function loadCache(): PricingCache | null {
  try {
    const cachePath = getCacheFilePath();
    if (!fs.existsSync(cachePath)) return null;

    const raw = fs.readFileSync(cachePath, "utf-8");
    const cache = JSON.parse(raw) as PricingCache;

    // Check TTL
    if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) return null;
    if (!cache.models || Object.keys(cache.models).length === 0) return null;

    return cache;
  } catch {
    return null;
  }
}

/**
 * Save pricing data to disk cache
 */
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
    // Silently fail - pricing will still work from memory or fallback
  }
}

/**
 * Extract Claude model pricing from LiteLLM JSON
 * LiteLLM keys look like: "claude-3-5-sonnet-20241022", "claude-opus-4-20250514", etc.
 * We normalize to simpler keys for matching.
 */
function extractClaudePricing(
  rawData: Record<string, Record<string, unknown>>
): Record<string, ModelPricing> {
  const result: Record<string, ModelPricing> = {};

  for (const [key, value] of Object.entries(rawData)) {
    // Only process claude models
    if (!key.startsWith("claude-")) continue;

    const inputCostPerToken = value.input_cost_per_token as number | undefined;
    const outputCostPerToken = value.output_cost_per_token as number | undefined;

    if (inputCostPerToken == null || outputCostPerToken == null) continue;

    // Convert per-token to per-million-tokens
    const input = inputCostPerToken * 1_000_000;
    const output = outputCostPerToken * 1_000_000;

    // Cache pricing: LiteLLM provides cache_creation and cache_read costs
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

    // Store with original key (e.g., "claude-3-5-sonnet-20241022")
    result[key] = pricing;

    // Also store normalized key without date suffix (e.g., "claude-3-5-sonnet")
    const withoutDate = key.replace(/-\d{8}$/, "");
    if (withoutDate !== key && !result[withoutDate]) {
      result[withoutDate] = pricing;
    }

    // Also store without version suffix like "-v1:0"
    const withoutVersion = key.replace(/-v\d+:\d+$/, "").replace(/-\d{8}$/, "");
    if (withoutVersion !== key && withoutVersion !== withoutDate && !result[withoutVersion]) {
      result[withoutVersion] = pricing;
    }
  }

  return result;
}

/**
 * Initialize pricing data (call once before scanning)
 * Tries: disk cache → LiteLLM fetch → fallback
 * Safe to call multiple times (no-op if already initialized)
 */
export async function initPricing(): Promise<void> {
  if (pricingData) return;

  // 1. Try disk cache
  const cached = loadCache();
  if (cached) {
    pricingData = cached.models;
    return;
  }

  // 2. Fetch from LiteLLM
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
    // Fetch failed (timeout, network error, etc.) - fall through to fallback
  }

  // 3. Fallback - use hardcoded prices
  pricingData = null;
}

/**
 * Match a model name to pricing data using multi-level matching:
 * 1. Exact match
 * 2. Date removed match (e.g., "claude-sonnet-4-5-20250514" → "claude-sonnet-4-5")
 * 3. Family prefix match (e.g., "claude-sonnet-4-5-..." → any key starting with "claude-sonnet-4")
 * 4. Fallback by family keyword (opus/haiku/sonnet)
 */
function matchModel(model: string): ModelPricing {
  if (pricingData) {
    // 1. Exact match
    if (pricingData[model]) {
      return pricingData[model];
    }

    // 2. Without date suffix
    const withoutDate = model.replace(/-\d{8}$/, "");
    if (pricingData[withoutDate]) {
      return pricingData[withoutDate];
    }

    // 3. Without version suffix
    const withoutVersion = model.replace(/-v\d+:\d+$/, "").replace(/-\d{8}$/, "");
    if (pricingData[withoutVersion]) {
      return pricingData[withoutVersion];
    }

    // 4. Family prefix match: find the longest matching key
    const modelLower = model.toLowerCase();
    let bestMatch: { key: string; pricing: ModelPricing } | null = null;

    for (const [key, pricing] of Object.entries(pricingData)) {
      if (
        modelLower.startsWith(key.toLowerCase()) ||
        key.toLowerCase().startsWith(modelLower.replace(/-\d{8}$/, ""))
      ) {
        if (!bestMatch || key.length > bestMatch.key.length) {
          bestMatch = { key, pricing };
        }
      }
    }

    if (bestMatch) {
      return bestMatch.pricing;
    }
  }

  // 5. Hardcoded fallback by family keyword
  const modelLower = model.toLowerCase();
  if (modelLower.includes("opus")) return FALLBACK_PRICING["opus-4"];
  if (modelLower.includes("haiku")) return FALLBACK_PRICING["haiku"];
  if (modelLower.includes("sonnet")) return FALLBACK_PRICING["sonnet-4"];

  return FALLBACK_PRICING["default"];
}

/**
 * Estimate cost based on model and tokens (including cache tokens)
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
