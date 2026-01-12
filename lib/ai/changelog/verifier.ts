/**
 * Changelog Verifier - Stage 3 (Opus)
 *
 * Responsibilities:
 * - Fact-check generated content against official docs
 * - Verify technical accuracy
 * - Assess analogy quality (global services only)
 * - Calculate confidence score
 * - Determine publish status (auto/confirm/revision/manual)
 *
 * Model: Claude Opus ($15/1M input, $75/1M output)
 * Cost per item: ~$0.075
 */

import Anthropic from "@anthropic-ai/sdk";
import { AI_MODELS, calculateCost } from "../types";
import type { VerifierInput, VerifierOutput, PipelineStageResult } from "./types";
import { getVerificationStatus, APPROVED_ANALOGIES } from "./types";
import { VERIFIER_SYSTEM_PROMPT, VERIFIER_USER_PROMPT, fillTemplate } from "./prompts";

// ============================================
// Verifier Class
// ============================================

export class ChangelogVerifier {
  private client: Anthropic;
  private model = AI_MODELS.OPUS;

  constructor() {
    this.client = new Anthropic();
  }

  /**
   * Verify generated content for accuracy and quality
   */
  async verify(input: VerifierInput): Promise<PipelineStageResult<VerifierOutput>> {
    const startTime = Date.now();

    try {
      // Build prompt
      const userPrompt = fillTemplate(VERIFIER_USER_PROMPT, {
        originalEntry: input.originalEntry,
        sourceUrl: input.sourceUrl,
        generatedContent: JSON.stringify(input.generatedContent, null, 2),
      });

      // Call Opus
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: VERIFIER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      // Extract text content
      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text response from verifier");
      }

      // Parse JSON from response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in verifier response");
      }

      const rawResult = JSON.parse(jsonMatch[0]);

      // Ensure status matches confidence
      const result: VerifierOutput = {
        ...rawResult,
        status: getVerificationStatus(rawResult.confidence),
      };

      // Calculate cost
      const costUsd = calculateCost(
        this.model,
        response.usage.input_tokens,
        response.usage.output_tokens
      );

      console.log(
        `[Verifier] Confidence: ${result.confidence}% → ${result.status} ` +
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
      console.error("[Verifier] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Verifier failed",
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
   * Verify multiple items
   */
  async verifyMany(
    inputs: VerifierInput[],
    options: { delayMs?: number } = {}
  ): Promise<PipelineStageResult<VerifierOutput>[]> {
    const { delayMs = 2000 } = options;
    const results: PipelineStageResult<VerifierOutput>[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]!;
      const result = await this.verify(input);
      results.push(result);

      // Delay between requests (Opus rate limits)
      if (i < inputs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Quick validation without full verification
   * Uses local checks only (no API call)
   */
  quickValidate(content: VerifierInput["generatedContent"]): {
    passed: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check FOR BEGINNERS analogy
    if (content.forBeginners) {
      const analogy = content.forBeginners.analogy.toLowerCase();
      const hasApprovedService = APPROVED_ANALOGIES.services.some((service) =>
        analogy.includes(service.toLowerCase())
      );

      if (!hasApprovedService) {
        issues.push(
          "FOR BEGINNERS analogy should use approved global services " +
            "(Netflix, Instagram, YouTube, etc.)"
        );
      }

      // Check for country-specific services
      const bannedServices = ["kakaotalk", "kakao", "line", "wechat", "naver"];
      const hasBannedService = bannedServices.some((service) => analogy.includes(service));

      if (hasBannedService) {
        issues.push(
          "FOR BEGINNERS analogy uses country-specific service. " + "Use global services only."
        );
      }
    }

    // Check required fields
    if (!content.slug) issues.push("Missing slug");
    if (!content.title) issues.push("Missing title");
    if (!content.overview) issues.push("Missing overview");
    if (!content.howToUse) issues.push("Missing howToUse");

    // Check array fields
    if (!content.useCases || content.useCases.length === 0) {
      issues.push("Missing use cases");
    }

    return {
      passed: issues.length === 0,
      issues,
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

let verifierInstance: ChangelogVerifier | null = null;

export function getChangelogVerifier(): ChangelogVerifier {
  if (!verifierInstance) {
    verifierInstance = new ChangelogVerifier();
  }
  return verifierInstance;
}

// ============================================
// Helper: Calculate Overall Confidence
// ============================================

export function calculateOverallConfidence(checks: VerifierOutput["checks"]): number {
  const weights = {
    factualAccuracy: 0.35,
    technicalCorrectness: 0.25,
    clarity: 0.2,
    completeness: 0.15,
    analogyQuality: 0.05,
  };

  let score = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const check = checks[key as keyof typeof checks];
    if (check) {
      score += check.passed ? weight * 100 : 0;
      totalWeight += weight;
    }
  }

  return Math.round(score / totalWeight);
}

// ============================================
// Helper: Generate Verification Summary
// ============================================

export function generateVerificationSummary(result: VerifierOutput): string {
  const passedCount = Object.values(result.checks).filter((c) => c.passed).length;
  const totalChecks = Object.keys(result.checks).length;

  const statusEmoji = {
    auto: "✅",
    confirm: "🔍",
    revision: "📝",
    manual: "⚠️",
  };

  return (
    `${statusEmoji[result.status]} Confidence: ${result.confidence}% | ` +
    `Checks: ${passedCount}/${totalChecks} passed | ` +
    `Status: ${result.status.toUpperCase()}`
  );
}
