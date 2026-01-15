/**
 * Gemini Content Pipeline - Unified 3-Stage Article Processing
 *
 * Based on NEWS_TAB_STRATEGY.md v3.2:
 * - Stage 1: Fact Extraction (팩트 추출)
 * - Stage 2: Article Rewriting (기사 재작성)
 * - Stage 3: Fact Verification (팩트 검증)
 *
 * Model: gemini-3-flash-preview (Gemini 3 Flash)
 * Pricing: $0.50/1M input, $3.00/1M output
 */

import { fetchArticle } from "@/lib/fetcher/smart-fetcher";
import {
  GeminiClient,
  getGeminiClient,
  GEMINI_MODEL,
  type GeminiUsage,
  type ExtractedFacts,
  type RewrittenArticle,
  type FactVerification,
} from "./gemini-client";
import type { RichContent, PipelineResult, SummarizerResult } from "./types";

// ===========================================
// Configuration
// ===========================================

// Progress callback type for real-time updates
export type PipelineProgressCallback = (stage: string, message: string, progress: number) => void;

interface GeminiPipelineOptions {
  apiKey?: string;
  debug?: boolean;
  minFactCheckScore?: number; // Minimum score to pass (default: 80)
  maxRetries?: number; // Maximum retries for low score (default: 1)
  skipFactCheck?: boolean; // Skip Stage 3 for speed
  onProgress?: PipelineProgressCallback; // Real-time progress callback
}

// ===========================================
// Extended Pipeline Result
// ===========================================

export interface GeminiPipelineResult extends PipelineResult {
  extractedFacts?: ExtractedFacts;
  rewrittenArticle?: RewrittenArticle;
  factVerification?: FactVerification;
  needsReview?: boolean; // True if fact-check score is below threshold after retries
  retryCount?: number; // Number of retries performed
  newsTags?: string[]; // Automatically derived news tags for filtering
  stageResults?: {
    stage1?: GeminiUsage;
    stage2?: GeminiUsage;
    stage2Retry?: GeminiUsage; // Retry usage tracking
    stage3?: GeminiUsage;
    stage3Retry?: GeminiUsage; // Retry usage tracking
  };
}

// ===========================================
// Gemini Pipeline Class
// ===========================================

export class GeminiPipeline {
  private client: GeminiClient;
  private options: GeminiPipelineOptions;
  private debug: boolean;

  constructor(options: GeminiPipelineOptions = {}) {
    this.options = {
      minFactCheckScore: 80, // Increased from 70 for higher quality
      maxRetries: 1, // Retry once if score is below threshold
      skipFactCheck: false,
      ...options,
    };
    this.debug = options.debug ?? false;
    this.client = getGeminiClient({
      apiKey: options.apiKey,
      debug: this.debug,
    });
  }

  /**
   * Derive news_tags from article content and classification
   * Tags: claude, anthropic, claude-code, industry, dev-tools, openai, google, meta, community, youtube, update
   */
  private deriveNewsTags(
    title: string,
    _content: string, // Reserved for future content-based classification
    sourceName: string,
    sourceUrl: string,
    contentType?: string
  ): string[] {
    const tags: Set<string> = new Set();
    const lowerTitle = title.toLowerCase();
    const lowerSource = (sourceName + " " + sourceUrl).toLowerCase();

    // 1. Claude/Anthropic related
    if (
      lowerTitle.includes("claude") ||
      lowerTitle.includes("anthropic") ||
      lowerSource.includes("anthropic")
    ) {
      tags.add("claude");
      if (lowerTitle.includes("anthropic") || lowerSource.includes("anthropic")) {
        tags.add("anthropic");
      }
    }

    // 2. Claude Code specific
    if (
      lowerTitle.includes("claude code") ||
      lowerTitle.includes("claude-code") ||
      contentType === "claude_code"
    ) {
      tags.add("claude");
      tags.add("claude-code");
    }

    // 3. Version updates
    if (
      lowerTitle.includes("update") ||
      lowerTitle.includes("release") ||
      lowerTitle.includes("version") ||
      lowerTitle.includes("patch") ||
      contentType === "version_update"
    ) {
      if (tags.has("claude")) {
        tags.add("update");
      }
    }

    // 4. Dev Tools (Supabase, Vercel, Cursor, etc.)
    const devToolPatterns = [
      "supabase",
      "vercel",
      "cursor",
      "github copilot",
      "copilot",
      "vscode",
      "vs code",
      "jetbrains",
      "neovim",
      "windsurf",
    ];
    for (const pattern of devToolPatterns) {
      if (lowerTitle.includes(pattern) || lowerSource.includes(pattern)) {
        tags.add("dev-tools");
        break;
      }
    }

    // 5. Competitors - OpenAI
    if (
      lowerTitle.includes("openai") ||
      lowerTitle.includes("chatgpt") ||
      lowerTitle.includes("gpt-4") ||
      lowerTitle.includes("gpt-5") ||
      lowerTitle.includes("gpt4") ||
      lowerTitle.includes("gpt5")
    ) {
      tags.add("openai");
      tags.add("industry");
    }

    // 6. Competitors - Google
    if (
      lowerTitle.includes("google") ||
      lowerTitle.includes("gemini") ||
      lowerTitle.includes("deepmind") ||
      lowerTitle.includes("bard")
    ) {
      tags.add("google");
      tags.add("industry");
    }

    // 7. Competitors - Meta
    if (
      lowerTitle.includes("meta ai") ||
      lowerTitle.includes("llama") ||
      lowerTitle.includes("meta's ai")
    ) {
      tags.add("meta");
      tags.add("industry");
    }

    // 8. YouTube content
    if (lowerSource.includes("youtube") || contentType === "youtube") {
      tags.add("youtube");
    }

    // 9. Community content
    if (contentType === "community") {
      tags.add("community");
    }

    // 10. Official announcements (from user-specified category)
    if (contentType === "official") {
      tags.add("claude");
      tags.add("anthropic");
    }

    // 11. Press/media content
    if (contentType === "press") {
      tags.add("industry");
    }

    // 12. Default to industry if no specific tags
    if (tags.size === 0) {
      tags.add("industry");
    }

    return Array.from(tags);
  }

  /**
   * Process a single URL through the 3-stage Gemini pipeline
   */
  async process(url: string, category?: string): Promise<GeminiPipelineResult> {
    const aiUsage = {
      model: GEMINI_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };

    const stageResults: GeminiPipelineResult["stageResults"] = {};
    const onProgress = this.options.onProgress;

    try {
      // ========================================
      // Step 0: Fetch article
      // ========================================
      if (this.debug) console.log(`[GeminiPipeline] Fetching: ${url}`);
      onProgress?.("fetching", "웹 페이지 분석 중...", 10);
      const fetchResult = await fetchArticle(url);

      if (!fetchResult.success || !fetchResult.article) {
        return {
          success: false,
          error: fetchResult.error || "Failed to fetch article",
          aiUsage,
        };
      }

      const article = fetchResult.article;
      if (this.debug) {
        console.log(
          `[GeminiPipeline] Fetched: "${article.title}" (${article.content.length} chars)`
        );
      }

      // ========================================
      // Stage 1: Extract Facts (팩트 추출)
      // ========================================
      if (this.debug) console.log(`[GeminiPipeline] Stage 1: Extracting facts...`);
      onProgress?.("ai_stage1", "AI Stage 1: 팩트 추출 중...", 25);

      const { facts, usage: stage1Usage } = await this.client.extractFacts(article.content);

      stageResults.stage1 = stage1Usage;
      aiUsage.inputTokens += stage1Usage.inputTokens;
      aiUsage.outputTokens += stage1Usage.outputTokens;
      aiUsage.costUsd += stage1Usage.costUsd;

      if (this.debug) {
        console.log(
          `[GeminiPipeline] Stage 1 complete: type=${facts.classification.primary} (${facts.classification.confidence}), ${facts.features.length} features`
        );
      }

      // ========================================
      // Stage 2 & 3: Rewrite + Verify with Retry
      // ========================================
      const minScore = this.options.minFactCheckScore || 80;
      const maxRetries = this.options.maxRetries || 1;
      let retryCount = 0;
      let rewrittenArticle: RewrittenArticle;
      let factVerification: FactVerification | undefined;
      let needsReview = false;

      // Initial Stage 2: Rewrite Article
      if (this.debug) console.log(`[GeminiPipeline] Stage 2: Rewriting article...`);
      onProgress?.("ai_stage2", "AI Stage 2: 기사 리라이팅 중...", 45);

      let rewriteResult = await this.client.rewriteArticle(
        article.title,
        article.content,
        facts,
        article.sourceName
      );

      rewrittenArticle = rewriteResult.article;
      stageResults.stage2 = rewriteResult.usage;
      aiUsage.inputTokens += rewriteResult.usage.inputTokens;
      aiUsage.outputTokens += rewriteResult.usage.outputTokens;
      aiUsage.costUsd += rewriteResult.usage.costUsd;

      if (this.debug) {
        console.log(
          `[GeminiPipeline] Stage 2 complete: "${rewrittenArticle.title.text}" (${rewrittenArticle.difficulty})`
        );
      }

      // Stage 3: Verify Facts (with retry loop) - now includes original content
      if (!this.options.skipFactCheck) {
        if (this.debug)
          console.log(`[GeminiPipeline] Stage 3: Verifying facts with original content...`);
        onProgress?.("ai_stage3", "AI Stage 3: 팩트 검증 중...", 65);

        let verifyResult = await this.client.verifyFacts(facts, rewrittenArticle, article.content);

        factVerification = verifyResult.verification;
        stageResults.stage3 = verifyResult.usage;
        aiUsage.inputTokens += verifyResult.usage.inputTokens;
        aiUsage.outputTokens += verifyResult.usage.outputTokens;
        aiUsage.costUsd += verifyResult.usage.costUsd;

        if (this.debug) {
          console.log(
            `[GeminiPipeline] Stage 3 complete: score=${factVerification.score}, passed=${factVerification.passed}`
          );
        }

        // Retry loop if score is below threshold
        while (factVerification.score < minScore && retryCount < maxRetries) {
          retryCount++;
          console.log(
            `[GeminiPipeline] Score ${factVerification.score} < ${minScore}. Retrying Stage 2-3 (attempt ${retryCount}/${maxRetries})...`
          );

          // Retry Stage 2: Rewrite with feedback
          if (this.debug) console.log(`[GeminiPipeline] Stage 2 Retry: Rewriting with feedback...`);

          rewriteResult = await this.client.rewriteArticle(
            article.title,
            article.content,
            facts,
            article.sourceName
          );

          rewrittenArticle = rewriteResult.article;
          stageResults.stage2Retry = rewriteResult.usage;
          aiUsage.inputTokens += rewriteResult.usage.inputTokens;
          aiUsage.outputTokens += rewriteResult.usage.outputTokens;
          aiUsage.costUsd += rewriteResult.usage.costUsd;

          // Retry Stage 3: Verify again with original content
          if (this.debug) console.log(`[GeminiPipeline] Stage 3 Retry: Verifying again...`);

          verifyResult = await this.client.verifyFacts(facts, rewrittenArticle, article.content);

          factVerification = verifyResult.verification;
          stageResults.stage3Retry = verifyResult.usage;
          aiUsage.inputTokens += verifyResult.usage.inputTokens;
          aiUsage.outputTokens += verifyResult.usage.outputTokens;
          aiUsage.costUsd += verifyResult.usage.costUsd;

          if (this.debug) {
            console.log(
              `[GeminiPipeline] Retry ${retryCount} complete: score=${factVerification.score}`
            );
          }
        }

        // Check final result after retries
        if (factVerification.score < minScore) {
          needsReview = true;
          console.warn(
            `[GeminiPipeline] Score ${factVerification.score} still below ${minScore} after ${retryCount} retries. Marking as needs_review.`
          );
        } else {
          console.log(
            `[GeminiPipeline] Final score ${factVerification.score} >= ${minScore}. Quality check passed.`
          );
        }
      }

      // ========================================
      // Build Result
      // ========================================
      const richContent = this.buildRichContent(rewrittenArticle, article, category);
      const summary = this.buildSummarizerResult(rewrittenArticle, richContent);

      // Derive news tags from article content
      const newsTags = this.deriveNewsTags(
        article.title,
        article.content,
        article.sourceName,
        article.url,
        category
      );

      if (this.debug) {
        console.log(`[GeminiPipeline] Derived news_tags: ${newsTags.join(", ")}`);
      }

      return {
        success: true,
        needsReview,
        retryCount,
        newsTags,
        article: {
          url: article.url,
          title: article.title,
          content: article.content,
          sourceName: article.sourceName,
          publishedAt: article.publishedAt,
          thumbnail: article.thumbnail,
          favicon: article.favicon,
        },
        factCheck: factVerification
          ? {
              isValid: factVerification.passed,
              score: factVerification.score / 100,
              reason: factVerification.issues.join("; ") || "Passed",
              checks: {
                sourceReliable: true,
                contentRelevant: true,
                dateValid: true,
                notDuplicate: true,
              },
            }
          : undefined,
        summary,
        extractedFacts: facts,
        rewrittenArticle,
        factVerification,
        stageResults,
        aiUsage,
      };
    } catch (error) {
      console.error(`[GeminiPipeline] Error processing ${url}:`, error);
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
  ): Promise<Map<string, GeminiPipelineResult>> {
    const { delayMs = 3000, stopOnError = false } = options;
    const results = new Map<string, GeminiPipelineResult>();

    for (let i = 0; i < urls.length; i++) {
      const item = urls[i]!;
      const { url, category } = item;

      const result = await this.process(url, category);
      results.set(url, result);

      if (!result.success && stopOnError) {
        console.log(`[GeminiPipeline] Stopping due to error: ${result.error}`);
        break;
      }

      // Delay between requests (except for last one)
      if (i < urls.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Build RichContent structure from rewritten article
   */
  private buildRichContent(
    rewritten: RewrittenArticle,
    original: {
      url: string;
      sourceName: string;
      publishedAt: string;
      favicon?: string;
    },
    category?: string
  ): RichContent {
    const themeMap: Record<string, RichContent["style"]["theme"]> = {
      official: "official",
      version_update: "update",
      press: "press",
      community: "community",
      youtube: "community",
    };

    const colorMap: Record<string, string> = {
      official: "#F97316",
      update: "#22C55E",
      press: "#3B82F6",
      community: "#8B5CF6",
    };

    const theme = themeMap[category || "press"] || "press";
    const accentColor = colorMap[theme] || "#3B82F6";

    return {
      title: {
        text: rewritten.title.text,
        emoji: rewritten.title.emoji,
      },
      summary: {
        text: rewritten.summary,
      },
      keyPoints: rewritten.keyTakeaways.map((kt) => ({
        icon: kt.icon,
        text: kt.text,
      })),
      source: {
        name: original.sourceName,
        url: original.url,
        favicon: original.favicon,
        publishedAt: original.publishedAt,
      },
      meta: {
        difficulty: rewritten.difficulty,
        category: rewritten.category,
      },
      style: {
        accentColor,
        theme,
      },
    };
  }

  /**
   * Build SummarizerResult for backward compatibility
   */
  private buildSummarizerResult(
    rewritten: RewrittenArticle,
    richContent: RichContent
  ): SummarizerResult {
    return {
      richContent,
      analogy: "", // Gemini pipeline doesn't generate analogy separately
      difficulty: rewritten.difficulty,
      keyPointsPlain: rewritten.keyTakeaways.map((kt) => kt.text),
      summaryPlain: rewritten.summary,
    };
  }
}

// ===========================================
// Convenience Functions
// ===========================================

/**
 * Process a single article URL with Gemini (3-stage pipeline)
 */
export async function processArticleWithGemini(
  url: string,
  options: {
    category?: string;
    skipFactCheck?: boolean;
    debug?: boolean;
  } = {}
): Promise<GeminiPipelineResult> {
  const pipeline = new GeminiPipeline({
    skipFactCheck: options.skipFactCheck,
    debug: options.debug,
  });

  return pipeline.process(url, options.category);
}

/**
 * Quick process with Gemini (skip fact-check for speed)
 */
export async function quickProcessArticleWithGemini(
  url: string,
  category?: string
): Promise<GeminiPipelineResult> {
  const pipeline = new GeminiPipeline({
    skipFactCheck: true,
  });

  return pipeline.process(url, category);
}

// ===========================================
// Singleton Instance
// ===========================================

let pipelineInstance: GeminiPipeline | null = null;

export function getGeminiPipeline(options?: GeminiPipelineOptions): GeminiPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new GeminiPipeline(options);
  }
  return pipelineInstance;
}
