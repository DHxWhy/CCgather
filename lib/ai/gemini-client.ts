/**
 * Gemini 3 Flash Client
 * Unified AI pipeline using Google Gemini 3 Flash
 *
 * Based on NEWS_TAB_STRATEGY.md v3.2:
 * - Stage 1: Fact Extraction
 * - Stage 2: Article Rewriting
 * - Stage 3: Fact Verification
 *
 * Model: gemini-3-flash-preview (Gemini 3 Flash)
 * Pricing: $0.50/1M input, $3.00/1M output
 * Context: 1M tokens, multimodal input
 */

import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from "@google/generative-ai";

// ===========================================
// Configuration
// ===========================================

export const GEMINI_MODEL = "gemini-3-flash-preview"; // Gemini 3 Flash

export const GEMINI_COSTS = {
  input: 0.5, // $0.50 per 1M input tokens
  output: 3.0, // $3.00 per 1M output tokens
};

// ===========================================
// Types
// ===========================================

export interface GeminiUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface ExtractedFacts {
  version?: string;
  releaseDate?: string;
  metrics: string[];
  features: string[];
  changes: string[];
  keywords: string[];
}

export interface RewrittenArticle {
  oneLiner: string;
  title: {
    text: string;
    emoji?: string;
  };
  summary: string;
  bodyHtml: string;
  insightHtml: string;
  keyTakeaways: Array<{ icon: string; text: string }>;
  difficulty: "easy" | "medium" | "hard";
  readTime: string;
  category: string;
}

export interface FactVerification {
  score: number; // 0-100
  passed: boolean;
  issues: string[];
  suggestions: string[];
}

// ===========================================
// Prompts
// ===========================================

const FACT_EXTRACTION_PROMPT = `당신은 CCgather 뉴스 플랫폼의 팩트 추출 전문가입니다.

주어진 기사에서 핵심 팩트를 구조화된 JSON으로 추출하세요.

## 추출 항목
- version: 버전 번호 (있는 경우)
- releaseDate: 발표일 (있는 경우)
- metrics: 수치 데이터 (성능 개선율, 속도, 비용 등)
- features: 주요 기능/특징
- changes: 변경 사항
- keywords: Claude Code, Anthropic 관련 키워드

## 출력 형식
JSON만 출력하세요.

\`\`\`json
{
  "version": "string or null",
  "releaseDate": "string or null",
  "metrics": ["string"],
  "features": ["string"],
  "changes": ["string"],
  "keywords": ["string"]
}
\`\`\``;

const ARTICLE_REWRITING_PROMPT = `You are a senior technical writer for CCgather news platform.

## IMPORTANT: Language Requirement
**ALL output content MUST be written in natural, fluent English.**
Even if the source article is in Korean, Japanese, or any other language, translate and rewrite everything in English.

## CRITICAL: Original Content Only
**NEVER copy sentences from the source article.**
- Completely rewrite every sentence in your own words
- Use different sentence structures and vocabulary
- Preserve the FACTS but express them in a fresh, unique way
- Your output must pass plagiarism detection tools
- Think of yourself as a journalist who attended the same event and is writing your own story

## CRITICAL: Information-First Writing
Your summary must prioritize FACTS over FEELINGS. Readers must understand WHAT the news is about from the summary alone.

## CCgather Persona
- Friendly yet professional tone
- Content for the Claude Code developer community
- Explain complex technology simply and clearly
- Provide practical, actionable insights
- Conversational but informative style

## Writing Guidelines

### 1. One-liner (oneLiner)
Capture the essence in one shareable sentence containing at least ONE specific fact (feature, number, or availability).
❌ "A new tool that changes how you work with AI"
✅ "Claude Max subscribers can now automate file tasks with Cowork on macOS"

### 2. Title
Create an original, engaging headline + relevant emoji. Include the product/feature name.

### 3. Summary (STRICT REQUIREMENTS)
Write 2-4 sentences following this structure:

**Sentence 1 (WHAT + WHO):**
"[Company] released/announced [Product], a [one-phrase description] for [target users/availability]."

**Sentence 2 (HOW - specific capabilities):**
"It [action verb: reads/creates/analyzes] [specific objects] to [concrete outcome]."

**Sentence 3+ (LIMITATIONS/CONTEXT - if relevant):**
"Currently [limitation: platform, pricing, beta status]. [Additional key detail]."

### Information Density Rules for Summary
- Every sentence must contain at least ONE specific fact
- Use action verbs: "reads", "creates", "organizes", "generates", "accesses"
- Include: availability (who can use), platform (where), specific capabilities (what it does)
- NEVER use vague marketing words: "revolutionary", "game-changing", "proactive", "seamless", "powerful"

### Summary Anti-patterns (NEVER write like this)
❌ "functions more like a proactive teammate than a simple chatbot"
✅ "reads and edits files in user-selected folders autonomously"

❌ "complex file management and document creation tasks"
✅ "organizing downloads, generating spreadsheets from screenshots, drafting reports from notes"

❌ "agentic foundations of Claude Code"
✅ "file access and automation features similar to Claude Code"

### Example Good Summary
"Anthropic released Cowork, a file automation tool for Claude Max subscribers on macOS. It accesses designated folders to read, edit, and create files—handling tasks like organizing downloads, generating expense spreadsheets from screenshots, and drafting reports from scattered notes. Users can queue multiple tasks and continue working while Claude completes them in the background."

### 4. Body (bodyHtml)
HTML format using p/h2/ul/li/strong/code tags - COMPLETELY REWRITTEN with specific details.

### 5. Insight (insightHtml)
CCgather's unique analysis: What does this mean for Claude Code users? Practical implications.

### 6. Key Takeaways
3-5 bullet points with icon + text. Each must contain a specific fact, not generic statements.
❌ { "icon": "🚀", "text": "Improved productivity" }
✅ { "icon": "📁", "text": "Access and edit files in any folder you grant permission to" }

## Output Format
Output JSON only.

\`\`\`json
{
  "oneLiner": "string",
  "title": { "text": "string", "emoji": "string" },
  "summary": "string",
  "bodyHtml": "string",
  "insightHtml": "string",
  "keyTakeaways": [{ "icon": "string", "text": "string" }],
  "difficulty": "easy|medium|hard",
  "readTime": "string (e.g., 3 min)",
  "category": "string"
}
\`\`\``;

const FACT_VERIFICATION_PROMPT = `당신은 CCgather 뉴스 플랫폼의 팩트체커입니다.

재작성된 기사가 원본 팩트와 일치하는지 검증하세요.

## 검증 기준
1. 수치/버전 정보 정확성
2. 기능 설명의 정확성
3. 과장/왜곡 여부
4. 누락된 중요 정보

## 점수 기준
- 90-100: 자동 승인 (정확함)
- 70-89: 검토 필요 (일부 수정 권장)
- 0-69: 거부 (재작성 필요)

## 출력 형식
JSON만 출력하세요.

\`\`\`json
{
  "score": number,
  "passed": boolean,
  "issues": ["string"],
  "suggestions": ["string"]
}
\`\`\``;

// ===========================================
// Gemini Client Class
// ===========================================

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private debug: boolean;

  constructor(options: { apiKey?: string; debug?: boolean } = {}) {
    const apiKey = options.apiKey || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GEMINI_API_KEY is required");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: GEMINI_MODEL });
    this.debug = options.debug ?? false;
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    return (
      (inputTokens / 1_000_000) * GEMINI_COSTS.input +
      (outputTokens / 1_000_000) * GEMINI_COSTS.output
    );
  }

  private parseJsonResponse<T>(text: string): T {
    let jsonStr = text.trim();

    // Try multiple patterns to extract JSON from markdown code blocks
    // Pattern 1: ```json ... ``` or ``` ... ```
    const codeBlockMatch = jsonStr.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      // Pattern 2: Remove leading/trailing backticks if partial code block
      jsonStr = jsonStr.replace(/^`{3,}(?:json|JSON)?\s*\n?/, "").replace(/\n?`{3,}$/, "");
    }

    // Pattern 3: Find JSON object/array boundaries if still wrapped
    if (!jsonStr.startsWith("{") && !jsonStr.startsWith("[")) {
      const jsonStart = jsonStr.search(/[\[{]/);
      const jsonEndBrace = jsonStr.lastIndexOf("}");
      const jsonEndBracket = jsonStr.lastIndexOf("]");
      const jsonEnd = Math.max(jsonEndBrace, jsonEndBracket);

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      }
    }

    try {
      return JSON.parse(jsonStr) as T;
    } catch (error) {
      console.error("[GeminiClient] JSON parse error. Raw text:", text.substring(0, 500));
      throw new Error(
        `Failed to parse JSON response: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Stage 1: Extract facts from article
   */
  async extractFacts(content: string): Promise<{ facts: ExtractedFacts; usage: GeminiUsage }> {
    if (this.debug) console.log("[GeminiClient] Stage 1: Extracting facts...");

    const config: GenerationConfig = {
      temperature: 0.1,
      maxOutputTokens: 2048,
    };

    const prompt = `${FACT_EXTRACTION_PROMPT}\n\n## 원문\n${content}`;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: config,
      });

      const response = result.response;
      const text = response.text();
      const facts = this.parseJsonResponse<ExtractedFacts>(text);

      const inputTokens = response.usageMetadata?.promptTokenCount || 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
      const costUsd = this.calculateCost(inputTokens, outputTokens);

      if (this.debug) {
        console.log(`[GeminiClient] Facts extracted. Cost: $${costUsd.toFixed(4)}`);
      }

      return {
        facts,
        usage: {
          model: GEMINI_MODEL,
          inputTokens,
          outputTokens,
          costUsd,
        },
      };
    } catch (error) {
      console.error("[GeminiClient] Fact extraction error:", error);
      throw error;
    }
  }

  /**
   * Stage 2: Rewrite article with CCgather style
   */
  async rewriteArticle(
    originalTitle: string,
    content: string,
    facts: ExtractedFacts,
    sourceName: string
  ): Promise<{ article: RewrittenArticle; usage: GeminiUsage }> {
    if (this.debug) console.log("[GeminiClient] Stage 2: Rewriting article...");

    const config: GenerationConfig = {
      temperature: 0.7,
      maxOutputTokens: 4096,
    };

    const prompt = `${ARTICLE_REWRITING_PROMPT}

## 원본 제목
${originalTitle}

## 출처
${sourceName}

## 추출된 팩트
${JSON.stringify(facts, null, 2)}

## 원문 내용
${content}`;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: config,
      });

      const response = result.response;
      const text = response.text();
      const article = this.parseJsonResponse<RewrittenArticle>(text);

      const inputTokens = response.usageMetadata?.promptTokenCount || 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
      const costUsd = this.calculateCost(inputTokens, outputTokens);

      if (this.debug) {
        console.log(`[GeminiClient] Article rewritten. Cost: $${costUsd.toFixed(4)}`);
      }

      return {
        article,
        usage: {
          model: GEMINI_MODEL,
          inputTokens,
          outputTokens,
          costUsd,
        },
      };
    } catch (error) {
      console.error("[GeminiClient] Article rewriting error:", error);
      throw error;
    }
  }

  /**
   * Stage 3: Verify facts in rewritten article
   */
  async verifyFacts(
    facts: ExtractedFacts,
    article: RewrittenArticle
  ): Promise<{ verification: FactVerification; usage: GeminiUsage }> {
    if (this.debug) console.log("[GeminiClient] Stage 3: Verifying facts...");

    const config: GenerationConfig = {
      temperature: 0.1,
      maxOutputTokens: 1536,
    };

    const prompt = `${FACT_VERIFICATION_PROMPT}

## 원본 팩트
${JSON.stringify(facts, null, 2)}

## 재작성된 기사
제목: ${article.title.text}
한 줄 요약: ${article.oneLiner}
요약: ${article.summary}
본문: ${article.bodyHtml}
인사이트: ${article.insightHtml}
핵심 정리: ${JSON.stringify(article.keyTakeaways)}`;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: config,
      });

      const response = result.response;
      const text = response.text();
      const verification = this.parseJsonResponse<FactVerification>(text);

      const inputTokens = response.usageMetadata?.promptTokenCount || 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
      const costUsd = this.calculateCost(inputTokens, outputTokens);

      if (this.debug) {
        console.log(
          `[GeminiClient] Verification complete. Score: ${verification.score}. Cost: $${costUsd.toFixed(4)}`
        );
      }

      return {
        verification,
        usage: {
          model: GEMINI_MODEL,
          inputTokens,
          outputTokens,
          costUsd,
        },
      };
    } catch (error) {
      console.error("[GeminiClient] Fact verification error:", error);
      throw error;
    }
  }
}

// ===========================================
// Singleton Instance
// ===========================================

let clientInstance: GeminiClient | null = null;

export function getGeminiClient(options?: { apiKey?: string; debug?: boolean }): GeminiClient {
  if (!clientInstance) {
    clientInstance = new GeminiClient(options);
  }
  return clientInstance;
}
