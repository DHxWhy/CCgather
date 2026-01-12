/**
 * Opus Summarizer - High-quality rich content generation using Claude Opus 4.5
 *
 * Features:
 * - Length-based summary tiers (consistent information density)
 * - Rich structured content with visual hierarchy
 * - Analogies for complex concepts
 * - Category-based theming and colors
 * - Source attribution with favicon
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  AI_MODELS,
  TOKEN_COSTS,
  calculateCost,
  CATEGORY_COLORS,
  CATEGORY_THEMES,
  type SummarizerInput,
  type SummarizerResult,
  type RichContent,
} from "./types";

// ============================================
// Summary Length Tiers
// ============================================

interface SummaryTier {
  maxContentLength: number;
  summaryMaxChars: number;
  keyPointsCount: number;
  label: string;
}

const SUMMARY_TIERS: SummaryTier[] = [
  {
    maxContentLength: 500,
    summaryMaxChars: 80,
    keyPointsCount: 2,
    label: "short",
  },
  {
    maxContentLength: 2000,
    summaryMaxChars: 150,
    keyPointsCount: 3,
    label: "medium",
  },
  {
    maxContentLength: Infinity,
    summaryMaxChars: 250,
    keyPointsCount: 4,
    label: "long",
  },
];

function getSummaryTier(contentLength: number): SummaryTier {
  for (const tier of SUMMARY_TIERS) {
    if (contentLength <= tier.maxContentLength) {
      return tier;
    }
  }
  // Always return the last tier as fallback
  return SUMMARY_TIERS[SUMMARY_TIERS.length - 1] as SummaryTier;
}

// ============================================
// Opus Summarizer Prompt
// ============================================

const OPUS_SUMMARIZER_PROMPT = `당신은 CCgather 뉴스 플랫폼의 수석 콘텐츠 에디터입니다.
개발자 커뮤니티의 중고등학생도 이해할 수 있으면서, 너무 유치하지 않은 수준으로 뉴스를 요약합니다.

## 요약 대상 기사
- **제목**: {title}
- **출처**: {sourceName}
- **URL**: {url}
- **발행일**: {publishedAt}
- **원문 길이**: {contentLength}자

---
**원문 내용**:
{content}
---

## 핵심 원칙

### 1. 정확성 최우선
- 원문의 팩트를 왜곡하지 않습니다
- 추측이나 과장을 추가하지 않습니다
- 출처 정보를 정확히 전달합니다

### 2. 친근한 비유 (필수)
일상적인 비유로 기술 개념을 쉽게 설명합니다.
예시:
- "API 키는 앱의 신분증 같은 거예요"
- "토큰은 AI와 대화할 때 쓰는 말의 단위예요"
- "캐싱은 자주 쓰는 답변을 메모해두는 것과 같아요"
- "컨텍스트 윈도우는 AI가 기억할 수 있는 대화 범위예요"

### 3. 요약 길이 기준 (엄격 준수)
현재 원문은 **{tierLabel}** 기사입니다:
- 요약: **{summaryMaxChars}자 이내** (반드시 준수)
- 핵심 포인트: **{keyPointsCount}개**

## 카테고리 정보
- 카테고리: {category}
- 테마 색상: {accentColor}

## 출력 형식 (JSON)

\`\`\`json
{
  "title": {
    "text": "명확하고 흥미로운 한글 제목 (20자 이내)",
    "emoji": "📰"
  },
  "summary": {
    "text": "핵심 내용 요약 ({summaryMaxChars}자 이내, 반드시 준수!)",
    "analogy": {
      "text": "💡 쉽게 말하면: [일상 비유로 핵심 개념 설명]",
      "icon": "💡"
    }
  },
  "keyPoints": [
    { "icon": "✅", "text": "핵심 포인트 1 (30자 이내)", "highlight": "coral" },
    { "icon": "🔧", "text": "핵심 포인트 2 (30자 이내)" },
    { "icon": "📌", "text": "핵심 포인트 3 (30자 이내)" }
  ],
  "meta": {
    "difficulty": "medium",
    "readTime": "2분",
    "category": "{category}"
  },
  "style": {
    "accentColor": "{accentColor}",
    "theme": "{theme}"
  }
}
\`\`\`

## 이모지 가이드
- 📰 일반 뉴스
- 🚀 업데이트/출시
- 🔬 연구/기술
- 💡 팁/가이드
- ⚡ 속보
- 🎉 발표

## 난이도 기준
- **easy**: 비개발자도 이해 가능 (일반 뉴스, 발표)
- **medium**: 기본 개발 지식 필요 (기능 업데이트, API 변경)
- **hard**: 심화 기술 내용 (아키텍처, 성능 최적화)

## 중요 규칙
1. 반드시 JSON 형식으로만 응답하세요
2. 요약 길이는 {summaryMaxChars}자를 절대 초과하지 마세요
3. 비유(analogy)는 항상 포함하세요
4. 한글로 작성하세요 (기술 용어는 원어 유지 가능)
5. 핵심 포인트는 정확히 {keyPointsCount}개만 작성하세요

JSON만 응답:`;

// ============================================
// Opus Summarizer Class
// ============================================

interface OpusSummarizerOptions {
  apiKey?: string;
  model?: string; // Allow override to use Sonnet for cost savings
}

export class OpusSummarizer {
  private client: Anthropic;
  private model: string;

  constructor(options: OpusSummarizerOptions = {}) {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required");
    }
    this.client = new Anthropic({ apiKey });
    this.model = options.model || AI_MODELS.OPUS;
  }

  /**
   * Generate rich summary for article
   */
  async summarize(input: SummarizerInput): Promise<{
    result: SummarizerResult;
    usage: { inputTokens: number; outputTokens: number; costUsd: number };
  }> {
    // Determine summary tier based on content length
    const tier = getSummaryTier(input.content.length);

    // Get category styling
    const category = input.category || "press";
    const accentColor = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || "#3B82F6";
    const theme = CATEGORY_THEMES[category] || "press";

    // Build prompt
    const prompt = OPUS_SUMMARIZER_PROMPT.replace(/{title}/g, input.title)
      .replace(/{sourceName}/g, input.sourceName)
      .replace(/{url}/g, input.url)
      .replace(/{publishedAt}/g, input.publishedAt)
      .replace(/{contentLength}/g, String(input.content.length))
      .replace(/{content}/g, input.content.slice(0, 8000)) // Limit content
      .replace(/{tierLabel}/g, tier.label)
      .replace(/{summaryMaxChars}/g, String(tier.summaryMaxChars))
      .replace(/{keyPointsCount}/g, String(tier.keyPointsCount))
      .replace(/{category}/g, category)
      .replace(/{accentColor}/g, accentColor)
      .replace(/{theme}/g, theme);

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

      const parsed = JSON.parse(jsonMatch[0]);

      // Build RichContent
      const richContent: RichContent = {
        title: parsed.title,
        summary: parsed.summary,
        keyPoints: parsed.keyPoints,
        source: {
          name: input.sourceName,
          url: input.url,
          favicon: input.favicon,
          publishedAt: input.publishedAt,
        },
        meta: parsed.meta,
        style: parsed.style,
      };

      // Build result
      const result: SummarizerResult = {
        richContent,
        analogy: parsed.summary?.analogy?.text || "",
        difficulty: parsed.meta?.difficulty || "medium",
        keyPointsPlain: parsed.keyPoints?.map((kp: { text: string }) => kp.text) || [],
        summaryPlain: parsed.summary?.text || "",
      };

      // Calculate usage
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const costUsd = calculateCost(
        this.model as keyof typeof TOKEN_COSTS,
        inputTokens,
        outputTokens
      );

      return {
        result,
        usage: { inputTokens, outputTokens, costUsd },
      };
    } catch (error) {
      console.error("[OpusSummarizer] Error:", error);
      throw error;
    }
  }
}

// ============================================
// Factory Functions
// ============================================

let summarizerInstance: OpusSummarizer | null = null;

export function getOpusSummarizer(options?: OpusSummarizerOptions): OpusSummarizer {
  if (!summarizerInstance) {
    summarizerInstance = new OpusSummarizer(options);
  }
  return summarizerInstance;
}

/**
 * Get summary tier info for a content length
 */
export function getSummaryTierInfo(contentLength: number): {
  label: string;
  summaryMaxChars: number;
  keyPointsCount: number;
} {
  const tier = getSummaryTier(contentLength);
  return {
    label: tier.label,
    summaryMaxChars: tier.summaryMaxChars,
    keyPointsCount: tier.keyPointsCount,
  };
}
