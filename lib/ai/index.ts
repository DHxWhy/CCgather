/**
 * AI Pipeline - Gemini 3 Flash
 *
 * Unified 3-Stage Article Processing (NEWS_TAB_STRATEGY.md v3.2)
 * - Stage 1: Fact Extraction
 * - Stage 2: Article Rewriting (English output, original content)
 * - Stage 3: Fact Verification
 *
 * Model: gemini-3-flash-preview (Gemini 3 Flash)
 */

// Types
export * from "./types";

// Gemini Client
export {
  GeminiClient,
  getGeminiClient,
  GEMINI_MODEL,
  GEMINI_COSTS,
  type GeminiUsage,
  type ExtractedFacts,
  type RewrittenArticle,
  type FactVerification,
} from "./gemini-client";

// Gemini Pipeline
export {
  GeminiPipeline,
  getGeminiPipeline,
  processArticleWithGemini,
  quickProcessArticleWithGemini,
  type GeminiPipelineResult,
} from "./gemini-pipeline";

// Alias for backward compatibility
export { GeminiPipeline as ContentPipeline } from "./gemini-pipeline";
