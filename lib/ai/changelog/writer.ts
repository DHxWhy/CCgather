/**
 * Changelog Writer - Stage 2 (Sonnet)
 *
 * Responsibilities:
 * - Generate user-friendly content from changelog entries
 * - Create FOR BEGINNERS analogies using global services
 * - Write how-to guides, tips, and use cases
 * - Produce accessible content for vibe coders
 *
 * Model: Claude Sonnet ($3/1M input, $15/1M output)
 * Cost per item: ~$0.015
 */

import Anthropic from "@anthropic-ai/sdk";
import { AI_MODELS, calculateCost } from "../types";
import type { ChangelogEntry, WriterInput, WriterOutput, PipelineStageResult } from "./types";
import { shouldHaveForBeginners } from "./types";
import { WRITER_SYSTEM_PROMPT, WRITER_USER_PROMPT, fillTemplate } from "./prompts";

// ============================================
// Writer Class
// ============================================

export class ChangelogWriter {
  private client: Anthropic;
  private model = AI_MODELS.SONNET;

  constructor() {
    this.client = new Anthropic();
  }

  /**
   * Generate user-friendly content for a changelog entry
   */
  async write(input: WriterInput): Promise<PipelineStageResult<WriterOutput>> {
    const startTime = Date.now();

    try {
      // Determine if FOR BEGINNERS is required
      const forBeginnersLevel = shouldHaveForBeginners(
        input.entry.category,
        input.entry.isHighlight
      );
      const forBeginnersRequired =
        forBeginnersLevel === "required" || forBeginnersLevel === "recommended";

      // Build prompt
      const userPrompt = fillTemplate(WRITER_USER_PROMPT, {
        version: input.version,
        entry: input.entry,
        targetAudience: input.targetAudience,
        forBeginnersRequired,
      });

      // Call Sonnet
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: WRITER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      // Extract text content
      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text response from writer");
      }

      // Parse JSON from response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in writer response");
      }

      const result = JSON.parse(jsonMatch[0]) as WriterOutput;

      // Calculate cost
      const costUsd = calculateCost(
        this.model,
        response.usage.input_tokens,
        response.usage.output_tokens
      );

      console.log(
        `[Writer] Generated "${result.title}" ` +
          `(${Date.now() - startTime}ms, $${costUsd.toFixed(4)})`
      );

      return {
        success: true,
        result,
        usage: {
          model: this.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          costUsd,
        },
      };
    } catch (error) {
      console.error("[Writer] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Writer failed",
        usage: {
          model: this.model,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
        },
      };
    }
  }

  /**
   * Generate content for multiple entries
   */
  async writeMany(
    entries: Array<{ entry: ChangelogEntry; version: string }>,
    options: {
      targetAudience?: WriterInput["targetAudience"];
      delayMs?: number;
      concurrency?: number;
    } = {}
  ): Promise<PipelineStageResult<WriterOutput>[]> {
    const { targetAudience = "beginner", delayMs = 1500, concurrency = 3 } = options;

    const results: PipelineStageResult<WriterOutput>[] = [];

    // Process in batches for concurrency control
    for (let i = 0; i < entries.length; i += concurrency) {
      const batch = entries.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map((item) =>
          this.write({
            entry: item.entry,
            version: item.version,
            targetAudience,
          })
        )
      );

      results.push(...batchResults);

      // Delay between batches
      if (i + concurrency < entries.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }
}

// ============================================
// Singleton Instance
// ============================================

let writerInstance: ChangelogWriter | null = null;

export function getChangelogWriter(): ChangelogWriter {
  if (!writerInstance) {
    writerInstance = new ChangelogWriter();
  }
  return writerInstance;
}

// ============================================
// Helper: Generate Slug
// ============================================

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// ============================================
// Helper: Estimate Content Difficulty
// ============================================

export function estimateDifficulty(entry: ChangelogEntry): "easy" | "medium" | "hard" {
  const text = `${entry.title} ${entry.description}`.toLowerCase();

  // Hard indicators
  const hardTerms = [
    "api",
    "protocol",
    "architecture",
    "optimization",
    "performance",
    "concurrent",
    "async",
    "daemon",
    "kernel",
    "binary",
  ];

  // Easy indicators
  const easyTerms = ["simple", "basic", "quick", "easy", "start", "hello", "first", "introduction"];

  const hasHard = hardTerms.some((term) => text.includes(term));
  const hasEasy = easyTerms.some((term) => text.includes(term));

  if (hasHard && !hasEasy) return "hard";
  if (hasEasy && !hasHard) return "easy";
  return "medium";
}
