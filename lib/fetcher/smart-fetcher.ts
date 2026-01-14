/**
 * Smart Fetcher - Intelligent web content extraction
 * Uses Cheerio for HTML parsing, specialized parsers for known sources
 */

import * as cheerio from "cheerio";

export interface FetchedArticle {
  url: string;
  title: string;
  content: string;
  sourceName: string;
  publishedAt: string;
  thumbnail?: string;
  favicon?: string;
  author?: string;
}

export interface FetchResult {
  success: boolean;
  article?: FetchedArticle;
  error?: string;
}

// Known source configurations
const SOURCE_CONFIGS: Record<
  string,
  {
    name: string;
    selectors: {
      title?: string;
      content?: string;
      date?: string;
      author?: string;
      thumbnail?: string;
    };
  }
> = {
  "anthropic.com": {
    name: "Anthropic",
    selectors: {
      title: "h1",
      content: "article, .post-content, main",
      date: 'time, [datetime], meta[property="article:published_time"]',
      thumbnail: 'meta[property="og:image"]',
    },
  },
  "techcrunch.com": {
    name: "TechCrunch",
    selectors: {
      title: "h1.article__title",
      content: ".article-content",
      date: "time",
      author: ".article__byline",
      thumbnail: 'meta[property="og:image"]',
    },
  },
  "theverge.com": {
    name: "The Verge",
    selectors: {
      title: "h1",
      content: ".duet--article--article-body-component",
      date: "time",
      thumbnail: 'meta[property="og:image"]',
    },
  },
};

/**
 * Extract favicon URL from a domain
 */
export function getFaviconUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    // Use Google's favicon service for reliable favicons
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return "";
  }
}

/**
 * Parse date string to ISO format
 */
function parseDate(dateStr: string | undefined): string {
  if (!dateStr) return new Date().toISOString();

  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch {
    // Fall through to default
  }

  return new Date().toISOString();
}

/**
 * Extract date from JSON-LD structured data
 */
function extractJsonLdDate($: cheerio.CheerioAPI): string | null {
  try {
    const scripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length; i++) {
      const scriptContent = $(scripts[i]).html();
      if (!scriptContent) continue;

      const jsonLd = JSON.parse(scriptContent);

      // Handle array of objects
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];

      for (const item of items) {
        // Check common date fields
        const dateField =
          item.datePublished ||
          item.dateCreated ||
          item.dateModified ||
          item.publishedAt ||
          item.published;

        if (dateField) {
          return dateField;
        }

        // Check @graph for nested data (common in WordPress)
        if (item["@graph"] && Array.isArray(item["@graph"])) {
          for (const graphItem of item["@graph"]) {
            if (graphItem.datePublished) return graphItem.datePublished;
            if (graphItem.dateCreated) return graphItem.dateCreated;
          }
        }
      }
    }
  } catch {
    // JSON parsing failed, return null
  }
  return null;
}

/**
 * Clean text content - remove extra whitespace
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

/**
 * Extract article content using generic selectors
 */
function extractGeneric($: cheerio.CheerioAPI, url: string): FetchedArticle | null {
  // Try common title selectors
  let title =
    $("h1").first().text() ||
    $('meta[property="og:title"]').attr("content") ||
    $("title").text() ||
    "";
  title = cleanText(title);

  if (!title) return null;

  // Try common content selectors
  const contentSelectors = [
    "article",
    '[role="main"]',
    ".post-content",
    ".article-content",
    ".entry-content",
    "main",
    ".content",
  ];

  let content = "";
  for (const selector of contentSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      // Remove scripts, styles, nav, footer
      el.find("script, style, nav, footer, aside, .ad, .advertisement").remove();
      content = cleanText(el.text());
      if (content.length > 200) break;
    }
  }

  // Fallback to body if no content found
  if (!content || content.length < 100) {
    const body = $("body").clone();
    body.find("script, style, nav, footer, header, aside").remove();
    content = cleanText(body.text());
  }

  // Limit content length
  if (content.length > 10000) {
    content = content.slice(0, 10000) + "...";
  }

  // Extract date - try multiple selectors
  const dateStr =
    $("time").attr("datetime") ||
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[property="og:article:published_time"]').attr("content") ||
    $('meta[name="date"]').attr("content") ||
    $('meta[name="publish_date"]').attr("content") ||
    $('meta[name="publishdate"]').attr("content") ||
    $('meta[name="DC.date.issued"]').attr("content") ||
    $('meta[itemprop="datePublished"]').attr("content") ||
    $('[itemprop="datePublished"]').attr("content") ||
    $('[itemprop="datePublished"]').attr("datetime") ||
    $('[class*="date"]').first().attr("datetime") ||
    $('[data-testid="storyPublishDate"]').text() ||
    // JSON-LD structured data
    extractJsonLdDate($) ||
    "";

  // Extract thumbnail
  const thumbnail =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    "";

  // Extract author
  const author =
    $('meta[name="author"]').attr("content") ||
    $('[rel="author"]').first().text() ||
    $(".author").first().text() ||
    "";

  // Get source name
  const { hostname } = new URL(url);
  const sourceName =
    $('meta[property="og:site_name"]').attr("content") ||
    hostname.replace("www.", "").split(".")[0] ||
    hostname;

  return {
    url,
    title,
    content,
    sourceName: sourceName.charAt(0).toUpperCase() + sourceName.slice(1),
    publishedAt: parseDate(dateStr),
    thumbnail: thumbnail || undefined,
    favicon: getFaviconUrl(url),
    author: cleanText(author) || undefined,
  };
}

/**
 * Extract article using source-specific config
 */
function extractWithConfig(
  $: cheerio.CheerioAPI,
  url: string,
  config: (typeof SOURCE_CONFIGS)[string]
): FetchedArticle | null {
  const { selectors, name } = config;

  // Extract title
  let title = "";
  if (selectors.title) {
    title = $(selectors.title).first().text();
  }
  if (!title) {
    title = $('meta[property="og:title"]').attr("content") || $("title").text() || "";
  }
  title = cleanText(title);

  if (!title) return null;

  // Extract content
  let content = "";
  if (selectors.content) {
    const el = $(selectors.content);
    el.find("script, style, nav, footer, aside").remove();
    content = cleanText(el.text());
  }

  if (!content || content.length < 50) {
    // Fallback to generic extraction
    return extractGeneric($, url);
  }

  // Limit content
  if (content.length > 10000) {
    content = content.slice(0, 10000) + "...";
  }

  // Extract date
  let dateStr = "";
  if (selectors.date) {
    dateStr =
      $(selectors.date).attr("datetime") ||
      $(selectors.date).attr("content") ||
      $(selectors.date).text() ||
      "";
  }

  // Extract thumbnail
  let thumbnail = "";
  if (selectors.thumbnail) {
    thumbnail = $(selectors.thumbnail).attr("content") || "";
  }
  if (!thumbnail) {
    thumbnail = $('meta[property="og:image"]').attr("content") || "";
  }

  // Extract author
  let author = "";
  if (selectors.author) {
    author = $(selectors.author).first().text();
  }

  return {
    url,
    title,
    content,
    sourceName: name,
    publishedAt: parseDate(dateStr),
    thumbnail: thumbnail || undefined,
    favicon: getFaviconUrl(url),
    author: cleanText(author) || undefined,
  };
}

/**
 * Main fetch function - fetches and parses article from URL
 */
export async function fetchArticle(url: string): Promise<FetchResult> {
  try {
    // Validate URL
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace("www.", "");

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CCgather/1.0; +https://ccgather.com)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Check for source-specific config
    const config = SOURCE_CONFIGS[hostname];
    let article: FetchedArticle | null = null;

    if (config) {
      article = extractWithConfig($, url, config);
    } else {
      article = extractGeneric($, url);
    }

    if (!article) {
      return {
        success: false,
        error: "Failed to extract article content",
      };
    }

    // Validate minimum content
    if (article.content.length < 50) {
      return {
        success: false,
        error: "Article content too short",
      };
    }

    return {
      success: true,
      article,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown fetch error",
    };
  }
}

/**
 * Batch fetch multiple URLs
 */
export async function fetchArticles(
  urls: string[],
  options: { delayMs?: number; maxConcurrent?: number } = {}
): Promise<Map<string, FetchResult>> {
  const { delayMs = 1000, maxConcurrent = 3 } = options;
  const results = new Map<string, FetchResult>();

  // Process in batches
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent);

    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const result = await fetchArticle(url);
        return { url, result };
      })
    );

    for (const { url, result } of batchResults) {
      results.set(url, result);
    }

    // Delay between batches (except for last batch)
    if (i + maxConcurrent < urls.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
