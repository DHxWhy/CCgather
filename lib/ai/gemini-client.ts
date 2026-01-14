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

// ===========================================
// Structure Intensity (Hybrid Approach)
// ===========================================

export type StructureIntensity = "high" | "medium" | "low";

/**
 * Structure intensity per article type
 * - high: Tables required, max 2 consecutive paragraphs, bullet lists required
 * - medium: Table OR bullet required, max 3 consecutive paragraphs, prose sections allowed
 * - low: Structure elements recommended (not required), max 4 paragraphs, preserve original tone/flow
 */
export const STRUCTURE_INTENSITY: Record<ArticleType, StructureIntensity> = {
  product_launch: "high", // Specs, features, pricing → table optimal
  version_update: "high", // Changelog → list optimal
  security: "high", // Urgent info → checklist optimal
  pricing: "high", // Price comparison → table required
  tutorial: "medium", // Sequential list + explanatory prose
  analysis: "medium", // Comparison table + analysis prose
  research: "medium", // Findings table + methodology prose
  integration: "medium", // Features list + context prose
  event: "medium", // Announcements list + highlights prose
  showcase: "medium", // Features list + story elements
  interview: "low", // Preserve dialogue flow and nuance
  opinion: "low", // Preserve argumentation flow
  general: "medium", // Universal structure
};

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
  publishedAt?: string; // Article publication date (when the article was published)
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
    structureAppropriateness: boolean; // NEW: Hybrid structure check
  };
}

// ===========================================
// Prompts - Modular Design
// ===========================================

// Universal Structure Rules (Always Applied - Hybrid Approach)
const UNIVERSAL_STRUCTURE_RULES_HIGH = `## STRUCTURE RULES (High Intensity)

**This article type requires strong structuring for optimal readability.**

### Mandatory Elements:
1. **Quick Facts Table** (REQUIRED)
   \`\`\`html
   <table>
     <tr><th>Item</th><th>Details</th></tr>
     <tr><td>Key info 1</td><td>Value</td></tr>
   </table>
   \`\`\`

2. **Bullet Lists** (REQUIRED for 3+ related items)
   \`\`\`html
   <ul>
     <li><strong>Feature Name</strong>: One-line description</li>
   </ul>
   \`\`\`

### Constraints:
- ❌ Maximum 2 consecutive <p> tags
- ❌ No paragraphs longer than 3 sentences
- ❌ No lists converted to prose
- ✅ Use headers (<h2>) to break sections

### Format Priority:
**Table > Bullet List > Short Paragraph**`;

const UNIVERSAL_STRUCTURE_RULES_MEDIUM = `## STRUCTURE RULES (Medium Intensity)

**Balance structure with explanatory prose.**

### Required Elements (at least ONE):
- Quick Facts Table OR
- Feature/Change Bullet List

### Constraints:
- ❌ Maximum 3 consecutive <p> tags
- ❌ No paragraphs longer than 4 sentences
- ✅ Prose sections allowed for context/analysis
- ✅ Use headers (<h2>) to organize sections

### Format Priority:
**Table/Bullet for facts → Prose for analysis/context**`;

const UNIVERSAL_STRUCTURE_RULES_LOW = `## STRUCTURE RULES (Low Intensity)

**Preserve original tone, flow, and nuance.**

### Recommended (not required):
- Key points summary at top
- Important quotes highlighted with <blockquote>

### Constraints:
- ❌ Maximum 4 consecutive <p> tags
- ✅ Longer prose sections allowed
- ✅ Maintain dialogue flow (for interviews)
- ✅ Preserve argumentation structure (for opinions)

### Priority:
**Readability and original voice > Rigid structure**`;

const STRUCTURE_RULES_BY_INTENSITY: Record<StructureIntensity, string> = {
  high: UNIVERSAL_STRUCTURE_RULES_HIGH,
  medium: UNIVERSAL_STRUCTURE_RULES_MEDIUM,
  low: UNIVERSAL_STRUCTURE_RULES_LOW,
};

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
- releaseDate: 제품/기능 발표일/출시일 (있는 경우)
- publishedAt: 기사 게시일 (기사가 언제 작성/게시되었는지 - 날짜 표기 찾기, ISO 8601 형식으로 변환)
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
  "publishedAt": "ISO 8601 date string or null (e.g., 2025-01-14T00:00:00Z)",
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

**CRITICAL: Opening Sentence Rules**
The first sentence appears in news cards and must hook readers naturally.

DO:
- Start with a specific fact, number, or concrete detail NOT in the title
- Provide context that answers "why should I care?"
- Use active voice and strong verbs

DON'T:
- Repeat the title or rephrase it
- Use clickbait or sensational language
- Start with "In a move..." or "According to..."

Examples:
  Title: "OpenAI Eyes Massive San Francisco Expansion"
  Bad opening: "OpenAI is negotiating a new 250,000-square-foot sublease..."
  Good opening: "The deal would give OpenAI more SF office space than any other AI company—over 1 million square feet total."

  Title: "Anthropic Launches Cowork for File Automation"
  Bad opening: "Anthropic has announced a new feature called Cowork..."
  Good opening: "Claude can now read, edit, and organize files on your Mac without asking permission for each action."

**Line Break Guidelines:**
- Each paragraph should focus on ONE main idea
- Break long paragraphs (>3 sentences) into shorter ones
- Use <br> sparingly - prefer separate <p> tags for distinct thoughts
- After tables or lists, start a new paragraph

### 5. Insight (insightHtml) - "🌱 In Simple Terms" Section
**TARGET: Middle school reading level explanation**

This is CCgather's signature section that explains the news in SIMPLE terms for non-technical readers.

**Writing Rules:**
- Write in plain English
- Explain like you're talking to a curious 14-year-old student
- Use everyday analogies (games, school, social media, shopping)
- Avoid jargon - if you must use technical terms, explain them simply
- Keep sentences SHORT (under 20 words each)
- Use friendly, conversational tone

**Structure (2-4 sentences total):**
1. What is this? (One sentence explanation)
2. Why does it matter? (Real-world impact)
3. Simple analogy if helpful (Make it relatable)

**Examples:**
Bad: "This feature leverages advanced LLM capabilities to enhance developer productivity."
Good: "AI can now write code for you. It's like having a smart friend help you with homework!"

Bad: "Anthropic releases new Claude model with improved reasoning."
Good: "Claude just got smarter! It can solve math problems better and understand tricky questions."

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

// Type-specific summary structures with HTML examples (Hybrid Approach)
const TYPE_SUMMARY_PROMPTS: Record<ArticleType, string> = {
  product_launch: `### Output Structure (Product Launch) - HIGH STRUCTURE

**Section 1: Quick Facts Table** (REQUIRED)
\`\`\`html
<table>
  <tr><th>Item</th><th>Details</th></tr>
  <tr><td>Product/Feature</td><td>[name]</td></tr>
  <tr><td>Released By</td><td>[company]</td></tr>
  <tr><td>Availability</td><td>[date or "available now"]</td></tr>
  <tr><td>Target Users</td><td>[audience]</td></tr>
  <tr><td>Pricing/Access</td><td>[free/paid/subscription]</td></tr>
</table>
\`\`\`

**Section 2: Core Features** (REQUIRED - Bullet List)
\`\`\`html
<h2>Key Features</h2>
<ul>
  <li><strong>Feature Name</strong>: Specific capability with concrete example</li>
  <li><strong>Feature Name</strong>: What it does and why it matters</li>
</ul>
\`\`\`

**Section 3: Technical Details** (1-2 paragraphs max)
- How it works, specifications, requirements
- Use <code> tags for technical terms

**Section 4: Impact** (1 paragraph)
- Why this matters for Claude Code users`,

  version_update: `### Output Structure (Version Update) - HIGH STRUCTURE

**Section 1: Release Info Table** (REQUIRED)
\`\`\`html
<table>
  <tr><th>Item</th><th>Details</th></tr>
  <tr><td>Version</td><td>[version number]</td></tr>
  <tr><td>Release Date</td><td>[date]</td></tr>
  <tr><td>Type</td><td>[major/minor/patch]</td></tr>
  <tr><td>Breaking Changes</td><td>[yes/no]</td></tr>
</table>
\`\`\`

**Section 2: What's New** (REQUIRED - Bullet List)
\`\`\`html
<h2>Changes</h2>
<ul>
  <li><strong>Added</strong>: [new feature]</li>
  <li><strong>Changed</strong>: [modification]</li>
  <li><strong>Fixed</strong>: [bug fix]</li>
  <li><strong>Deprecated</strong>: [if any]</li>
</ul>
\`\`\`

**Section 3: Migration Notes** (if breaking changes)
- Short paragraph on what users need to do

**Section 4: Upgrade Recommendation** (1 paragraph)`,

  tutorial: `### Output Structure (Tutorial) - MEDIUM STRUCTURE

**Section 1: Overview Box**
\`\`\`html
<table>
  <tr><th>Item</th><th>Details</th></tr>
  <tr><td>Goal</td><td>[what you'll build/learn]</td></tr>
  <tr><td>Difficulty</td><td>[beginner/intermediate/advanced]</td></tr>
  <tr><td>Time</td><td>[estimated time]</td></tr>
  <tr><td>Prerequisites</td><td>[required knowledge/tools]</td></tr>
</table>
\`\`\`

**Section 2: Key Steps** (Sequential List)
\`\`\`html
<h2>Steps Overview</h2>
<ol>
  <li><strong>Step Name</strong>: Brief description</li>
  <li><strong>Step Name</strong>: Brief description</li>
</ol>
\`\`\`

**Section 3: Key Concepts** (Prose allowed)
- Explain important concepts mentioned in the tutorial

**Section 4: Outcome**
- What readers will achieve, links to full tutorial`,

  interview: `### Output Structure (Interview) - LOW STRUCTURE

**Preserve dialogue flow and nuance.**

**Section 1: Context** (1-2 paragraphs)
- Who is being interviewed, why it matters, the occasion

**Section 2: Key Quotes** (Use blockquote)
\`\`\`html
<blockquote>
  <p>"[Important quote from interviewee]"</p>
  <footer>— [Name], [Title]</footer>
</blockquote>
\`\`\`

**Section 3: Discussion Highlights** (Prose with embedded quotes)
- Summarize 2-3 key topics discussed
- Preserve the interviewee's voice and tone
- Use quotes to capture personality

**Section 4: Implications**
- What this interview reveals about future directions`,

  analysis: `### Output Structure (Analysis) - MEDIUM STRUCTURE

**Section 1: Analysis Overview**
\`\`\`html
<table>
  <tr><th>Item</th><th>Details</th></tr>
  <tr><td>Subject</td><td>[what's being analyzed]</td></tr>
  <tr><td>Scope</td><td>[boundaries of analysis]</td></tr>
  <tr><td>Methodology</td><td>[how it was analyzed]</td></tr>
</table>
\`\`\`

**Section 2: Comparison Table** (if comparing items)
\`\`\`html
<table>
  <tr><th>Criteria</th><th>Option A</th><th>Option B</th></tr>
  <tr><td>[criterion]</td><td>[value]</td><td>[value]</td></tr>
</table>
\`\`\`

**Section 3: Key Findings** (Bullet + Prose)
- Main conclusions with supporting evidence
- Analysis and interpretation (prose allowed)

**Section 4: Limitations & Takeaways**`,

  security: `### Output Structure (Security) - HIGH STRUCTURE

**Section 1: Vulnerability Summary** (REQUIRED - Critical Info First)
\`\`\`html
<table>
  <tr><th>Item</th><th>Details</th></tr>
  <tr><td>Severity</td><td><strong>[Critical/High/Medium/Low]</strong></td></tr>
  <tr><td>CVE</td><td>[CVE-XXXX-XXXXX or N/A]</td></tr>
  <tr><td>Affected</td><td>[products/versions]</td></tr>
  <tr><td>Patched In</td><td>[version or "pending"]</td></tr>
</table>
\`\`\`

**Section 2: What You Need To Do** (REQUIRED - Checklist)
\`\`\`html
<h2>Action Required</h2>
<ul>
  <li>✅ <strong>Immediate</strong>: [urgent action]</li>
  <li>⬜ <strong>Short-term</strong>: [follow-up action]</li>
  <li>⬜ <strong>Long-term</strong>: [preventive measure]</li>
</ul>
\`\`\`

**Section 3: Technical Details** (1 paragraph)
- Attack vector, impact if exploited

**Section 4: Timeline** (if available)`,

  event: `### Output Structure (Event) - MEDIUM STRUCTURE

**Section 1: Event Info**
\`\`\`html
<table>
  <tr><th>Item</th><th>Details</th></tr>
  <tr><td>Event</td><td>[name]</td></tr>
  <tr><td>Date</td><td>[when]</td></tr>
  <tr><td>Location</td><td>[where or "virtual"]</td></tr>
  <tr><td>Organizer</td><td>[who]</td></tr>
</table>
\`\`\`

**Section 2: Key Announcements** (Bullet List)
\`\`\`html
<h2>Major Announcements</h2>
<ul>
  <li><strong>[Announcement]</strong>: Brief description</li>
</ul>
\`\`\`

**Section 3: Highlights** (Prose allowed)
- Notable demos, keynote moments, surprises

**Section 4: Why It Matters**`,

  research: `### Output Structure (Research) - MEDIUM STRUCTURE

**Section 1: Research Overview**
\`\`\`html
<table>
  <tr><th>Item</th><th>Details</th></tr>
  <tr><td>Topic</td><td>[what was studied]</td></tr>
  <tr><td>Authors</td><td>[researchers/institution]</td></tr>
  <tr><td>Methodology</td><td>[approach used]</td></tr>
  <tr><td>Sample Size</td><td>[if applicable]</td></tr>
</table>
\`\`\`

**Section 2: Key Findings** (Bullet List)
\`\`\`html
<h2>Main Results</h2>
<ul>
  <li><strong>Finding 1</strong>: [specific result with numbers]</li>
  <li><strong>Finding 2</strong>: [specific result]</li>
</ul>
\`\`\`

**Section 3: Analysis** (Prose allowed)
- What the findings mean, context

**Section 4: Limitations & Implications**`,

  integration: `### Output Structure (Integration) - MEDIUM STRUCTURE

**Section 1: Integration Overview**
\`\`\`html
<table>
  <tr><th>Item</th><th>Details</th></tr>
  <tr><td>Partners</td><td>[who is integrating]</td></tr>
  <tr><td>Type</td><td>[API/SDK/native/etc.]</td></tr>
  <tr><td>Availability</td><td>[when/how to access]</td></tr>
</table>
\`\`\`

**Section 2: Capabilities** (Bullet List)
\`\`\`html
<h2>What You Can Do</h2>
<ul>
  <li><strong>Capability</strong>: Specific use case</li>
</ul>
\`\`\`

**Section 3: Technical Requirements** (if applicable)
- API keys, SDK versions, prerequisites

**Section 4: Use Cases & Benefits**`,

  pricing: `### Output Structure (Pricing/Policy) - HIGH STRUCTURE

**Section 1: Change Summary** (REQUIRED)
\`\`\`html
<table>
  <tr><th>Item</th><th>Before</th><th>After</th></tr>
  <tr><td>[tier/feature]</td><td>[old price]</td><td>[new price]</td></tr>
</table>
\`\`\`

**Section 2: Key Changes** (Bullet List)
\`\`\`html
<h2>What's Changing</h2>
<ul>
  <li><strong>Price Change</strong>: [specific change]</li>
  <li><strong>New Tier</strong>: [if applicable]</li>
  <li><strong>Removed</strong>: [if applicable]</li>
</ul>
\`\`\`

**Section 3: Who Is Affected**
- Existing users, new users, grandfathering rules

**Section 4: Effective Date & Actions**`,

  showcase: `### Output Structure (Showcase) - MEDIUM STRUCTURE

**Section 1: Project Overview**
\`\`\`html
<table>
  <tr><th>Item</th><th>Details</th></tr>
  <tr><td>Project</td><td>[name]</td></tr>
  <tr><td>Creator</td><td>[who built it]</td></tr>
  <tr><td>Type</td><td>[tool/library/app/demo]</td></tr>
  <tr><td>Status</td><td>[beta/stable/experimental]</td></tr>
</table>
\`\`\`

**Section 2: Key Features** (Bullet List)
\`\`\`html
<h2>Highlights</h2>
<ul>
  <li><strong>Feature</strong>: What it does</li>
</ul>
\`\`\`

**Section 3: Story/Context** (Prose allowed)
- Why it was built, interesting background

**Section 4: Try It**
- Links, installation, open source status`,

  opinion: `### Output Structure (Opinion/Editorial) - LOW STRUCTURE

**Preserve the argumentation flow.**

**Section 1: Thesis Statement**
- What position is the author taking? (1-2 paragraphs)

**Section 2: Key Arguments** (Prose with optional bullets)
- Main supporting points
- Evidence cited
- Can use quotes from the author

**Section 3: Counter-perspectives**
- Opposing views acknowledged
- Author's response to criticism

**Section 4: Conclusion**
- Author's final take, call to action if any

**Note**: Do NOT force rigid structure. Let the argumentation flow naturally.`,

  general: `### Output Structure (General) - MEDIUM STRUCTURE

**When classification is uncertain, apply universal structure.**

**Section 1: TL;DR Summary**
\`\`\`html
<p><strong>In brief:</strong> [1-2 sentence summary of the key point]</p>
\`\`\`

**Section 2: Key Information Table** (REQUIRED)
\`\`\`html
<table>
  <tr><th>Item</th><th>Details</th></tr>
  <tr><td>Who</td><td>[main actor/company]</td></tr>
  <tr><td>What</td><td>[main subject]</td></tr>
  <tr><td>When</td><td>[timing if relevant]</td></tr>
  <tr><td>Why It Matters</td><td>[relevance to readers]</td></tr>
</table>
\`\`\`

**Section 3: Details** (Bullet or Short Paragraphs)
- Follow the original article's logical flow
- Use bullets for lists of items
- Use short paragraphs for explanations

**Section 4: Context/Analysis** (if needed)

**Note**: Even for "general" type, ensure at least ONE table OR bullet list.`,
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

// Stage 3: Enhanced verification prompt with structure check (Hybrid Approach)
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

### 5. 구조 적절성 (structureAppropriateness) - NEW
기사 유형에 따른 구조화 수준을 확인하세요.

**High Intensity 유형** (product_launch, version_update, security, pricing):
- [ ] Quick Facts 테이블이 포함되어 있는가?
- [ ] 연속 문단이 2개를 초과하지 않는가?
- [ ] 주요 기능/변경사항이 불릿 리스트로 정리되었는가?

**Medium Intensity 유형** (tutorial, analysis, research, integration, event, showcase, general):
- [ ] 테이블 또는 불릿 리스트 중 최소 1개가 포함되어 있는가?
- [ ] 연속 문단이 3개를 초과하지 않는가?

**Low Intensity 유형** (interview, opinion):
- [ ] 원문의 톤과 흐름이 유지되었는가?
- [ ] 연속 문단이 4개를 초과하지 않는가?
- [ ] (interview) 중요 인용문이 보존되었는가?

**공통 (5초 스캔 테스트)**:
- [ ] 헤더와 볼드 텍스트만 읽어도 핵심을 파악할 수 있는가?

## 점수 기준
- 95-100: 완벽함, 자동 승인
- 85-94: 우수함, 사소한 개선 가능
- 70-84: 검토 필요, 수정 권장
- 0-69: 거부, 재작성 필요

**구조 점수 가중치**:
- 사실적 정확성: 30%
- 완전성: 25%
- 톤 적절성: 15%
- 과장/왜곡 없음: 15%
- 구조 적절성: 15%

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
    "noExaggeration": boolean,
    "structureAppropriateness": boolean
  },
  "issues": ["구체적인 문제점"],
  "suggestions": ["개선 제안"]
}
\`\`\``;

// ===========================================
// Dynamic Prompt Generator (Hybrid Approach)
// ===========================================

interface BuildRewritePromptOptions {
  articleType: ArticleType;
  originalLength: number;
  confidence: number;
  secondaryType?: ArticleType;
}

function buildRewritePrompt(options: BuildRewritePromptOptions): string {
  const { articleType, originalLength, confidence, secondaryType } = options;

  // Get structure intensity for this article type
  const intensity = STRUCTURE_INTENSITY[articleType] || "medium";
  const structureRules = STRUCTURE_RULES_BY_INTENSITY[intensity];

  // Get type-specific prompt
  const typePrompt = TYPE_SUMMARY_PROMPTS[articleType] || TYPE_SUMMARY_PROMPTS.general;

  // Build the prompt
  let prompt = REWRITE_BASE_PROMPT;

  // Add structure rules based on intensity
  prompt += `\n\n${structureRules}`;

  // Add type-specific structure (confidence-based)
  if (confidence >= 0.7) {
    prompt += `\n\n${typePrompt}`;

    // Add secondary type hints if present
    if (secondaryType && secondaryType !== articleType) {
      const secondaryHint = getSecondaryTypeHint(secondaryType);
      if (secondaryHint) {
        prompt += `\n\n### Secondary Focus (${secondaryType})\n${secondaryHint}`;
      }
    }
  } else {
    // Low confidence: use general structure with note
    prompt += `\n\n${TYPE_SUMMARY_PROMPTS.general}`;
    prompt += `\n\n**Note**: Classification confidence is low (${(confidence * 100).toFixed(0)}%). `;
    prompt += `Focus on the universal structure rules above. Prioritize clarity over type-specific formatting.`;
  }

  // Add length rules
  prompt += `\n\n${LENGTH_RULES}`;

  // Add metadata
  prompt += `\n\n**Current article type: ${articleType}** (confidence: ${(confidence * 100).toFixed(0)}%)`;
  prompt += `\n**Structure intensity: ${intensity.toUpperCase()}**`;
  prompt += `\n**Original article length: ${originalLength} characters**`;

  return prompt;
}

/**
 * Get hints for secondary article type to include additional relevant sections
 */
function getSecondaryTypeHint(type: ArticleType): string | null {
  const hints: Partial<Record<ArticleType, string>> = {
    product_launch: "Include a brief product/feature summary table if a new product is announced.",
    pricing: "Include pricing information in a comparison table if pricing changes are mentioned.",
    security: "Highlight any security implications with severity level if security is mentioned.",
    version_update: "List version changes if specific versions are mentioned.",
    tutorial: "Include a steps overview if how-to content is present.",
    research: "Include key findings if research/data is cited.",
  };
  return hints[type] || null;
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
   * Stage 2: Rewrite article with dynamic type-specific prompt (Hybrid Approach)
   */
  async rewriteArticle(
    originalTitle: string,
    content: string,
    facts: ExtractedFacts,
    sourceName: string
  ): Promise<{ article: RewrittenArticle; usage: GeminiUsage }> {
    const { primary: articleType, secondary: secondaryType, confidence } = facts.classification;
    const intensity = STRUCTURE_INTENSITY[articleType] || "medium";

    if (this.debug) {
      console.log(
        `[GeminiClient] Stage 2: Rewriting as "${articleType}" (confidence: ${(confidence * 100).toFixed(0)}%, intensity: ${intensity})...`
      );
    }

    const config: GenerationConfig = {
      temperature: 0.7,
      maxOutputTokens: 32768,
    };

    // Dynamic prompt based on article type with hybrid approach
    const dynamicPrompt = buildRewritePrompt({
      articleType,
      originalLength: content.length,
      confidence,
      secondaryType,
    });

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
