/**
 * Opus Fact Checker - High-quality verification using Claude Opus 4.5
 *
 * Verifies that AI-generated summaries accurately reflect the original content
 * Stage 3 of the News Pipeline: Haiku(collect) → Opus(summarize) → Opus(fact-check)
 *
 * Model: Claude Opus 4.5 ($15/1M input, $75/1M output)
 */

import Anthropic from "@anthropic-ai/sdk";
import { AI_MODELS, calculateCost, type SummarizerResult, type RichContent } from "./types";

// ============================================
// Fact Check Types
// ============================================

export interface FactCheckInput {
  originalTitle: string;
  originalContent: string;
  originalUrl: string;
  sourceName: string;
  generatedSummary: SummarizerResult;
}

export interface FactCheckOutput {
  isAccurate: boolean;
  confidence: number; // 0-100
  accuracy: {
    titleAccuracy: number; // 0-100
    summaryAccuracy: number; // 0-100
    keyPointsAccuracy: number; // 0-100
  };
  issues: Array<{
    type: "factual_error" | "exaggeration" | "omission" | "misattribution";
    severity: "low" | "medium" | "high";
    description: string;
    suggestion?: string;
  }>;
  correctedContent?: Partial<RichContent>;
  reason: string;
}

// ============================================
// Opus Fact Checker Prompt
// ============================================

const OPUS_FACT_CHECK_PROMPT = `당신은 CCgather 뉴스 플랫폼의 팩트체커입니다.
AI가 생성한 요약이 원문을 정확하게 반영하는지 검증합니다.

## 원문 정보
- **제목**: {originalTitle}
- **출처**: {sourceName}
- **URL**: {originalUrl}

**원문 내용** (발췌):
---
{originalContent}
---

## AI 생성 요약
- **제목**: {summaryTitle}
- **요약**: {summaryText}
- **핵심 포인트**:
{keyPoints}
- **비유**: {analogy}

## 검증 기준

### 1. 제목 정확성 (titleAccuracy)
- 원문의 핵심 메시지를 정확히 전달하는가?
- 과장이나 선정적 표현이 없는가?

### 2. 요약 정확성 (summaryAccuracy)
- 원문에 있는 사실만 포함하는가?
- 원문에 없는 정보를 추가하지 않았는가?
- 중요한 정보가 누락되지 않았는가?

### 3. 핵심 포인트 정확성 (keyPointsAccuracy)
- 각 포인트가 원문에서 확인 가능한가?
- 포인트들이 원문의 핵심을 잘 담고 있는가?

## 오류 유형
- **factual_error**: 원문과 다른 사실 기술
- **exaggeration**: 과장 또는 과소 표현
- **omission**: 중요 정보 누락
- **misattribution**: 잘못된 출처 또는 인용

## 출력 형식 (JSON)

\`\`\`json
{
  "isAccurate": true/false,
  "confidence": 0-100,
  "accuracy": {
    "titleAccuracy": 0-100,
    "summaryAccuracy": 0-100,
    "keyPointsAccuracy": 0-100
  },
  "issues": [
    {
      "type": "factual_error|exaggeration|omission|misattribution",
      "severity": "low|medium|high",
      "description": "구체적인 문제 설명",
      "suggestion": "수정 제안 (선택)"
    }
  ],
  "correctedContent": {
    "title": { "text": "수정된 제목", "emoji": "📰" },
    "summary": { "text": "수정된 요약" }
  },
  "reason": "전체 평가 요약 (한글)"
}
\`\`\`

## 평가 기준
- **95-100**: 완벽하게 정확, 수정 불필요
- **85-94**: 대체로 정확, 사소한 개선 가능
- **70-84**: 일부 수정 필요
- **50-69**: 상당한 수정 필요
- **50 미만**: 재작성 권장

## 중요 규칙
1. 반드시 JSON 형식으로만 응답
2. 원문에 명시된 사실만 기준으로 판단
3. 추측이나 해석은 오류로 표시
4. correctedContent는 수정이 필요한 경우만 포함
5. 한글로 reason과 description 작성

JSON만 응답:`;

// ============================================
// Opus Fact Checker Class
// ============================================

interface OpusFactCheckerOptions {
  apiKey?: string;
  minAccuracy?: number; // Minimum accuracy to pass (default: 80)
}

export class OpusFactChecker {
  private client: Anthropic;
  private model = AI_MODELS.OPUS;
  private minAccuracy: number;

  constructor(options: OpusFactCheckerOptions = {}) {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required");
    }
    this.client = new Anthropic({ apiKey });
    this.minAccuracy = options.minAccuracy ?? 80;
  }

  /**
   * Verify generated summary against original content
   */
  async verify(input: FactCheckInput): Promise<{
    result: FactCheckOutput;
    usage: { inputTokens: number; outputTokens: number; costUsd: number };
  }> {
    // Format key points for prompt
    const keyPointsStr = input.generatedSummary.keyPointsPlain
      .map((kp, i) => `  ${i + 1}. ${kp}`)
      .join("\n");

    // Build prompt
    const prompt = OPUS_FACT_CHECK_PROMPT.replace("{originalTitle}", input.originalTitle)
      .replace("{sourceName}", input.sourceName)
      .replace("{originalUrl}", input.originalUrl)
      .replace("{originalContent}", input.originalContent.slice(0, 4000))
      .replace("{summaryTitle}", input.generatedSummary.richContent.title.text)
      .replace("{summaryText}", input.generatedSummary.summaryPlain)
      .replace("{keyPoints}", keyPointsStr)
      .replace("{analogy}", input.generatedSummary.analogy || "없음");

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
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
        throw new Error("No text response from Opus");
      }

      // Parse JSON response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Invalid JSON response from Opus");
      }

      const result: FactCheckOutput = JSON.parse(jsonMatch[0]);

      // Calculate usage
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const costUsd = calculateCost(this.model, inputTokens, outputTokens);

      console.log(
        `[OpusFactChecker] Verified: confidence=${result.confidence}, ` +
          `accuracy=${Math.round((result.accuracy.titleAccuracy + result.accuracy.summaryAccuracy + result.accuracy.keyPointsAccuracy) / 3)}%`
      );

      return {
        result,
        usage: { inputTokens, outputTokens, costUsd },
      };
    } catch (error) {
      console.error("[OpusFactChecker] Error:", error);

      // Return conservative result on error
      return {
        result: {
          isAccurate: false,
          confidence: 0,
          accuracy: {
            titleAccuracy: 0,
            summaryAccuracy: 0,
            keyPointsAccuracy: 0,
          },
          issues: [
            {
              type: "factual_error",
              severity: "high",
              description:
                "팩트체크 중 오류 발생: " + (error instanceof Error ? error.message : "Unknown"),
            },
          ],
          reason: "팩트체크 실패",
        },
        usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      };
    }
  }

  /**
   * Check if result passes minimum accuracy
   */
  isAccepted(result: FactCheckOutput): boolean {
    const avgAccuracy =
      (result.accuracy.titleAccuracy +
        result.accuracy.summaryAccuracy +
        result.accuracy.keyPointsAccuracy) /
      3;
    return result.isAccurate && avgAccuracy >= this.minAccuracy;
  }

  /**
   * Get corrected content if available
   */
  getCorrectedContent(original: SummarizerResult, factCheck: FactCheckOutput): SummarizerResult {
    if (!factCheck.correctedContent) {
      return original;
    }

    // Merge corrections with original
    const corrected = { ...original };
    corrected.richContent = {
      ...original.richContent,
      ...(factCheck.correctedContent.title && { title: factCheck.correctedContent.title }),
      ...(factCheck.correctedContent.summary && { summary: factCheck.correctedContent.summary }),
    };

    if (factCheck.correctedContent.title) {
      corrected.richContent.title = {
        ...original.richContent.title,
        ...factCheck.correctedContent.title,
      };
    }

    if (factCheck.correctedContent.summary) {
      corrected.richContent.summary = {
        ...original.richContent.summary,
        ...factCheck.correctedContent.summary,
      };
      corrected.summaryPlain = factCheck.correctedContent.summary.text || original.summaryPlain;
    }

    return corrected;
  }
}

// ============================================
// Factory Functions
// ============================================

let factCheckerInstance: OpusFactChecker | null = null;

export function getOpusFactChecker(options?: OpusFactCheckerOptions): OpusFactChecker {
  if (!factCheckerInstance) {
    factCheckerInstance = new OpusFactChecker(options);
  }
  return factCheckerInstance;
}
