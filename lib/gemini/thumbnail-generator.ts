/**
 * Gemini Imagen 4 Thumbnail Generator
 * Generates AI thumbnails for news articles using Google Imagen 4 API
 *
 * SDK: @google/genai
 * Model: imagen-4.0-generate-001
 * Pricing: $0.03 per image
 */

import { GoogleGenAI } from "@google/genai";
import { createServiceClient } from "@/lib/supabase/server";

// Configuration
const IMAGEN_MODEL = "imagen-4.0-generate-001";
const DEFAULT_PLACEHOLDER = "/images/news-placeholder.svg";
const SUPABASE_BUCKET = "thumbnails";

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
  cost_usd?: number;
}

/**
 * Generate thumbnail prompt based on article content
 */
function generatePrompt(title: string, summary?: string): string {
  // Clean title for prompt (remove special chars, limit length)
  const cleanTitle = title.replace(/[^\w\s]/gi, " ").slice(0, 100);
  const cleanSummary = summary?.replace(/[^\w\s]/gi, " ").slice(0, 150) || "";

  return `Create a minimalist, modern thumbnail for a tech news article.

Topic: ${cleanTitle}
${cleanSummary ? `Context: ${cleanSummary}` : ""}

Style:
- Dark gradient background (deep navy #0a0f1a to black)
- Subtle geometric patterns or abstract tech shapes
- Coral (#FF6B4A) or electric blue (#3B82F6) accent elements
- Clean, professional, futuristic aesthetic
- NO text, NO human faces, NO logos
- Suitable as a news article thumbnail
- High contrast, visually striking

The image should feel: Professional, Innovative, Tech-forward, Clean`;
}

/**
 * Upload image to Supabase Storage
 */
async function uploadToStorage(
  imageData: string,
  contentId: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const supabase = createServiceClient();

    // Decode base64 image
    const buffer = Buffer.from(imageData, "base64");
    const fileName = `${contentId}-${Date.now()}.png`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).upload(fileName, buffer, {
      contentType: "image/png",
      upsert: true,
    });

    if (error) {
      console.error("[Thumbnail] Storage upload error:", error);
      return { url: null, error: error.message };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(data.path);

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error("[Thumbnail] Upload error:", error);
    return {
      url: null,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Generate thumbnail using Google Imagen 4 API
 * Uses @google/genai SDK
 */
export async function generateThumbnail(request: ThumbnailRequest): Promise<ThumbnailResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("[Thumbnail] GOOGLE_GEMINI_API_KEY not configured");
    return {
      success: false,
      thumbnail_url: DEFAULT_PLACEHOLDER,
      source: "default",
      error: "API key not configured",
    };
  }

  const prompt = generatePrompt(request.title, request.summary);
  console.log(`[Thumbnail] Generating for: "${request.title.slice(0, 50)}..."`);

  try {
    // Initialize Google GenAI client
    const ai = new GoogleGenAI({ apiKey });

    console.log(`[Thumbnail] Using model: ${IMAGEN_MODEL}`);

    // Generate image using Imagen 4
    const response = await ai.models.generateImages({
      model: IMAGEN_MODEL,
      prompt,
      config: {
        numberOfImages: 1,
      },
    });

    // Extract generated image
    const generatedImages = response.generatedImages;
    if (!generatedImages || generatedImages.length === 0) {
      console.error("[Thumbnail] No images generated");
      return {
        success: false,
        thumbnail_url: DEFAULT_PLACEHOLDER,
        source: "default",
        error: "No images generated",
      };
    }

    const firstImage = generatedImages[0];
    const imageBytes = firstImage?.image?.imageBytes;
    if (!imageBytes) {
      console.error("[Thumbnail] No image bytes in response");
      return {
        success: false,
        thumbnail_url: DEFAULT_PLACEHOLDER,
        source: "default",
        error: "No image data in response",
      };
    }

    // Upload to Supabase Storage
    const { url, error: uploadError } = await uploadToStorage(imageBytes, request.content_id);

    if (uploadError || !url) {
      console.error("[Thumbnail] Failed to upload:", uploadError);
      return {
        success: false,
        thumbnail_url: DEFAULT_PLACEHOLDER,
        source: "default",
        error: uploadError || "Upload failed",
      };
    }

    console.log(`[Thumbnail] Generated successfully: ${url}`);

    return {
      success: true,
      thumbnail_url: url,
      source: "gemini",
      cost_usd: 0.03,
    };
  } catch (error) {
    console.error("[Thumbnail] Generation error:", error);

    // Handle specific error types
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
      return {
        success: false,
        thumbnail_url: DEFAULT_PLACEHOLDER,
        source: "default",
        error: "Rate limit exceeded, try again later",
      };
    }

    if (errorMessage.includes("permission") || errorMessage.includes("403")) {
      return {
        success: false,
        thumbnail_url: DEFAULT_PLACEHOLDER,
        source: "default",
        error: "API key doesn't have Imagen access. Enable it in Google AI Studio.",
      };
    }

    if (errorMessage.includes("safety") || errorMessage.includes("blocked")) {
      return {
        success: false,
        thumbnail_url: DEFAULT_PLACEHOLDER,
        source: "default",
        error: "Content blocked by safety filters",
      };
    }

    return {
      success: false,
      thumbnail_url: DEFAULT_PLACEHOLDER,
      source: "default",
      error: errorMessage,
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
    console.error("[Thumbnail] OG image fetch error:", error);
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
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("contents")
      .update({
        thumbnail_url: thumbnailUrl,
        thumbnail_source: source,
        thumbnail_generated_at: source === "gemini" ? new Date().toISOString() : null,
      })
      .eq("id", contentId);

    if (error) {
      console.error("[Thumbnail] Failed to update:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Thumbnail] Database error:", error);
    return false;
  }
}

/**
 * Get thumbnail with fallback strategy
 * Priority: 1. OG Image (free) -> 2. Gemini Imagen ($0.03) -> 3. Default placeholder
 */
export async function getThumbnailWithFallback(
  contentId: string,
  sourceUrl: string,
  title: string,
  summary?: string,
  skipAiGeneration = false
): Promise<ThumbnailResult> {
  // Try OG Image first (faster and free)
  const ogResult = await fetchOgImage(sourceUrl);
  if (ogResult.success && ogResult.thumbnail_url) {
    await updateContentThumbnail(contentId, ogResult.thumbnail_url, "og_image");
    return ogResult;
  }

  // Skip AI generation if requested (for cost savings)
  if (skipAiGeneration) {
    return {
      success: true,
      thumbnail_url: DEFAULT_PLACEHOLDER,
      source: "default",
    };
  }

  // Try Gemini Imagen 4 generation
  const geminiResult = await generateThumbnail({
    content_id: contentId,
    title,
    summary,
  });

  if (
    geminiResult.success &&
    geminiResult.thumbnail_url &&
    geminiResult.thumbnail_url !== DEFAULT_PLACEHOLDER
  ) {
    await updateContentThumbnail(contentId, geminiResult.thumbnail_url, "gemini");
    return geminiResult;
  }

  // Return default placeholder
  await updateContentThumbnail(contentId, DEFAULT_PLACEHOLDER, "default");
  return {
    success: true,
    thumbnail_url: DEFAULT_PLACEHOLDER,
    source: "default",
  };
}
