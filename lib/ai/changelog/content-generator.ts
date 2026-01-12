/**
 * Changelog Content Generator - Stage 2 (Opus 4.5)
 *
 * Single-pass high-quality content generation:
 * - Generate user-friendly content from changelog entries
 * - Create FOR BEGINNERS analogies
 * - Self-verify for accuracy and quality
 *
 * Model: Claude Opus 4.5 ($15/1M input, $75/1M output)
 * Cost per item: ~$0.03-0.05
 */

import Anthropic from "@anthropic-ai/sdk";
import { AI_MODELS, calculateCost } from "../types";
import type { ChangelogEntry, WriterInput, WriterOutput, PipelineStageResult } from "./types";
import { shouldHaveForBeginners } from "./types";

// ============================================
// Opus Content Generator Prompt
// ============================================

const OPUS_CONTENT_GENERATOR_PROMPT = `당신은 CCgather의 수석 테크니컬 라이터입니다.
Claude Code 변경사항을 일반 사용자가 이해할 수 있도록 고품질 콘텐츠를 생성합니다.

## 대상 독자
"Vibe Coders" - AI 코딩 도구를 사용하고 싶지만 전통적인 개발자가 아닌 사람들.

## 작성 원칙

### 1. 친근한 언어
- 전문 용어 대신 일상 언어 사용
- 기술 개념은 비유로 설명
- 간결하지만 완전한 설명

### 2. FOR BEGINNERS 비유 (글로벌 서비스만 사용)
승인된 서비스: Netflix, Instagram, YouTube, Spotify, Gmail, Google Maps, Amazon, WhatsApp, Uber, Airbnb

예시:
- Hot-reload: "인스타그램 프로필 수정처럼 - 로그아웃 없이 바로 반영됩니다"
- --resume: "넷플릭스 '이어보기'처럼 - 정확히 멈춘 곳에서 다시 시작"
- .claudeignore: "이사할 때 '이 방은 건너뛰세요'라고 말하는 것처럼"
- Background agents: "배달앱처럼 - 주문하고 다른 일 하다가 알림 받기"
- MCP: "스마트폰 앱스토어처럼 - 기기 하나로 무한한 기능 확장"

### 3. 실용적인 내용
- 구체적인 사용 방법 포함
- 실제 사용 시나리오 제시
- 프로 팁 추가

## 입력 정보

버전: {{version}}
제목: {{title}}
설명: {{description}}
카테고리: {{category}}
하이라이트 여부: {{isHighlight}}
{{#if commands}}명령어: {{commands}}{{/if}}

대상 독자 수준: {{targetAudience}}
FOR BEGINNERS 필수: {{forBeginnersRequired}}

## 출력 형식 (JSON)

\`\`\`json
{
  "slug": "feature-name-slug",
  "title": "사용자 친화적 한글 제목 (20자 이내)",
  "overview": "2-3문장 개요 (핵심을 명확하게)",
  "howToUse": "단계별 사용 방법 (마크다운 지원)",
  "useCases": ["실제 사용 사례 1", "사용 사례 2", "사용 사례 3"],
  "tips": ["💡 프로 팁 1", "💡 프로 팁 2"],
  "forBeginners": {
    "analogy": "글로벌 서비스를 활용한 일상 비유",
    "explanation": "비유를 활용한 쉬운 설명",
    "whenToUse": "언제 이 기능을 사용하면 좋은지"
  },
  "commands": ["명령어 구문"],
  "difficulty": "easy|medium|hard",
  "category": "카테고리",
  "isHighlight": true/false,
  "confidence": 85-100
}
\`\`\`

## 품질 기준

### 정확성 (필수)
- 원본 변경사항과 일치하는 정보만 포함
- 추측이나 과장 없이 팩트만 전달

### 비유 품질 (필수)
- 글로벌 서비스만 사용 (국가별 서비스 금지)
- 기술 개념과 비유의 연결이 자연스러워야 함

### 완전성
- 사용자가 바로 적용할 수 있는 정보 포함
- 중요한 측면 누락 없이 전달

### 명확성
- 비개발자도 이해할 수 있는 수준
- 스캔하기 쉬운 구조

## 신뢰도 점수 기준
- 95-100: 완벽한 품질, 즉시 게시 가능
- 85-94: 우수한 품질, 확인 후 게시
- 70-84: 일부 수정 필요
- 70 미만: 재작성 필요

## 중요 규칙
1. 반드시 JSON 형식으로만 응답
2. FOR BEGINNERS가 필수인 경우 반드시 포함
3. 한글로 작성 (기술 용어는 원어 유지 가능)
4. 신뢰도 점수는 솔직하게 자체 평가
5. 비유에 국가별 서비스(카카오톡, 라인 등) 절대 사용 금지

JSON만 응답:`;

// ============================================
// Content Generator Class
// ============================================

export class ChangelogContentGenerator {
  private client: Anthropic;
  private model = AI_MODELS.OPUS;

  constructor() {
    this.client = new Anthropic();
  }

  /**
   * Generate high-quality content for a changelog entry
   */
  async generate(input: WriterInput): Promise<PipelineStageResult<WriterOutput>> {
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
      const userPrompt = this.buildPrompt({
        version: input.version,
        entry: input.entry,
        targetAudience: input.targetAudience,
        forBeginnersRequired,
      });

      // Call Opus 4.5
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: "user", content: userPrompt }],
      });

      // Extract text content
      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text response from content generator");
      }

      // Parse JSON from response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in content generator response");
      }

      const result = JSON.parse(jsonMatch[0]) as WriterOutput;

      // Calculate cost
      const costUsd = calculateCost(
        this.model,
        response.usage.input_tokens,
        response.usage.output_tokens
      );

      console.log(
        `[ContentGenerator] Generated "${result.title}" ` +
          `(${Date.now() - startTime}ms, $${costUsd.toFixed(4)}, confidence: ${result.confidence || "N/A"})`
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
      console.error("[ContentGenerator] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Content generator failed",
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
   * Build the prompt with template substitution
   */
  private buildPrompt(data: {
    version: string;
    entry: ChangelogEntry;
    targetAudience: string;
    forBeginnersRequired: boolean;
  }): string {
    let result = OPUS_CONTENT_GENERATOR_PROMPT;

    // Simple replacements
    result = result.replace(/\{\{version\}\}/g, data.version);
    result = result.replace(/\{\{title\}\}/g, data.entry.title);
    result = result.replace(/\{\{description\}\}/g, data.entry.description);
    result = result.replace(/\{\{category\}\}/g, data.entry.category);
    result = result.replace(/\{\{isHighlight\}\}/g, String(data.entry.isHighlight));
    result = result.replace(/\{\{targetAudience\}\}/g, data.targetAudience);
    result = result.replace(/\{\{forBeginnersRequired\}\}/g, String(data.forBeginnersRequired));

    // Handle commands conditional
    if (data.entry.commands && data.entry.commands.length > 0) {
      result = result.replace(
        /\{\{#if commands\}\}(.+?)\{\{\/if\}\}/g,
        data.entry.commands.join(", ")
      );
    } else {
      result = result.replace(/\{\{#if commands\}\}.+?\{\{\/if\}\}/g, "");
    }

    return result;
  }

  /**
   * Generate content for multiple entries
   */
  async generateMany(
    entries: Array<{ entry: ChangelogEntry; version: string }>,
    options: {
      targetAudience?: WriterInput["targetAudience"];
      delayMs?: number;
      concurrency?: number;
    } = {}
  ): Promise<PipelineStageResult<WriterOutput>[]> {
    const {
      targetAudience = "beginner",
      delayMs = 2000,
      concurrency = 2, // Lower concurrency for Opus
    } = options;

    const results: PipelineStageResult<WriterOutput>[] = [];

    // Process in batches for concurrency control
    for (let i = 0; i < entries.length; i += concurrency) {
      const batch = entries.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map((item) =>
          this.generate({
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

let generatorInstance: ChangelogContentGenerator | null = null;

export function getChangelogContentGenerator(): ChangelogContentGenerator {
  if (!generatorInstance) {
    generatorInstance = new ChangelogContentGenerator();
  }
  return generatorInstance;
}
