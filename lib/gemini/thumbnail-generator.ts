/**
 * Gemini Thumbnail Generator
 * Generates AI thumbnails for news articles using Google Gemini API
 */

import { createClient } from "@/lib/supabase/server";

// Configuration
// const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"; // Reserved for future Imagen API
const DEFAULT_PLACEHOLDER = "/images/news-placeholder.svg";

export interface ThumbnailRequest {
  content_id: string;
  title: string;
  summary?: string;
  source_name?: string;
  force_regenerate?: boolean;
}

export interface ThumbnailResult {
  success: boolean;
  thumbnail_url?: string;
  source: "gemini" | "og_image" | "manual" | "default";
  error?: string;
}

/**
 * Generate thumbnail prompt based on article content
 */
function generatePrompt(title: string, summary?: string): string {
  return `Create a minimalist, tech-style thumbnail image for a news article about AI and coding.

Article Title: "${title}"
${summary ? `Summary: "${summary.slice(0, 200)}"` : ""}

Style Requirements:
- Dark background (#0a0a0a or similar)
- Accent color: coral (#FF6B4A) or blue (#3B82F6)
- Modern, clean, minimalist design
- Abstract geometric shapes or subtle tech patterns
- Professional news/tech publication feel
- NO text, NO faces, NO complex scenes
- Suitable for 16:9 aspect ratio (400x225 pixels)

The image should convey: Technology, AI, Innovation, Professional`;
}

/**
 * Generate thumbnail using Gemini Imagen API
 * Note: This is a placeholder for when Gemini Imagen becomes available
 * Currently falls back to default placeholder
 */
export async function generateThumbnail(request: ThumbnailRequest): Promise<ThumbnailResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("GOOGLE_GEMINI_API_KEY not configured, using default placeholder");
    return {
      success: true,
      thumbnail_url: DEFAULT_PLACEHOLDER,
      source: "default",
    };
  }

  try {
    // For now, Gemini image generation (Imagen) has limited availability
    // This implementation uses a text-based approach to generate a description
    // that could be used with other image generation services

    const prompt = generatePrompt(request.title, request.summary);

    // Placeholder: When Gemini Imagen is available, use:
    // const response = await fetch(`${GEMINI_API_URL}/models/imagen-3.0-generate-001:generateImages`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "x-goog-api-key": apiKey,
    //   },
    //   body: JSON.stringify({
    //     instances: [{ prompt }],
    //     parameters: {
    //       sampleCount: 1,
    //       aspectRatio: "16:9",
    //     },
    //   }),
    // });

    // For now, log the prompt and return a placeholder
    console.log("Gemini thumbnail prompt generated:", prompt.slice(0, 100) + "...");

    // Return default placeholder until Imagen is available
    return {
      success: true,
      thumbnail_url: DEFAULT_PLACEHOLDER,
      source: "default",
      error: "Gemini Imagen not yet available, using placeholder",
    };
  } catch (error) {
    console.error("Gemini thumbnail generation error:", error);
    return {
      success: false,
      thumbnail_url: DEFAULT_PLACEHOLDER,
      source: "default",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetch OG Image from source URL
 */
export async function fetchOgImage(sourceUrl: string): Promise<ThumbnailResult> {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CCgather/1.0)",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        source: "default",
        error: `Failed to fetch source URL: ${response.status}`,
      };
    }

    const html = await response.text();

    // Extract OG image from HTML
    const ogImageMatch =
      html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);

    if (ogImageMatch?.[1]) {
      const ogImageUrl = ogImageMatch[1];

      // Validate the image URL
      if (ogImageUrl.startsWith("http")) {
        return {
          success: true,
          thumbnail_url: ogImageUrl,
          source: "og_image",
        };
      }
    }

    // Try Twitter card image as fallback
    const twitterImageMatch =
      html.match(/<meta\s+(?:property|name)=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']twitter:image["']/i);

    if (twitterImageMatch?.[1]) {
      const twitterImageUrl = twitterImageMatch[1];
      if (twitterImageUrl.startsWith("http")) {
        return {
          success: true,
          thumbnail_url: twitterImageUrl,
          source: "og_image",
        };
      }
    }

    return {
      success: false,
      source: "default",
      error: "No OG image found in source page",
    };
  } catch (error) {
    console.error("OG image fetch error:", error);
    return {
      success: false,
      source: "default",
      error: error instanceof Error ? error.message : "Failed to fetch OG image",
    };
  }
}

/**
 * Update content thumbnail in database
 */
export async function updateContentThumbnail(
  contentId: string,
  thumbnailUrl: string,
  source: ThumbnailResult["source"]
): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("contents")
      .update({
        thumbnail_url: thumbnailUrl,
        thumbnail_source: source,
        thumbnail_generated_at: source === "gemini" ? new Date().toISOString() : null,
      })
      .eq("id", contentId);

    if (error) {
      console.error("Failed to update thumbnail:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Database error updating thumbnail:", error);
    return false;
  }
}

/**
 * Get thumbnail with fallback strategy
 * Priority: 1. Existing thumbnail -> 2. OG Image -> 3. Gemini -> 4. Default
 */
export async function getThumbnailWithFallback(
  contentId: string,
  sourceUrl: string,
  title: string,
  summary?: string
): Promise<ThumbnailResult> {
  // Try OG Image first (faster and free)
  const ogResult = await fetchOgImage(sourceUrl);
  if (ogResult.success && ogResult.thumbnail_url) {
    await updateContentThumbnail(contentId, ogResult.thumbnail_url, "og_image");
    return ogResult;
  }

  // Try Gemini generation
  const geminiResult = await generateThumbnail({
    content_id: contentId,
    title,
    summary,
  });

  if (geminiResult.success && geminiResult.thumbnail_url) {
    await updateContentThumbnail(contentId, geminiResult.thumbnail_url, geminiResult.source);
    return geminiResult;
  }

  // Return default placeholder
  return {
    success: true,
    thumbnail_url: DEFAULT_PLACEHOLDER,
    source: "default",
  };
}
