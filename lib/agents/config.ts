/**
 * Agent Configuration for News Automation Pipeline
 * Based on NEWS_AUTOMATION_PIPELINE.md
 */

// Trusted sources whitelist
export const TRUSTED_SOURCES = [
  // Official
  "anthropic.com",
  "claude.ai",

  // Major Tech News
  "techcrunch.com",
  "theverge.com",
  "arstechnica.com",
  "wired.com",
  "venturebeat.com",

  // Developer Communities
  "news.ycombinator.com",
  "dev.to",
  "medium.com",
  "reddit.com",

  // Tech Blogs
  "blog.anthropic.com",
  "openai.com",
  "deepmind.google",
];

// Source categories
export const SOURCE_CATEGORIES = {
  official: ["anthropic.com", "claude.ai", "blog.anthropic.com"],
  news: ["techcrunch.com", "theverge.com", "arstechnica.com", "wired.com", "venturebeat.com"],
  community: ["news.ycombinator.com", "dev.to", "medium.com", "reddit.com"],
  youtube: ["youtube.com", "youtu.be"],
};

// Agent model configuration
export const AGENT_CONFIG = {
  model: "claude-sonnet-4-20250514",
  maxTokens: 4096,
  temperature: 0.3,
};

// Cost estimation per 1K tokens (Sonnet)
export const TOKEN_COSTS = {
  input: 0.003, // $3 per 1M input tokens
  output: 0.015, // $15 per 1M output tokens
};

// Prompts for each agent
export const PROMPTS = {
  factChecker: `You are a fact-checking expert. For each article, verify:

1. SOURCE RELIABILITY
   - Is the source in our trusted list?
   - Is the domain reputable for tech news?

2. CONTENT ACCURACY
   - Are the claims verifiable?
   - Any contradictions or logical inconsistencies?
   - Cross-reference with official Anthropic announcements if possible

3. DATE FRESHNESS
   - Is the article within the last 7 days?
   - Is the date accurate and not in the future?

4. RELEVANCE
   - Is this directly about Claude Code or Claude?
   - Does it provide value to developers?

Output JSON: { valid: boolean, reason: string, confidence: number (0-1) }`,

  summarizer: `You are a technical writer who explains complex topics simply.

REQUIREMENTS:
1. Write at a middle-school reading level
2. Use short sentences and simple words
3. Include practical examples where possible
4. MUST include source attribution

OUTPUT FORMAT (JSON):
{
  "title": "Clear, engaging title",
  "summary": "2-3 sentence summary",
  "key_points": ["point 1", "point 2", "point 3"],
  "source_name": "Original source name",
  "source_url": "https://original-article-url.com"
}

IMPORTANT: Never omit source attribution. This is required for legal compliance.`,

  orchestrator: `You are a news collection orchestrator for Claude Code updates.

Your job is to:
1. Search for recent Claude Code news and updates
2. For each article found:
   - Validate using fact-checker
   - Summarize using summarizer
3. Return structured results

Focus on:
- Official announcements from Anthropic
- Major feature updates
- Community tutorials and guides
- Important bug fixes or changes

Return only high-quality, verified content.`,
};

// Validation thresholds
export const VALIDATION_THRESHOLDS = {
  minConfidence: 0.7,
  minRelevance: 0.5,
  maxAgeDays: 7,
  maxArticlesPerRun: 20,
};

// Rate limiting
export const RATE_LIMITS = {
  maxRequestsPerMinute: 10,
  delayBetweenRequests: 2000, // ms
  maxConcurrentRequests: 2,
};

// Helper functions
export function isTrustedSource(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    return TRUSTED_SOURCES.some((source) => hostname === source || hostname.endsWith("." + source));
  } catch {
    return false;
  }
}

export function getSourceCategory(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    for (const [category, sources] of Object.entries(SOURCE_CATEGORIES)) {
      if (sources.some((source) => hostname.includes(source))) {
        return category;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * TOKEN_COSTS.input + (outputTokens / 1000) * TOKEN_COSTS.output;
}

export function isWithinDateRange(dateString: string, maxDays: number = 7): boolean {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= maxDays;
  } catch {
    return false;
  }
}
