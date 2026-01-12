/**
 * AI Pipeline - Unified exports
 *
 * News Pipeline (3-stage):
 * - Stage 1 (Haiku): Collect/validate source
 * - Stage 2 (Opus 4.5): Generate summary
 * - Stage 3 (Opus 4.5): Fact-check summary
 *
 * Changelog Pipeline (2-stage):
 * - Stage 1 (Haiku): Detect versions
 * - Stage 2 (Opus 4.5): Generate content
 */

// Types
export * from "./types";

// Haiku Validator (Stage 1 - News)
export { HaikuValidator, getHaikuValidator } from "./haiku-validator";

// Opus Summarizer (Stage 2 - News)
export { OpusSummarizer, getOpusSummarizer, getSummaryTierInfo } from "./opus-summarizer";

// Opus Fact Checker (Stage 3 - News)
export {
  OpusFactChecker,
  getOpusFactChecker,
  type FactCheckInput,
  type FactCheckOutput,
} from "./opus-fact-checker";

// Pipeline
export {
  ContentPipeline,
  processArticle,
  quickProcessArticle,
  extractRichContent,
  type PipelineResultWithFactCheck,
} from "./pipeline";

// Changelog Pipeline
export * from "./changelog";
