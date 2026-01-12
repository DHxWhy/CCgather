/**
 * Content Pipeline - 3-Stage Article Processing
 *
 * Flow: URL → Fetch → Collect (Haiku) → Summarize (Opus) → Fact-Check (Opus)
 *
 * Stage 1 (Haiku): Validate source relevance and reliability
 * Stage 2 (Opus 4.5): Generate rich summary content
 * Stage 3 (Opus 4.5): Fact-check summary against original
 */

import { fetchArticle } from "@/lib/fetcher/smart-fetcher";
import { getHaikuValidator, type HaikuValidator } from "./haiku-validator";
import { getOpusSummarizer, type OpusSummarizer } from "./opus-summarizer";
import {
  getOpusFactChecker,
  type OpusFactChecker,
  type FactCheckOutput,
} from "./opus-fact-checker";
import type { FactCheckResult, PipelineResult, RichContent, SummarizerResult } from "./types";

// ============================================
// Pipeline Configuration
// ============================================

interface PipelineOptions {
  skipValidation?: boolean; // Skip Haiku validation (for trusted sources)
  skipFactCheck?: boolean; // Skip Opus fact-check (faster, cheaper)
  minFactCheckScore?: number; // Minimum score to proceed (default: 0.7)
  minAccuracy?: number; // Minimum accuracy for fact-check (default: 80)
  summarizerModel?: string; // Override summarizer model
}

// Extended result with fact-check
export interface PipelineResultWithFactCheck extends PipelineResult {
  factCheckResult?: FactCheckOutput;
}

// ============================================
// Content Pipeline Class
// ============================================

export class ContentPipeline {
  private validator: HaikuValidator;
  private summarizer: OpusSummarizer;
  private factChecker: OpusFactChecker;
  private options: PipelineOptions;

  constructor(options: PipelineOptions = {}) {
    this.options = {
      minFactCheckScore: 0.7,
      minAccuracy: 80,
      skipFactCheck: false,
      ...options,
    };

    this.validator = getHaikuValidator({
      minScore: this.options.minFactCheckScore,
    });

    this.summarizer = getOpusSummarizer({
      model: this.options.summarizerModel,
    });

    this.factChecker = getOpusFactChecker({
      minAccuracy: this.options.minAccuracy,
    });
  }

  /**
   * Process a single URL through the 3-stage pipeline
   */
  async process(url: string, category?: string): Promise<PipelineResultWithFactCheck> {
    const aiUsage = {
      model: "",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };

    try {
      // ========================================
      // Step 0: Fetch article
      // ========================================
      console.log(`[Pipeline] Fetching: ${url}`);
      const fetchResult = await fetchArticle(url);

      if (!fetchResult.success || !fetchResult.article) {
        return {
          success: false,
          error: fetchResult.error || "Failed to fetch article",
          aiUsage,
        };
      }

      const article = fetchResult.article;
      console.log(`[Pipeline] Fetched: "${article.title}" (${article.content.length} chars)`);

      // ========================================
      // Stage 1: Collect/Validate (Haiku)
      // ========================================
      let factCheck: FactCheckResult | undefined;

      if (!this.options.skipValidation) {
        console.log(`[Pipeline] Stage 1: Collecting with Haiku...`);
        const validationResult = await this.validator.validate({
          url: article.url,
          title: article.title,
          content: article.content,
          sourceName: article.sourceName,
          publishedAt: article.publishedAt,
        });

        factCheck = validationResult.result;
        aiUsage.inputTokens += validationResult.usage.inputTokens;
        aiUsage.outputTokens += validationResult.usage.outputTokens;
        aiUsage.costUsd += validationResult.usage.costUsd;
        aiUsage.model = "claude-3-5-haiku-20241022";

        console.log(
          `[Pipeline] Stage 1 complete: score=${factCheck.score}, reason="${factCheck.reason}"`
        );

        // Check if validation passed
        if (!this.validator.isAccepted(factCheck)) {
          return {
            success: false,
            article: {
              url: article.url,
              title: article.title,
              content: article.content,
              sourceName: article.sourceName,
              publishedAt: article.publishedAt,
              thumbnail: article.thumbnail,
              favicon: article.favicon,
            },
            factCheck,
            error: `Validation failed: ${factCheck.reason}`,
            aiUsage,
          };
        }
      }

      // ========================================
      // Stage 2: Summarize (Opus 4.5)
      // ========================================
      console.log(`[Pipeline] Stage 2: Summarizing with Opus 4.5...`);
      const summaryResult = await this.summarizer.summarize({
        url: article.url,
        title: article.title,
        content: article.content,
        sourceName: article.sourceName,
        publishedAt: article.publishedAt,
        favicon: article.favicon,
        category: category || "press",
      });

      aiUsage.inputTokens += summaryResult.usage.inputTokens;
      aiUsage.outputTokens += summaryResult.usage.outputTokens;
      aiUsage.costUsd += summaryResult.usage.costUsd;
      aiUsage.model = this.options.summarizerModel || "claude-opus-4-5-20250514";

      console.log(
        `[Pipeline] Stage 2 complete: summary length=${summaryResult.result.summaryPlain.length} chars`
      );

      // ========================================
      // Stage 3: Fact-Check (Opus 4.5)
      // ========================================
      let factCheckResult: FactCheckOutput | undefined;
      let finalSummary: SummarizerResult = summaryResult.result;

      if (!this.options.skipFactCheck) {
        console.log(`[Pipeline] Stage 3: Fact-checking with Opus 4.5...`);
        const factCheckResponse = await this.factChecker.verify({
          originalTitle: article.title,
          originalContent: article.content,
          originalUrl: article.url,
          sourceName: article.sourceName,
          generatedSummary: summaryResult.result,
        });

        factCheckResult = factCheckResponse.result;
        aiUsage.inputTokens += factCheckResponse.usage.inputTokens;
        aiUsage.outputTokens += factCheckResponse.usage.outputTokens;
        aiUsage.costUsd += factCheckResponse.usage.costUsd;

        console.log(
          `[Pipeline] Stage 3 complete: accurate=${factCheckResult.isAccurate}, ` +
            `confidence=${factCheckResult.confidence}, issues=${factCheckResult.issues.length}`
        );

        // Apply corrections if needed
        if (factCheckResult.correctedContent) {
          finalSummary = this.factChecker.getCorrectedContent(
            summaryResult.result,
            factCheckResult
          );
          console.log(
            `[Pipeline] Applied ${Object.keys(factCheckResult.correctedContent).length} corrections`
          );
        }

        // Warn if accuracy is low but don't reject
        if (!this.factChecker.isAccepted(factCheckResult)) {
          console.warn(
            `[Pipeline] Warning: Low accuracy (${factCheckResult.confidence}), but proceeding`
          );
        }
      }

      // ========================================
      // Return Result
      // ========================================
      return {
        success: true,
        article: {
          url: article.url,
          title: article.title,
          content: article.content,
          sourceName: article.sourceName,
          publishedAt: article.publishedAt,
          thumbnail: article.thumbnail,
          favicon: article.favicon,
        },
        factCheck,
        summary: finalSummary,
        factCheckResult,
        aiUsage,
      };
    } catch (error) {
      console.error(`[Pipeline] Error processing ${url}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Pipeline error",
        aiUsage,
      };
    }
  }

  /**
   * Process multiple URLs
   */
  async processMany(
    urls: Array<{ url: string; category?: string }>,
    options: { delayMs?: number; stopOnError?: boolean } = {}
  ): Promise<Map<string, PipelineResultWithFactCheck>> {
    const { delayMs = 3000, stopOnError = false } = options;
    const results = new Map<string, PipelineResultWithFactCheck>();

    for (let i = 0; i < urls.length; i++) {
      const item = urls[i]!;
      const { url, category } = item;

      const result = await this.process(url, category);
      results.set(url, result);

      if (!result.success && stopOnError) {
        console.log(`[Pipeline] Stopping due to error: ${result.error}`);
        break;
      }

      // Delay between requests (except for last one)
      if (i < urls.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Process a single article URL (3-stage pipeline)
 */
export async function processArticle(
  url: string,
  options: {
    category?: string;
    skipValidation?: boolean;
    skipFactCheck?: boolean;
  } = {}
): Promise<PipelineResultWithFactCheck> {
  const pipeline = new ContentPipeline({
    skipValidation: options.skipValidation,
    skipFactCheck: options.skipFactCheck,
  });

  return pipeline.process(url, options.category);
}

/**
 * Quick process (skip fact-check for speed)
 */
export async function quickProcessArticle(url: string, category?: string): Promise<PipelineResult> {
  const pipeline = new ContentPipeline({
    skipFactCheck: true,
  });

  return pipeline.process(url, category);
}

/**
 * Extract rich content from pipeline result
 */
export function extractRichContent(result: PipelineResult): RichContent | null {
  if (!result.success || !result.summary) {
    return null;
  }
  return result.summary.richContent;
}
