import { NextRequest, NextResponse } from "next/server";

// ===========================================
// OG Metadata API
// Fetches Open Graph metadata from URLs
// ===========================================

interface OGMetadata {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  type?: string;
  // GitHub specific
  stars?: number;
  forks?: number;
  language?: string;
  // Twitter specific
  author?: string;
  authorImage?: string;
}

// Extract OG tags from HTML
function extractOGTags(html: string): Record<string, string> {
  const ogTags: Record<string, string> = {};

  // Match meta tags with property or name attribute
  const metaRegex =
    /<meta\s+(?:[^>]*?\s+)?(?:property|name)=["']([^"']+)["']\s+(?:[^>]*?\s+)?content=["']([^"']*)["'][^>]*>/gi;
  const metaRegex2 =
    /<meta\s+(?:[^>]*?\s+)?content=["']([^"']*)["']\s+(?:[^>]*?\s+)?(?:property|name)=["']([^"']+)["'][^>]*>/gi;

  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    if (match[1] && match[2]) {
      ogTags[match[1]] = match[2];
    }
  }
  while ((match = metaRegex2.exec(html)) !== null) {
    if (match[1] && match[2]) {
      ogTags[match[2]] = match[1];
    }
  }

  // Extract title tag as fallback
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1] && !ogTags["og:title"]) {
    ogTags["title"] = titleMatch[1];
  }

  return ogTags;
}

// Fetch GitHub repo info via API (no auth needed for public repos)
async function fetchGitHubRepo(user: string, repo: string): Promise<OGMetadata | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${user}/${repo}`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CCgather",
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) return null;

    const data = await response.json();

    return {
      url: data.html_url,
      title: data.full_name,
      description: data.description || "No description",
      image: data.owner?.avatar_url,
      siteName: "GitHub",
      stars: data.stargazers_count,
      forks: data.forks_count,
      language: data.language,
    };
  } catch {
    return null;
  }
}

// Fetch Twitter/X oEmbed (limited info but works without API key)
async function fetchTwitterOEmbed(tweetUrl: string): Promise<OGMetadata | null> {
  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`;
    const response = await fetch(oembedUrl, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) return null;

    const data = await response.json();

    return {
      url: tweetUrl,
      title: data.author_name || "X Post",
      description: data.html?.replace(/<[^>]*>/g, "").slice(0, 200) || "",
      siteName: "X",
      author: data.author_name,
      authorImage: undefined, // oEmbed doesn't provide this
    };
  } catch {
    return null;
  }
}

// Generic OG metadata fetch
async function fetchOGMetadata(url: string): Promise<OGMetadata | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CCgather/1.0; +https://ccgather.com)",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const tags = extractOGTags(html);

    return {
      url,
      title: tags["og:title"] || tags["twitter:title"] || tags["title"] || new URL(url).hostname,
      description: tags["og:description"] || tags["twitter:description"] || tags["description"],
      image: tags["og:image"] || tags["twitter:image"],
      siteName: tags["og:site_name"] || new URL(url).hostname,
      type: tags["og:type"],
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL parameter required" }, { status: 400 });
  }

  try {
    // Validate URL
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  let metadata: OGMetadata | null = null;

  // Check if GitHub URL
  const githubMatch = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (githubMatch?.[1] && githubMatch?.[2]) {
    metadata = await fetchGitHubRepo(githubMatch[1], githubMatch[2]);
  }

  // Check if Twitter/X URL
  const twitterMatch = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/);
  if (!metadata && twitterMatch) {
    metadata = await fetchTwitterOEmbed(url);
  }

  // Fallback to generic OG fetch
  if (!metadata) {
    metadata = await fetchOGMetadata(url);
  }

  if (!metadata) {
    return NextResponse.json({ error: "Could not fetch metadata" }, { status: 404 });
  }

  return NextResponse.json(metadata);
}
