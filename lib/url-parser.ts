// ===========================================
// URL Parser Utility for Link Embeds
// ===========================================

export type EmbedType = "youtube" | "twitter" | "github" | "generic";

export interface ParsedUrl {
  type: EmbedType;
  url: string;
  embedId?: string; // YouTube video ID or Tweet ID
  metadata?: {
    user?: string;
    repo?: string;
    path?: string;
  };
}

// YouTube URL patterns
const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
];

// Twitter/X URL patterns
const TWITTER_PATTERNS = [/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/];

// GitHub URL patterns
const GITHUB_PATTERNS = [/github\.com\/([^\/]+)\/([^\/]+)(?:\/(?:issues|pull|blob|tree)\/(.+))?/];

/**
 * Extract YouTube video ID from URL
 */
function parseYouTubeUrl(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Extract Twitter/X tweet info from URL
 */
function parseTwitterUrl(url: string): { user: string; tweetId: string } | null {
  for (const pattern of TWITTER_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1] && match[2]) {
      return { user: match[1], tweetId: match[2] };
    }
  }
  return null;
}

/**
 * Extract GitHub repo info from URL
 */
function parseGitHubUrl(url: string): { user: string; repo: string; path?: string } | null {
  for (const pattern of GITHUB_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1] && match[2]) {
      return {
        user: match[1],
        repo: match[2],
        path: match[3],
      };
    }
  }
  return null;
}

/**
 * Parse a URL and determine its embed type
 */
export function parseUrl(url: string): ParsedUrl {
  // Normalize URL
  const normalizedUrl = url.trim();

  // Check YouTube
  const youtubeId = parseYouTubeUrl(normalizedUrl);
  if (youtubeId) {
    return {
      type: "youtube",
      url: normalizedUrl,
      embedId: youtubeId,
    };
  }

  // Check Twitter/X
  const twitterInfo = parseTwitterUrl(normalizedUrl);
  if (twitterInfo) {
    return {
      type: "twitter",
      url: normalizedUrl,
      embedId: twitterInfo.tweetId,
      metadata: {
        user: twitterInfo.user,
      },
    };
  }

  // Check GitHub
  const githubInfo = parseGitHubUrl(normalizedUrl);
  if (githubInfo) {
    return {
      type: "github",
      url: normalizedUrl,
      metadata: {
        user: githubInfo.user,
        repo: githubInfo.repo,
        path: githubInfo.path,
      },
    };
  }

  // Generic URL
  return {
    type: "generic",
    url: normalizedUrl,
  };
}

/**
 * Extract all URLs from text content
 */
export function extractUrls(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const matches = text.match(urlPattern);
  return matches || [];
}

/**
 * Extract and parse all URLs from text
 */
export function extractAndParseUrls(text: string): ParsedUrl[] {
  const urls = extractUrls(text);
  return urls.map(parseUrl);
}

/**
 * Get the first embeddable URL from text (YouTube or Twitter preferred)
 */
export function getFirstEmbeddableUrl(text: string): ParsedUrl | null {
  const parsedUrls = extractAndParseUrls(text);

  // Prioritize YouTube and Twitter embeds
  const priorityEmbed = parsedUrls.find((p) => p.type === "youtube" || p.type === "twitter");
  if (priorityEmbed) return priorityEmbed;

  // Then GitHub
  const githubEmbed = parsedUrls.find((p) => p.type === "github");
  if (githubEmbed) return githubEmbed;

  // Then any generic URL
  return parsedUrls[0] || null;
}
