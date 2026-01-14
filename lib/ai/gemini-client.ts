/**
 * Gemini 3 Flash Client - Refactored with Dynamic Prompt Generation
 *
 * Based on NEWS_TAB_STRATEGY.md v3.2 + Prompt Engineering Analysis:
 * - Stage 1: Fact Extraction + Article Type Classification (with Decision Tree)
 * - Stage 2: Dynamic Article Rewriting (type-specific prompts)
 * - Stage 3: Enhanced Fact Verification (with original content)
 *
 * Key Improvements:
 * - Dynamic prompt generation (~40% token reduction)
 * - Decision tree for type classification
 * - Primary/secondary type support
 * - Additional article types (research, integration, pricing, showcase, opinion)
 * - Enhanced verification with original content
 * - Length rules by article size
 *
 * Model: gemini-3-flash-preview (Gemini 3 Flash)
 * Pricing: $0.50/1M input, $3.00/1M output
 */

import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from "@google/generative-ai";

// ===========================================
// Configuration
// ===========================================

export const GEMINI_MODEL = "gemini-3-flash-preview";

export const GEMINI_COSTS = {
  input: 0.5,
  output: 3.0,
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

// Extended article types based on prompt engineering analysis
export type ArticleType =
  | "product_launch" // New product/feature release
  | "version_update" // Existing product update, patch notes
  | "tutorial" // How-to guides, step-by-step
  | "interview" // Q&A, conversations
  | "analysis" // Comparisons, reviews, deep dives
  | "security" // Vulnerabilities, security advisories
  | "event" // Conferences, announcements at events
  | "research" // Papers, benchmarks, academic findings
  | "integration" // Partnerships, tool integrations
  | "pricing" // Pricing changes, policy updates
  | "showcase" // Community projects, demos
  | "opinion" // Editorials, subjective takes
  | "general"; // Catch-all for unclassified

export interface ArticleClassification {
  primary: ArticleType;
  secondary?: ArticleType;
  confidence: number;
  signals: string[];
}

export interface ExtractedFacts {
  classification: ArticleClassification;
  version?: string;
  releaseDate?: string;
  metrics: string[];
  features: string[];
  changes: string[];
  keywords: string[];
  // Type-specific fields
  severity?: string; // For security
  cveId?: string; // For security
  speakers?: string[]; // For interview/event
  methodology?: string; // For research/analysis
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
  category: string;
}

export interface FactVerification {
  score: number;
  passed: boolean;
  issues: string[];
  suggestions: string[];
  checklist: {
    factualAccuracy: boolean;
    completeness: boolean;
    toneAppropriateness: boolean;
    noExaggeration: boolean;
  };
}

// ===========================================
// Prompts - Modular Design
// ===========================================

// Stage 1: Fact Extraction with Decision Tree
const FACT_EXTRACTION_PROMPT = `당신은 CCgather 뉴스 플랫폼의 팩트 추출 전문가입니다.

## 1단계: 기사 유형 분류 (Decision Tree)

다음 의사결정 트리를 따라 기사 유형을 분류하세요:

\`\`\`
Q1: 보안 취약점, CVE, 긴급 패치 관련인가?
    → YES: primary = "security"
    → NO: Q2로

Q2: 버전 번호/릴리즈가 명시되어 있는가?
    → YES: Q2-1로
    → NO: Q3로

Q2-1: 완전히 새로운 제품/서비스인가?
    → YES: primary = "product_launch"
    → NO: primary = "version_update"

Q3: 단계별 가이드/How-to 형식인가?
    → YES: primary = "tutorial"
    → NO: Q4로

Q4: 인터뷰/Q&A/대담 형식인가?
    → YES: primary = "interview"
    → NO: Q5로

Q5: 학술 논문/벤치마크/실험 결과인가?
    → YES: primary = "research"
    → NO: Q6로

Q6: 두 시스템 간 연동/파트너십 발표인가?
    → YES: primary = "integration"
    → NO: Q7로

Q7: 가격/요금/정책 변경인가?
    → YES: primary = "pricing"
    → NO: Q8로

Q8: 커뮤니티 프로젝트/데모/쇼케이스인가?
    → YES: primary = "showcase"
    → NO: Q9로

Q9: 컨퍼런스/이벤트 보도인가?
    → YES: primary = "event"
    → NO: Q10으로

Q10: 주관적 의견/사설/평론인가?
    → YES: primary = "opinion"
    → NO: Q11으로

Q11: 비교/분석/리뷰인가?
    → YES: primary = "analysis"
    → NO: primary = "general"
\`\`\`

**복합 유형 처리:**
- 기사가 두 유형에 걸쳐있으면 primary와 secondary를 모두 지정
- 예: 이벤트에서 신제품 발표 → primary: "event", secondary: "product_launch"
- confidence: 분류 확신도 (0.0-1.0)
- signals: 분류 근거가 된 키워드/문구들

## 2단계: 팩트 추출
- version: 버전 번호 (있는 경우)
- releaseDate: 발표일/출시일 (있는 경우)
- metrics: 수치 데이터 (성능, 속도, 비용, 가격 등)
- features: 주요 기능/특징
- changes: 변경 사항
- keywords: Claude, Anthropic, AI 관련 핵심 키워드

**유형별 추가 필드:**
- security: severity (심각도), cveId (CVE 번호)
- interview/event: speakers (발언자/발표자)
- research/analysis: methodology (방법론)

## 출력 형식
JSON만 출력하세요.

\`\`\`json
{
  "classification": {
    "primary": "article_type",
    "secondary": "article_type or null",
    "confidence": 0.0-1.0,
    "signals": ["근거1", "근거2"]
  },
  "version": "string or null",
  "releaseDate": "string or null",
  "metrics": ["string"],
  "features": ["string"],
  "changes": ["string"],
  "keywords": ["string"],
  "severity": "string or null",
  "cveId": "string or null",
  "speakers": ["string"] or null,
  "methodology": "string or null"
}
\`\`\``;

// Stage 2: Base prompt (common rules)
const REWRITE_BASE_PROMPT = `You are a senior technical writer for CCgather news platform.

## IMPORTANT: Language Requirement
**ALL output content MUST be written in natural, fluent English.**
Translate from any source language.

## CRITICAL: Original Content Only
**NEVER copy sentences from the source article.**
- Completely rewrite every sentence in your own words
- Use different sentence structures and vocabulary
- Preserve the FACTS but express them in a fresh, unique way
- Think of yourself as a journalist writing your own story

## CRITICAL: Information-First Writing
Prioritize FACTS over FEELINGS. Readers must understand WHAT the news is about from the summary alone.

## CCgather Persona
- Friendly yet professional tone
- Content for the Claude Code developer community
- Explain complex technology simply and clearly
- Provide practical, actionable insights

## Writing Guidelines

### 1. One-liner (oneLiner)
One shareable sentence with at least ONE specific fact.
Bad: "A new tool that changes how you work with AI"
Good: "Claude Max subscribers can now automate file tasks with Cowork on macOS"

### 2. Title
Original, engaging headline + relevant emoji. Include product/feature name.

### 3. Key Takeaways
3-5 bullet points with icon + text. Each must contain a specific fact.
Bad: { "icon": "rocket", "text": "Improved productivity" }
Good: { "icon": "folder", "text": "Access and edit files in any folder you grant permission" }

### 4. Body (bodyHtml)
HTML format using p/h2/ul/li/strong/code tags. COMPLETELY REWRITTEN.

### 5. Insight (insightHtml)
CCgather's unique analysis: What does this mean for Claude Code users?

### Information Density Rules
- Cover ALL major points from the original
- Include specific numbers, versions, dates, technical details
- NEVER use: "revolutionary", "game-changing", "proactive", "seamless", "powerful"

## Output Format
JSON only.

\`\`\`json
{
  "oneLiner": "string",
  "title": { "text": "string", "emoji": "string" },
  "summary": "string",
  "bodyHtml": "string",
  "insightHtml": "string",
  "keyTakeaways": [{ "icon": "string", "text": "string" }],
  "difficulty": "easy|medium|hard",
  "category": "string"
}
\`\`\``;

// Type-specific summary structures
const TYPE_SUMMARY_PROMPTS: Record<ArticleType, string> = {
  product_launch: `### Summary Structure (Product Launch)
1. **Lead**: What product/feature was released, by whom, for whom (availability)
2. **Core Features**: Key capabilities with specific examples and use cases
3. **Technical Details**: How it works, specifications, requirements, pricing
4. **Impact**: Why it matters, competitive positioning, limitations`,

  version_update: `### Summary Structure (Version Update)
1. **Release Info**: Version number, release date, target users
2. **Key Changes**: Most important updates, new features
3. **Technical Details**: Breaking changes, migration notes, requirements
4. **Impact**: Benefits for existing users, upgrade recommendations`,

  tutorial: `### Summary Structure (Tutorial)
1. **Goal**: What readers will learn or build
2. **Prerequisites**: Required knowledge, tools, setup needed
3. **Key Steps**: Main steps summarized (not full tutorial)
4. **Outcome**: What readers achieve, next steps`,

  interview: `### Summary Structure (Interview)
1. **Context**: Why this interview matters, the occasion
2. **Who**: Interviewee background, interviewer/publication
3. **Core Dialogue**: 2-3 key Q&A exchanges (preserve important quotes)
4. **Implications**: What this interview reveals, future outlook`,

  analysis: `### Summary Structure (Analysis)
1. **Subject & Scope**: What is being analyzed, the analysis boundaries
2. **Methodology**: Data sources, comparison criteria used
3. **Key Findings**: Main conclusions with supporting evidence
4. **Limitations & Implications**: Caveats, what readers should take away`,

  security: `### Summary Structure (Security)
1. **Vulnerability**: What the issue is, CVE if available, severity (Critical/High/Medium/Low)
2. **Affected**: Products, versions, user groups impacted
3. **Risk**: Potential impact if exploited, attack vectors
4. **Mitigation**: How to fix, workarounds, timeline for patches`,

  event: `### Summary Structure (Event)
1. **Event Context**: What event, when, where, organizer
2. **Key Announcements**: Major reveals, product launches at event
3. **Highlights**: Notable demos, keynote moments, surprises
4. **Significance**: Why this event matters, industry impact`,

  research: `### Summary Structure (Research)
1. **Research Question**: What was studied, hypothesis
2. **Methodology**: How the research was conducted, data sources
3. **Key Findings**: Main results, statistics, breakthrough points
4. **Implications**: What this means for the field, limitations`,

  integration: `### Summary Structure (Integration)
1. **Partnership**: Who is partnering, nature of the integration
2. **Capabilities**: What the integration enables, specific features
3. **Technical Details**: How it works, API/SDK requirements
4. **Benefits**: Value for users, use cases, availability`,

  pricing: `### Summary Structure (Pricing/Policy)
1. **Change Summary**: What is changing, effective date
2. **Details**: New pricing tiers, policy specifics, comparison to before
3. **Affected Users**: Who is impacted, grandfathering rules
4. **Rationale & Impact**: Why the change, what users should do`,

  showcase: `### Summary Structure (Showcase)
1. **Project Overview**: What was built, creator/team
2. **Key Features**: Notable capabilities, technical approach
3. **Demo/Results**: What it demonstrates, performance
4. **Availability**: How to try it, open source status, links`,

  opinion: `### Summary Structure (Opinion/Editorial)
1. **Thesis**: Main argument or position stated
2. **Key Arguments**: Supporting points and evidence
3. **Counter-perspectives**: Acknowledged opposing views
4. **Conclusion**: Author's final take, call to action`,

  general: `### Summary Structure (General / Unclassified)
**For articles that don't fit other categories, preserve the original article's structure.**

1. **Analyze the original structure**: Identify how the original article is organized
2. **Mirror the flow**: Follow the same logical progression as the source
3. **Maintain emphasis**: Keep the same parts emphasized as in the original
4. **Preserve tone**: Match the formality/casualness of the source

Do NOT force a rigid structure. Let the original article guide your rewrite.
If the original uses chronological order, use chronological order.
If the original leads with a quote, lead with that quote (paraphrased).
If the original is list-heavy, keep the list format.`,
};

// Length rules based on original article size
const LENGTH_RULES = `### Summary Length Rules
Adjust summary length based on original article size:

| Original Length | Summary Target | Notes |
|-----------------|----------------|-------|
| 0-500 chars     | Min 200 chars  | Preserve all key info |
| 501-2000 chars  | ~40-50%        | Standard compression |
| 2001-5000 chars | ~30-40%        | Focus on essentials |
| 5000+ chars     | ~20-30%, max 2500 chars | Aggressive summarization |

For very short articles, ensure you don't lose critical information.
For very long articles, prioritize the most newsworthy elements.`;

// Stage 3: Enhanced verification prompt
const FACT_VERIFICATION_PROMPT = `당신은 CCgather 뉴스 플랫폼의 팩트체커입니다.

재작성된 기사가 원본 내용 및 추출된 팩트와 일치하는지 검증하세요.

## 검증 체크리스트

### 1. 사실적 정확성 (factualAccuracy)
- [ ] 모든 숫자/버전/날짜가 원문과 일치하는가?
- [ ] 인용문이 정확한가?
- [ ] 기술 용어가 올바르게 사용되었는가?
- [ ] 제품명/회사명/인명이 정확한가?

### 2. 완전성 (completeness)
- [ ] 원문의 핵심 정보가 모두 포함되었는가?
- [ ] 중요한 제한사항/주의사항이 누락되지 않았는가?
- [ ] 독자가 원문 없이도 전체 맥락을 이해할 수 있는가?

### 3. 톤 적절성 (toneAppropriateness)
- [ ] 추측을 팩트처럼 서술하지 않았는가?
- [ ] 원문의 톤(긴급/일상/공식)이 유지되었는가?
- [ ] CCgather 스타일(친근하지만 전문적)을 따르는가?

### 4. 과장/왜곡 없음 (noExaggeration)
- [ ] 원문보다 과장된 표현이 없는가?
- [ ] 축소되거나 누락된 부정적 정보가 없는가?
- [ ] 마케팅 용어로 대체된 중립적 표현이 없는가?

## 점수 기준
- 95-100: 완벽함, 자동 승인
- 85-94: 우수함, 사소한 개선 가능
- 70-84: 검토 필요, 수정 권장
- 0-69: 거부, 재작성 필요

## 출력 형식
JSON만 출력하세요.

\`\`\`json
{
  "score": number,
  "passed": boolean,
  "checklist": {
    "factualAccuracy": boolean,
    "completeness": boolean,
    "toneAppropriateness": boolean,
    "noExaggeration": boolean
  },
  "issues": ["구체적인 문제점"],
  "suggestions": ["개선 제안"]
}
\`\`\``;

// ===========================================
// Dynamic Prompt Generator
// ===========================================

function buildRewritePrompt(articleType: ArticleType, originalLength: number): string {
  const typePrompt = TYPE_SUMMARY_PROMPTS[articleType] || TYPE_SUMMARY_PROMPTS.general;

  return `${REWRITE_BASE_PROMPT}

${typePrompt}

${LENGTH_RULES}

**Current article type: ${articleType}**
**Original article length: ${originalLength} characters**
`;
}

// ===========================================
// Gemini Client Class
// ===========================================

// ===========================================
// Retry Configuration
// ===========================================

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

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

  /**
   * Sleep with exponential backoff
   */
  private async sleep(attemptNumber: number): Promise<void> {
    const delay = Math.min(
      RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attemptNumber),
      RETRY_CONFIG.maxDelayMs
    );
    if (this.debug) console.log(`[GeminiClient] Waiting ${delay}ms before retry...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Check if JSON response appears truncated
   */
  private isTruncatedJson(text: string): boolean {
    const trimmed = text.trim();

    // Count braces and brackets
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;

    for (const char of trimmed) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === "\\") {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (char === "{") braceCount++;
      else if (char === "}") braceCount--;
      else if (char === "[") bracketCount++;
      else if (char === "]") bracketCount--;
    }

    // If counts don't balance, it's truncated
    if (braceCount !== 0 || bracketCount !== 0) {
      if (this.debug) {
        console.log(
          `[GeminiClient] Truncated JSON detected. Unbalanced: braces=${braceCount}, brackets=${bracketCount}`
        );
      }
      return true;
    }

    // Check for incomplete ending patterns
    const incompletePatterns = [
      /,\s*$/, // Ends with comma
      /:\s*$/, // Ends with colon
      /"\s*$/, // Ends with quote (might be incomplete value)
      /\[\s*$/, // Ends with open bracket
      /{\s*$/, // Ends with open brace
    ];

    for (const pattern of incompletePatterns) {
      if (pattern.test(trimmed)) {
        if (this.debug) {
          console.log(`[GeminiClient] Truncated JSON detected. Incomplete ending pattern.`);
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Attempt to repair truncated JSON
   */
  private repairTruncatedJson(text: string): string {
    let repaired = text.trim();

    // Remove code block markers
    const codeBlockMatch = repaired.match(/```(?:json|JSON)?\s*\n?([\s\S]*)/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      repaired = codeBlockMatch[1].trim();
    }

    // Remove trailing incomplete content after last complete value
    // Find the last complete key-value pair or array item
    const lastCompleteValue = repaired.match(
      /([\s\S]*(?:true|false|null|\d+|"[^"]*"|\}|\]))\s*[,\s]*$/
    );
    if (lastCompleteValue && lastCompleteValue[1]) {
      repaired = lastCompleteValue[1];
    }

    // Count and close any open braces/brackets
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;

    for (const char of repaired) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === "\\") {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (char === "{") braceCount++;
      else if (char === "}") braceCount--;
      else if (char === "[") bracketCount++;
      else if (char === "]") bracketCount--;
    }

    // Close unclosed structures
    while (bracketCount > 0) {
      repaired += "]";
      bracketCount--;
    }
    while (braceCount > 0) {
      repaired += "}";
      braceCount--;
    }

    if (this.debug && repaired !== text.trim()) {
      console.log(`[GeminiClient] Attempted JSON repair. Added closing chars.`);
    }

    return repaired;
  }

  /**
   * Parse JSON response with truncation detection and repair
   */
  private parseJsonResponse<T>(text: string, attemptRepair: boolean = true): T {
    let jsonStr = text.trim();

    // Extract from code block if present
    const codeBlockMatch = jsonStr.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      jsonStr = jsonStr.replace(/^`{3,}(?:json|JSON)?\s*\n?/, "").replace(/\n?`{3,}$/, "");
    }

    // Find JSON boundaries
    if (!jsonStr.startsWith("{") && !jsonStr.startsWith("[")) {
      const jsonStart = jsonStr.search(/[\[{]/);
      const jsonEndBrace = jsonStr.lastIndexOf("}");
      const jsonEndBracket = jsonStr.lastIndexOf("]");
      const jsonEnd = Math.max(jsonEndBrace, jsonEndBracket);

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      }
    }

    // Check for truncation
    const isTruncated = this.isTruncatedJson(jsonStr);

    if (isTruncated && attemptRepair) {
      jsonStr = this.repairTruncatedJson(jsonStr);
    }

    try {
      return JSON.parse(jsonStr) as T;
    } catch (error) {
      // If repair was attempted but still failed, throw with details
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      const truncatedNote = isTruncated ? " (response was truncated)" : "";

      console.error(
        `[GeminiClient] JSON parse error${truncatedNote}. Raw text (first 500 chars):`,
        text.substring(0, 500)
      );
      console.error(`[GeminiClient] Processed JSON (first 500 chars):`, jsonStr.substring(0, 500));

      throw new Error(`Failed to parse JSON response${truncatedNote}: ${errorMsg}`);
    }
  }

  /**
   * Execute API call with retry logic for JSON parsing errors
   */
  private async executeWithRetry<T>(
    operation: () => Promise<{ text: string; inputTokens: number; outputTokens: number }>,
    operationName: string
  ): Promise<{ result: T; inputTokens: number; outputTokens: number }> {
    let lastError: Error | null = null;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const response = await operation();
        totalInputTokens += response.inputTokens;
        totalOutputTokens += response.outputTokens;

        // Try to parse - if truncated, this might throw
        const result = this.parseJsonResponse<T>(response.text);

        return {
          result,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it's a retryable error (JSON parsing or truncation)
        const isRetryable =
          lastError.message.includes("JSON") ||
          lastError.message.includes("truncated") ||
          lastError.message.includes("parse");

        if (!isRetryable || attempt >= RETRY_CONFIG.maxRetries) {
          if (this.debug) {
            console.log(
              `[GeminiClient] ${operationName} failed after ${attempt + 1} attempts: ${lastError.message}`
            );
          }
          throw lastError;
        }

        console.warn(
          `[GeminiClient] ${operationName} attempt ${attempt + 1} failed: ${lastError.message}. Retrying...`
        );
        await this.sleep(attempt);
      }
    }

    throw (
      lastError ||
      new Error(`${operationName} failed after ${RETRY_CONFIG.maxRetries + 1} attempts`)
    );
  }

  /**
   * Stage 1: Extract facts with Decision Tree classification
   */
  async extractFacts(content: string): Promise<{ facts: ExtractedFacts; usage: GeminiUsage }> {
    if (this.debug) console.log("[GeminiClient] Stage 1: Extracting facts with Decision Tree...");

    const config: GenerationConfig = {
      temperature: 0.1,
      maxOutputTokens: 2048,
    };

    const prompt = `${FACT_EXTRACTION_PROMPT}\n\n## 원문\n${content}`;

    try {
      const {
        result: facts,
        inputTokens,
        outputTokens,
      } = await this.executeWithRetry<ExtractedFacts>(async () => {
        const result = await this.model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: config,
        });
        const response = result.response;
        return {
          text: response.text(),
          inputTokens: response.usageMetadata?.promptTokenCount || 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        };
      }, "Fact Extraction");

      const costUsd = this.calculateCost(inputTokens, outputTokens);

      if (this.debug) {
        console.log(
          `[GeminiClient] Facts extracted. Type: ${facts.classification.primary} (${facts.classification.confidence}). Cost: $${costUsd.toFixed(4)}`
        );
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
   * Stage 2: Rewrite article with dynamic type-specific prompt
   */
  async rewriteArticle(
    originalTitle: string,
    content: string,
    facts: ExtractedFacts,
    sourceName: string
  ): Promise<{ article: RewrittenArticle; usage: GeminiUsage }> {
    const articleType = facts.classification.primary;
    if (this.debug) console.log(`[GeminiClient] Stage 2: Rewriting as "${articleType}"...`);

    const config: GenerationConfig = {
      temperature: 0.7,
      maxOutputTokens: 32768,
    };

    // Dynamic prompt based on article type
    const dynamicPrompt = buildRewritePrompt(articleType, content.length);

    const prompt = `${dynamicPrompt}

## Original Title
${originalTitle}

## Source
${sourceName}

## Extracted Facts
${JSON.stringify(facts, null, 2)}

## Original Content
${content}`;

    try {
      const {
        result: article,
        inputTokens,
        outputTokens,
      } = await this.executeWithRetry<RewrittenArticle>(async () => {
        const result = await this.model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: config,
        });
        const response = result.response;
        return {
          text: response.text(),
          inputTokens: response.usageMetadata?.promptTokenCount || 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        };
      }, "Article Rewrite");

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
   * Stage 3: Verify facts with enhanced checklist (includes original content)
   */
  async verifyFacts(
    facts: ExtractedFacts,
    article: RewrittenArticle,
    originalContent: string
  ): Promise<{ verification: FactVerification; usage: GeminiUsage }> {
    if (this.debug) console.log("[GeminiClient] Stage 3: Verifying with enhanced checklist...");

    const config: GenerationConfig = {
      temperature: 0.1,
      maxOutputTokens: 2048,
    };

    const prompt = `${FACT_VERIFICATION_PROMPT}

## 원본 내용 (검증 기준)
${originalContent.substring(0, 8000)}

## 추출된 팩트
${JSON.stringify(facts, null, 2)}

## 재작성된 기사
제목: ${article.title.text}
한 줄 요약: ${article.oneLiner}
요약: ${article.summary}
본문: ${article.bodyHtml}
인사이트: ${article.insightHtml}
핵심 정리: ${JSON.stringify(article.keyTakeaways)}`;

    try {
      const {
        result: verification,
        inputTokens,
        outputTokens,
      } = await this.executeWithRetry<FactVerification>(async () => {
        const result = await this.model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: config,
        });
        const response = result.response;
        return {
          text: response.text(),
          inputTokens: response.usageMetadata?.promptTokenCount || 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        };
      }, "Fact Verification");

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
