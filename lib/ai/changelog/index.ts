/**
 * Changelog AI Pipeline - Unified Exports
 *
 * 2-Stage content generation pipeline:
 * - Stage 1 (Haiku): Collector - Parse changelog, detect versions
 * - Stage 2 (Opus 4.5): ContentGenerator - High-quality content with self-verification
 */

// Types
export * from "./types";

// Collector (Haiku)
export { ChangelogCollector, getChangelogCollector, fetchChangelogContent } from "./collector";

// Content Generator (Opus 4.5) - Primary content generation
export { ChangelogContentGenerator, getChangelogContentGenerator } from "./content-generator";

// Writer (Sonnet) - Legacy, kept for compatibility
export { ChangelogWriter, getChangelogWriter, generateSlug, estimateDifficulty } from "./writer";

// Verifier (Opus) - Legacy, kept for compatibility
export {
  ChangelogVerifier,
  getChangelogVerifier,
  calculateOverallConfidence,
  generateVerificationSummary,
} from "./verifier";

// Pipeline
export {
  ChangelogContentPipeline,
  processChangelog,
  processAndSaveChangelog,
  quickProcessChangelog,
} from "./pipeline";

// Prompts (for customization)
export {
  COLLECTOR_SYSTEM_PROMPT,
  COLLECTOR_USER_PROMPT,
  WRITER_SYSTEM_PROMPT,
  WRITER_USER_PROMPT,
  VERIFIER_SYSTEM_PROMPT,
  VERIFIER_USER_PROMPT,
  BEGINNERS_DICT_SYSTEM_PROMPT,
  BEGINNERS_DICT_USER_PROMPT,
  fillTemplate,
} from "./prompts";
