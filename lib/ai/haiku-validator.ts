/**
 * Haiku Fact Checker - Fast validation using Claude Haiku
 * Validates article relevance, source reliability, and content quality
 */

import Anthropic from "@anthropic-ai/sdk";
import { AI_MODELS, calculateCost, type FactCheckInput, type FactCheckResult } from "./types";

// Trusted sources list
const TRUSTED_SOURCES = [
  "anthropic.com",
  "anthropic",
  "claude.ai",
  "techcrunch.com",
  "techcrunch",
  "theverge.com",
  "the verge",
  "arstechnica.com",
  "ars technica",
  "wired.com",
  "wired",
  "venturebeat.com",
  "venturebeat",
  "news.ycombinator.com",
  "hacker news",
  "dev.to",
  "medium.com",
  "github.com",
  "github",
  "openai.com",
  "openai",
  "deepmind.google",
  "deepmind",
];

// Keywords for relevance check
const RELEVANT_KEYWORDS = [
  "claude",
  "anthropic",
  "claude code",
  "ai assistant",
  "llm",
  "large language model",
  "ai coding",
  "ai development",
  "mcp",
  "model context protocol",
  "sonnet",
  "opus",
  "haiku",
];

const FACT_CHECK_PROMPT = `You are a fast fact-checker for a Claude Code news platform.
Evaluate this article for inclusion in our news feed.

## Article to Check
- **URL**: {url}
- **Title**: {title}
- **Source**: {source}
- **Published**: {publishedAt}
- **Content Preview** (first 1500 chars):
{content}

## Check Criteria
1. **Source Reliability**: Is this from a trusted tech news source?
2. **Content Relevance**: Is this about Claude, Anthropic, AI development, or Claude Code?
3. **Date Validity**: Is the date valid and recent (within 30 days)?
4. **Not Duplicate/Spam**: Does this appear to be original news content?

## Response Format (JSON only)
{
  "isValid": boolean,
  "score": number (0.0-1.0),
  "reason": "Brief explanation in Korean",
  "checks": {
    "sourceReliable": boolean,
    "contentRelevant": boolean,
    "dateValid": boolean,
    "notDuplicate": boolean
  }
}

Respond with ONLY the JSON object, no other text.`;

interface HaikuValidatorOptions {
  apiKey?: string;
  minScore?: number;
}

export class HaikuValidator {
  private client: Anthropic;
  private minScore: number;

  constructor(options: HaikuValidatorOptions = {}) {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required");
    }
    this.client = new Anthropic({ apiKey });
    this.minScore = options.minScore ?? 0.7;
  }

  /**
   * Quick pre-check before calling AI (saves tokens)
   */
  private quickPreCheck(input: FactCheckInput): Partial<FactCheckResult> | null {
    const { title, content, sourceName } = input;
    const lowerTitle = title.toLowerCase();
    const lowerContent = content.toLowerCase();
    const lowerSource = sourceName.toLowerCase();

    // Check source trust
    const sourceReliable = TRUSTED_SOURCES.some(
      (s) => lowerSource.includes(s) || input.url.toLowerCase().includes(s)
    );

    // Check content relevance (quick keyword scan)
    const hasRelevantKeyword = RELEVANT_KEYWORDS.some(
      (k) => lowerTitle.includes(k) || lowerContent.includes(k)
    );

    // If obviously irrelevant, reject early
    if (!hasRelevantKeyword && !sourceReliable) {
      return {
        isValid: false,
        score: 0.2,
        reason: "관련 키워드가 없고 신뢰할 수 있는 출처가 아닙니다",
        checks: {
          sourceReliable: false,
          contentRelevant: false,
          dateValid: true,
          notDuplicate: true,
        },
      };
    }

    // If from Anthropic official, high trust
    if (lowerSource.includes("anthropic") || input.url.includes("anthropic.com")) {
      return {
        isValid: true,
        score: 0.95,
        reason: "Anthropic 공식 출처",
        checks: {
          sourceReliable: true,
          contentRelevant: true,
          dateValid: true,
          notDuplicate: true,
        },
      };
    }

    return null; // Need AI check
  }

  /**
   * Validate article using Haiku
   */
  async validate(
    input: FactCheckInput
  ): Promise<{
    result: FactCheckResult;
    usage: { inputTokens: number; outputTokens: number; costUsd: number };
  }> {
    // Quick pre-check
    const preCheckResult = this.quickPreCheck(input);
    if (preCheckResult) {
      return {
        result: preCheckResult as FactCheckResult,
        usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      };
    }

    // Prepare prompt
    const prompt = FACT_CHECK_PROMPT.replace("{url}", input.url)
      .replace("{title}", input.title)
      .replace("{source}", input.sourceName)
      .replace("{publishedAt}", input.publishedAt || "Unknown")
      .replace("{content}", input.content.slice(0, 1500));

    try {
      const response = await this.client.messages.create({
        model: AI_MODELS.HAIKU,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      // Extract text content
      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text response from Haiku");
      }

      // Parse JSON response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Invalid JSON response from Haiku");
      }

      const result: FactCheckResult = JSON.parse(jsonMatch[0]);

      // Calculate usage
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const costUsd = calculateCost(AI_MODELS.HAIKU, inputTokens, outputTokens);

      return {
        result,
        usage: { inputTokens, outputTokens, costUsd },
      };
    } catch (error) {
      console.error("[HaikuValidator] Error:", error);

      // Return conservative result on error
      return {
        result: {
          isValid: false,
          score: 0,
          reason: "검증 중 오류 발생: " + (error instanceof Error ? error.message : "Unknown"),
          checks: {
            sourceReliable: false,
            contentRelevant: false,
            dateValid: false,
            notDuplicate: false,
          },
        },
        usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      };
    }
  }

  /**
   * Check if result passes minimum score
   */
  isAccepted(result: FactCheckResult): boolean {
    return result.isValid && result.score >= this.minScore;
  }
}

// Singleton instance
let validatorInstance: HaikuValidator | null = null;

export function getHaikuValidator(options?: HaikuValidatorOptions): HaikuValidator {
  if (!validatorInstance) {
    validatorInstance = new HaikuValidator(options);
  }
  return validatorInstance;
}
