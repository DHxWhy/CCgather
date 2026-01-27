/**
 * Tool Crawler with Gemini AI Analysis
 *
 * Workflow:
 * 1. Admin enters URL of a tools directory/listing page
 * 2. Crawl the page and extract tool links/info
 * 3. Visit each tool's official website
 * 4. Use Gemini to analyze and structure data
 * 5. Save as pending for admin review
 */

import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from "@google/generative-ai";
import * as cheerio from "cheerio";
import {
  TOOL_CATEGORIES,
  TOOL_PRICING_TYPES,
  type ToolCategory,
  type ToolPricingType,
} from "@/lib/types/tools";

// ===========================================
// Configuration
// ===========================================

const GEMINI_MODEL = "gemini-2.0-flash";

const CRAWL_CONFIG = {
  maxToolsPerPage: 20,
  requestTimeout: 20000,
  requestDelay: 2000, // 2초 딜레이 (IP 차단 방지)
  maxRetries: 3, // 최대 재시도 횟수
  retryDelay: 1000, // 재시도 기본 딜레이 (지수 백오프 적용)
  respectRobotsTxt: true, // robots.txt 확인
  userAgent: "CCgatherBot/1.0 (+https://ccgather.com; crawler for dev tools directory)",
};

// ===========================================
// Types
// ===========================================

export interface ExtractedTool {
  name: string;
  website_url: string;
  tagline: string;
  description?: string;
  category: ToolCategory;
  pricing_type: ToolPricingType;
  logo_url?: string;
  tags: string[];
  source_url: string; // Where we found this tool
}

export interface CrawlResult {
  success: boolean;
  tools: ExtractedTool[];
  errors: string[];
  stats: {
    totalFound: number;
    successfullyParsed: number;
    failed: number;
    tokensUsed: number;
    costUsd: number;
  };
}

interface RawToolInfo {
  name: string;
  url: string;
  description?: string;
  logo?: string;
}

// ===========================================
// Gemini Prompts
// ===========================================

const EXTRACT_TOOLS_FROM_PAGE_PROMPT = `You are a web scraping expert. Extract all developer tools/services from this webpage.

For each tool found, extract:
- name: Tool/service name
- url: Official website URL (NOT the listing page URL)
- description: Short description if available
- logo: Logo image URL if available

IMPORTANT:
- Only extract actual tools/services, not navigation links, ads, or unrelated content
- Extract the OFFICIAL website URL, not the listing page link
- If a description is very long, summarize it to 1-2 sentences

Output JSON array:
\`\`\`json
[
  {
    "name": "string",
    "url": "string",
    "description": "string or null",
    "logo": "string or null"
  }
]
\`\`\`

If no tools found, return empty array: []`;

const ANALYZE_TOOL_PAGE_PROMPT = `You are analyzing a developer tool's website to extract structured information.

IMPORTANT RULES:
1. Be accurate - don't make up information not present on the page
2. Infer category from the tool's purpose and features
3. Determine pricing from pricing page info, badges, or mentions

Available categories (MUST use one):
${TOOL_CATEGORIES.map((c) => `- "${c}"`).join("\n")}

Available pricing types (MUST use one):
${TOOL_PRICING_TYPES.map((p) => `- "${p}"`).join("\n")}

Category selection guide:
- ai-coding: AI code assistants, AI-powered IDEs, code generation tools
- devops: CI/CD, deployment, monitoring, containers, infrastructure
- productivity: Task management, note-taking, documentation, time tracking
- design: UI/UX tools, design systems, prototyping, graphics
- api-data: API platforms, databases, data processing, integration tools
- open-source: Major open source projects, libraries, frameworks
- learning: Educational platforms, tutorials, courses, documentation
- social: Community platforms, team communication, social media tools, collaboration
- marketing: SEO tools, analytics, email marketing, advertising, growth tools

Pricing type guide:
- free: Completely free, no paid tiers
- freemium: Free tier + paid plans
- paid: Paid only, trial may exist
- open_source: Open source (may have hosted paid version)

Generate 3-5 relevant tags for search/filtering.

Output JSON:
\`\`\`json
{
  "name": "string",
  "tagline": "string (one-line description, max 100 chars)",
  "description": "string (detailed description, 2-3 sentences)",
  "category": "string (from available categories)",
  "pricing_type": "string (from available pricing types)",
  "tags": ["string", "string", ...]
}
\`\`\``;

// ===========================================
// Utility Functions
// ===========================================

// robots.txt 캐시 (세션 동안 유지)
const robotsTxtCache = new Map<string, { allowed: boolean; checkedAt: number }>();

/**
 * robots.txt 확인 - 크롤링 허용 여부 체크
 */
async function checkRobotsTxt(url: string): Promise<boolean> {
  if (!CRAWL_CONFIG.respectRobotsTxt) return true;

  try {
    const urlObj = new URL(url);
    const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;

    // 캐시 확인 (1시간 유효)
    const cached = robotsTxtCache.get(urlObj.host);
    if (cached && Date.now() - cached.checkedAt < 3600000) {
      return cached.allowed;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(robotsUrl, {
        signal: controller.signal,
        headers: { "User-Agent": CRAWL_CONFIG.userAgent },
      });

      if (!response.ok) {
        // robots.txt 없으면 허용으로 간주
        robotsTxtCache.set(urlObj.host, { allowed: true, checkedAt: Date.now() });
        return true;
      }

      const text = await response.text();

      // 간단한 파싱: User-agent: * 블록에서 Disallow 확인
      const lines = text.split("\n");
      let inUserAgentBlock = false;
      let isDisallowed = false;

      for (const line of lines) {
        const trimmed = line.trim().toLowerCase();

        if (trimmed.startsWith("user-agent:")) {
          const agent = trimmed.replace("user-agent:", "").trim();
          inUserAgentBlock = agent === "*" || agent.includes("bot") || agent.includes("ccgather");
        } else if (inUserAgentBlock && trimmed.startsWith("disallow:")) {
          const path = trimmed.replace("disallow:", "").trim();
          if (path === "/" || urlObj.pathname.startsWith(path)) {
            isDisallowed = true;
            break;
          }
        }
      }

      const allowed = !isDisallowed;
      robotsTxtCache.set(urlObj.host, { allowed, checkedAt: Date.now() });
      return allowed;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // 오류 시 허용으로 간주 (네트워크 문제 등)
    return true;
  }
}

/**
 * 지수 백오프와 재시도 로직이 포함된 페이지 fetch
 */
async function fetchPage(url: string, retryCount = 0): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRAWL_CONFIG.requestTimeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": CRAWL_CONFIG.userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Cache-Control": "no-cache",
      },
    });

    // 429 Too Many Requests - 재시도
    if (response.status === 429 && retryCount < CRAWL_CONFIG.maxRetries) {
      clearTimeout(timeout);
      const retryAfter = parseInt(response.headers.get("Retry-After") || "5") * 1000;
      const delay = Math.max(retryAfter, CRAWL_CONFIG.retryDelay * Math.pow(2, retryCount));
      console.log(`[Crawler] Rate limited, retrying in ${delay}ms...`);
      await sleep(delay);
      return fetchPage(url, retryCount + 1);
    }

    // 5xx 서버 에러 - 재시도
    if (response.status >= 500 && retryCount < CRAWL_CONFIG.maxRetries) {
      clearTimeout(timeout);
      const delay = CRAWL_CONFIG.retryDelay * Math.pow(2, retryCount);
      console.log(`[Crawler] Server error ${response.status}, retrying in ${delay}ms...`);
      await sleep(delay);
      return fetchPage(url, retryCount + 1);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    clearTimeout(timeout);

    // 네트워크 에러 시 재시도
    if (retryCount < CRAWL_CONFIG.maxRetries && error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("network")) {
        const delay = CRAWL_CONFIG.retryDelay * Math.pow(2, retryCount);
        console.log(`[Crawler] Network error, retrying in ${delay}ms...`);
        await sleep(delay);
        return fetchPage(url, retryCount + 1);
      }
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractMainContent(html: string): string {
  const $ = cheerio.load(html);

  // Remove scripts, styles, nav, footer, ads
  $("script, style, nav, footer, header, aside, .ad, .advertisement, .sidebar").remove();

  // Get main content areas
  const mainContent = $("main, article, .content, .main, #content, #main, [role='main']").first();

  if (mainContent.length) {
    return mainContent.text().replace(/\s+/g, " ").trim().substring(0, 15000);
  }

  // Fallback to body
  return $("body").text().replace(/\s+/g, " ").trim().substring(0, 15000);
}

function extractMetadata(
  html: string,
  url: string
): { title: string; description: string; logo?: string } {
  const $ = cheerio.load(html);

  const title =
    $("title").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    "";

  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  const logo =
    $('meta[property="og:image"]').attr("content") ||
    $('link[rel="icon"]').attr("href") ||
    $('link[rel="apple-touch-icon"]').attr("href");

  // Resolve relative logo URL
  let resolvedLogo: string | undefined;
  if (logo) {
    try {
      resolvedLogo = new URL(logo, url).href;
    } catch {
      resolvedLogo = logo.startsWith("http") ? logo : undefined;
    }
  }

  return {
    title: title.substring(0, 200),
    description: description.substring(0, 500),
    logo: resolvedLogo,
  };
}

function parseJsonResponse<T>(text: string): T {
  let jsonStr = text.trim();

  // Extract from code block
  const codeBlockMatch = jsonStr.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Find JSON boundaries
  if (!jsonStr.startsWith("{") && !jsonStr.startsWith("[")) {
    const start = jsonStr.search(/[\[{]/);
    const endBrace = jsonStr.lastIndexOf("}");
    const endBracket = jsonStr.lastIndexOf("]");
    const end = Math.max(endBrace, endBracket);

    if (start !== -1 && end !== -1) {
      jsonStr = jsonStr.substring(start, end + 1);
    }
  }

  return JSON.parse(jsonStr) as T;
}

// ===========================================
// Tool Crawler Class
// ===========================================

export class ToolCrawler {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private debug: boolean;
  private totalTokens: number = 0;

  constructor(options: { apiKey?: string; debug?: boolean } = {}) {
    const apiKey = options.apiKey || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GEMINI_API_KEY is required");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: GEMINI_MODEL });
    this.debug = options.debug ?? false;
  }

  /**
   * Main entry point: Crawl a tools listing page
   */
  async crawlToolsPage(sourceUrl: string): Promise<CrawlResult> {
    const result: CrawlResult = {
      success: false,
      tools: [],
      errors: [],
      stats: {
        totalFound: 0,
        successfullyParsed: 0,
        failed: 0,
        tokensUsed: 0,
        costUsd: 0,
      },
    };

    try {
      // Step 1: Fetch the source page
      if (this.debug) console.log(`[ToolCrawler] Fetching source page: ${sourceUrl}`);
      const sourceHtml = await fetchPage(sourceUrl);
      const sourceContent = extractMainContent(sourceHtml);

      // Step 2: Extract tool links using Gemini
      if (this.debug) console.log("[ToolCrawler] Extracting tools from page...");
      const rawTools = await this.extractToolsFromPage(sourceContent, sourceUrl);
      result.stats.totalFound = rawTools.length;

      if (rawTools.length === 0) {
        result.errors.push("No tools found on the page");
        return result;
      }

      if (this.debug) console.log(`[ToolCrawler] Found ${rawTools.length} tools`);

      // Step 3: Process each tool (limit to max)
      const toolsToProcess = rawTools.slice(0, CRAWL_CONFIG.maxToolsPerPage);

      for (const rawTool of toolsToProcess) {
        try {
          if (this.debug) console.log(`[ToolCrawler] Processing: ${rawTool.name} (${rawTool.url})`);

          // robots.txt 확인
          const robotsAllowed = await checkRobotsTxt(rawTool.url);
          if (!robotsAllowed) {
            if (this.debug)
              console.log(`[ToolCrawler] Skipped (robots.txt disallows): ${rawTool.url}`);
            result.errors.push(`Skipped ${rawTool.name}: robots.txt disallows crawling`);
            result.stats.failed++;
            continue;
          }

          const tool = await this.processToolPage(rawTool, sourceUrl);
          if (tool) {
            result.tools.push(tool);
            result.stats.successfullyParsed++;
          } else {
            result.stats.failed++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to process ${rawTool.name}: ${errorMsg}`);
          result.stats.failed++;
        }

        // Delay between requests (IP 차단 방지)
        await sleep(CRAWL_CONFIG.requestDelay);
      }

      result.success = result.tools.length > 0;
      result.stats.tokensUsed = this.totalTokens;
      result.stats.costUsd = this.calculateCost();

      if (this.debug) {
        console.log(
          `[ToolCrawler] Complete. ${result.tools.length} tools extracted. Cost: $${result.stats.costUsd.toFixed(4)}`
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Crawl failed: ${errorMsg}`);
    }

    return result;
  }

  /**
   * Process a single tool URL directly
   */
  async crawlSingleTool(toolUrl: string): Promise<ExtractedTool | null> {
    try {
      if (this.debug) console.log(`[ToolCrawler] Processing single tool: ${toolUrl}`);

      // robots.txt 확인
      const robotsAllowed = await checkRobotsTxt(toolUrl);
      if (!robotsAllowed) {
        if (this.debug) console.log(`[ToolCrawler] Blocked by robots.txt: ${toolUrl}`);
        return null;
      }

      const html = await fetchPage(toolUrl);
      const metadata = extractMetadata(html, toolUrl);

      // Extract name from title, handling potential undefined
      const titleParts = metadata.title.split(/[|\-–—]/);
      const extractedName = titleParts[0]?.trim() || new URL(toolUrl).hostname;

      const rawTool: RawToolInfo = {
        name: extractedName,
        url: toolUrl,
        description: metadata.description,
        logo: metadata.logo,
      };

      return await this.processToolPage(rawTool, toolUrl);
    } catch (error) {
      if (this.debug) {
        console.error(`[ToolCrawler] Failed to process ${toolUrl}:`, error);
      }
      return null;
    }
  }

  /**
   * Extract tool links from a listing page using Gemini
   */
  private async extractToolsFromPage(content: string, sourceUrl: string): Promise<RawToolInfo[]> {
    const config: GenerationConfig = {
      temperature: 0.1,
      maxOutputTokens: 4096,
    };

    const prompt = `${EXTRACT_TOOLS_FROM_PAGE_PROMPT}

## Page URL
${sourceUrl}

## Page Content
${content.substring(0, 12000)}`;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: config,
      });

      const response = result.response;
      this.totalTokens += response.usageMetadata?.totalTokenCount || 0;

      const tools = parseJsonResponse<RawToolInfo[]>(response.text());

      // Validate and clean URLs
      return tools
        .filter((t) => t.name && t.url)
        .map((t) => ({
          ...t,
          url: this.normalizeUrl(t.url, sourceUrl),
        }))
        .filter((t) => t.url.startsWith("http"));
    } catch (error) {
      if (this.debug) console.error("[ToolCrawler] extractToolsFromPage error:", error);
      return [];
    }
  }

  /**
   * Process individual tool page
   */
  private async processToolPage(
    rawTool: RawToolInfo,
    sourceUrl: string
  ): Promise<ExtractedTool | null> {
    try {
      // Fetch the tool's actual website
      const html = await fetchPage(rawTool.url);
      const content = extractMainContent(html);
      const metadata = extractMetadata(html, rawTool.url);

      // Use Gemini to analyze the page
      const analyzed = await this.analyzeToolPage(content, metadata, rawTool);

      if (!analyzed) return null;

      return {
        name: analyzed.name || rawTool.name,
        website_url: rawTool.url,
        tagline: analyzed.tagline,
        description: analyzed.description,
        category: this.validateCategory(analyzed.category),
        pricing_type: this.validatePricingType(analyzed.pricing_type),
        logo_url: rawTool.logo || metadata.logo,
        tags: analyzed.tags || [],
        source_url: sourceUrl,
      };
    } catch (error) {
      if (this.debug)
        console.error(`[ToolCrawler] processToolPage error for ${rawTool.url}:`, error);
      return null;
    }
  }

  /**
   * Analyze a tool's page using Gemini
   */
  private async analyzeToolPage(
    content: string,
    metadata: { title: string; description: string },
    rawTool: RawToolInfo
  ): Promise<{
    name: string;
    tagline: string;
    description: string;
    category: string;
    pricing_type: string;
    tags: string[];
  } | null> {
    const config: GenerationConfig = {
      temperature: 0.3,
      maxOutputTokens: 2048,
    };

    const prompt = `${ANALYZE_TOOL_PAGE_PROMPT}

## Tool Info
Name: ${rawTool.name}
URL: ${rawTool.url}
Initial Description: ${rawTool.description || metadata.description || "N/A"}

## Page Content
${content.substring(0, 10000)}`;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: config,
      });

      const response = result.response;
      this.totalTokens += response.usageMetadata?.totalTokenCount || 0;

      return parseJsonResponse(response.text());
    } catch (error) {
      if (this.debug) console.error("[ToolCrawler] analyzeToolPage error:", error);
      return null;
    }
  }

  private normalizeUrl(url: string, baseUrl: string): string {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }

  private validateCategory(category: string): ToolCategory {
    if (TOOL_CATEGORIES.includes(category as ToolCategory)) {
      return category as ToolCategory;
    }
    return "productivity"; // Default fallback
  }

  private validatePricingType(pricingType: string): ToolPricingType {
    if (TOOL_PRICING_TYPES.includes(pricingType as ToolPricingType)) {
      return pricingType as ToolPricingType;
    }
    return "freemium"; // Default fallback
  }

  private calculateCost(): number {
    // Gemini 2.0 Flash pricing (approximate)
    return (this.totalTokens / 1_000_000) * 0.15;
  }
}

// ===========================================
// Singleton
// ===========================================

let crawlerInstance: ToolCrawler | null = null;

export function getToolCrawler(options?: { apiKey?: string; debug?: boolean }): ToolCrawler {
  if (!crawlerInstance) {
    crawlerInstance = new ToolCrawler(options);
  }
  return crawlerInstance;
}
