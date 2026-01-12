/**
 * Changelog Collector - Stage 1 (Haiku)
 *
 * Responsibilities:
 * - Parse official changelog HTML/Markdown
 * - Extract structured version and entry data
 * - Categorize changes
 * - Flag potential highlights
 *
 * Model: Claude Haiku ($0.80/1M input, $4.00/1M output)
 * Cost per changelog: ~$0.001
 */

import Anthropic from "@anthropic-ai/sdk";
import { AI_MODELS, calculateCost } from "../types";
import type { CollectorInput, CollectorOutput, PipelineStageResult } from "./types";
import { COLLECTOR_SYSTEM_PROMPT, COLLECTOR_USER_PROMPT, fillTemplate } from "./prompts";

// ============================================
// Collector Class
// ============================================

export class ChangelogCollector {
  private client: Anthropic;
  private model = AI_MODELS.HAIKU;

  constructor() {
    this.client = new Anthropic();
  }

  /**
   * Parse changelog content and extract structured data
   */
  async collect(input: CollectorInput): Promise<PipelineStageResult<CollectorOutput>> {
    const startTime = Date.now();

    try {
      // Build prompt
      const userPrompt = fillTemplate(COLLECTOR_USER_PROMPT, {
        sourceUrl: input.sourceUrl,
        versionHint: input.versionHint,
        htmlContent: input.htmlContent || "[No content provided - fetch from URL]",
      });

      // Call Haiku
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: COLLECTOR_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      // Extract text content
      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text response from collector");
      }

      // Parse JSON from response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in collector response");
      }

      const result = JSON.parse(jsonMatch[0]) as CollectorOutput;

      // Calculate cost
      const costUsd = calculateCost(
        this.model,
        response.usage.input_tokens,
        response.usage.output_tokens
      );

      console.log(
        `[Collector] Parsed v${result.version} with ${result.entries.length} entries ` +
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
      console.error("[Collector] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Collector failed",
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
   * Parse multiple changelog versions
   */
  async collectMany(
    inputs: CollectorInput[],
    options: { delayMs?: number } = {}
  ): Promise<PipelineStageResult<CollectorOutput>[]> {
    const { delayMs = 1000 } = options;
    const results: PipelineStageResult<CollectorOutput>[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]!;
      const result = await this.collect(input);
      results.push(result);

      // Delay between requests
      if (i < inputs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }
}

// ============================================
// Singleton Instance
// ============================================

let collectorInstance: ChangelogCollector | null = null;

export function getChangelogCollector(): ChangelogCollector {
  if (!collectorInstance) {
    collectorInstance = new ChangelogCollector();
  }
  return collectorInstance;
}

// ============================================
// Helper: Fetch Changelog from URL
// ============================================

export async function fetchChangelogContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();

    // Extract main content (simple extraction)
    // In production, use a proper HTML parser
    const mainContentMatch =
      html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
      html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
      html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    if (mainContentMatch) {
      // Strip HTML tags for simpler processing
      return mainContentMatch[1]!
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 50000); // Limit content size
    }

    return html.slice(0, 50000);
  } catch (error) {
    console.error("[Collector] Fetch error:", error);
    throw error;
  }
}
