/**
 * Gemini Imagen 4 Thumbnail Generator
 * Generates AI thumbnails for news articles using Google Imagen 4 API
 *
 * SDK: @google/genai
 * Model: imagen-4.0-generate-001 (Standard)
 * Pricing: $0.04 per image
 *
 * Theme Selection Priority:
 * 1. AI-classified article_type from DB (most accurate)
 * 2. Keyword-based fallback detection
 */

import { GoogleGenAI } from "@google/genai";
import { createServiceClient } from "@/lib/supabase/server";
import type { ArticleType } from "@/lib/ai/gemini-client";

// Configuration
const IMAGEN_MODEL = "imagen-4.0-generate-001";
const DEFAULT_PLACEHOLDER = "/images/news-placeholder.svg";
const SUPABASE_BUCKET = "thumbnails";

// ===========================================
// Visual Theme System for News Categories
// ===========================================

type VisualThemeKey =
  | "corporate"
  | "ai_technology"
  | "product"
  | "funding"
  | "partnership"
  | "security"
  | "default";

// ===========================================
// ArticleType → VisualTheme Mapping (Primary Source)
// ===========================================

/**
 * Maps AI-classified ArticleType to VisualTheme
 * This is the PRIMARY and most accurate source for theme selection
 */
const ARTICLE_TYPE_TO_VISUAL_THEME: Record<ArticleType, VisualThemeKey> = {
  product_launch: "product",
  version_update: "product",
  tutorial: "ai_technology",
  interview: "corporate",
  analysis: "ai_technology",
  security: "security",
  event: "corporate",
  research: "ai_technology",
  integration: "partnership",
  pricing: "funding",
  showcase: "product",
  opinion: "default",
  general: "default",
};

interface VisualTheme {
  subjects: string[];
  contexts: string[];
  style: string;
  lighting: string;
  mood: string;
}

const NEWS_VISUAL_THEMES: Record<VisualThemeKey, VisualTheme> = {
  corporate: {
    subjects: [
      "modern glass office building with reflective facade",
      "corporate headquarters tower in urban setting",
      "sleek tech campus with contemporary architecture",
    ],
    contexts: [
      "cityscape at golden hour",
      "professional business district",
      "urban skyline with modern buildings",
    ],
    style: "architectural photography, editorial magazine quality, cinematic composition",
    lighting: "golden hour warm sunlight, dramatic long shadows",
    mood: "ambitious, professional, forward-looking, innovative",
  },

  ai_technology: {
    subjects: [
      "abstract neural network visualization with glowing nodes",
      "flowing data streams in digital space",
      "geometric AI brain concept with circuit patterns",
    ],
    contexts: [
      "dark background with soft blue and purple gradients",
      "digital void with floating particles",
      "abstract technological environment",
    ],
    style: "3D render aesthetic, tech illustration, cinematic sci-fi look",
    lighting: "neon blue and purple accent lighting, soft ambient glow",
    mood: "futuristic, intelligent, cutting-edge, mysterious",
  },

  product: {
    subjects: [
      "sleek consumer tech device on minimalist pedestal",
      "modern gadget with clean lines floating in space",
      "premium product showcase with subtle reflections",
    ],
    contexts: [
      "clean gradient background fading from dark to light",
      "professional studio environment",
      "minimalist setting with soft shadows",
    ],
    style: "product photography, Apple-style minimalism, premium aesthetic",
    lighting: "soft studio lighting, rim light highlights, subtle shadows",
    mood: "premium, desirable, innovative, sleek",
  },

  funding: {
    subjects: [
      "abstract upward growing bars and charts",
      "geometric shapes ascending in formation",
      "stylized growth visualization with dynamic lines",
    ],
    contexts: [
      "professional dark background with subtle grid",
      "clean space with depth and dimension",
      "minimal environment with accent colors",
    ],
    style: "infographic aesthetic, clean vector look, professional business graphics",
    lighting: "soft ambient light, accent highlights on key elements",
    mood: "growth, success, opportunity, momentum",
  },

  partnership: {
    subjects: [
      "two abstract geometric shapes connecting",
      "interlinked circular forms symbolizing unity",
      "handshake silhouette made of digital particles",
    ],
    contexts: [
      "professional gradient background",
      "clean corporate environment",
      "balanced symmetrical composition",
    ],
    style: "corporate graphic design, professional illustration, symbolic imagery",
    lighting: "balanced even lighting, soft gradients",
    mood: "collaboration, synergy, trust, professional",
  },

  security: {
    subjects: [
      "abstract digital shield with glowing edges",
      "secure lock icon surrounded by data streams",
      "protective barrier visualization with hexagonal patterns",
    ],
    contexts: [
      "dark background with red and orange warning accents",
      "digital environment with security grid overlay",
      "cyber space with alert indicators",
    ],
    style: "cybersecurity aesthetic, tech illustration, urgent professional look",
    lighting: "dramatic red and orange accent lighting, high contrast",
    mood: "urgent, protective, alert, professional",
  },

  default: {
    subjects: [
      "abstract tech-inspired geometric composition",
      "modern minimalist design with flowing lines",
      "contemporary digital art with subtle patterns",
    ],
    contexts: [
      "dark gradient background from navy to black",
      "clean professional backdrop",
      "minimal space with depth",
    ],
    style: "modern digital art, tech aesthetic, editorial quality",
    lighting: "soft accent lighting, subtle highlights",
    mood: "professional, innovative, tech-forward, clean",
  },
};

// ===========================================
// Keyword Extraction and Theme Detection
// ===========================================

interface ExtractedKeywords {
  company?: string;
  action?: string;
  location?: string;
  topic?: string;
}

const COMPANY_PATTERNS =
  /\b(OpenAI|Google|Microsoft|Apple|Meta|Amazon|Anthropic|Nvidia|Tesla|Samsung|IBM|Intel|AMD|Qualcomm|Adobe|Salesforce|Oracle|Cisco|Uber|Lyft|Airbnb|Netflix|Spotify|Twitter|X Corp|LinkedIn|GitHub|Figma|Notion|Slack|Zoom|Dropbox|Stripe|Square|PayPal|Coinbase|Binance|ByteDance|TikTok|Alibaba|Tencent|Baidu|Huawei|Xiaomi)\b/i;

const LOCATION_PATTERNS =
  /\b(San Francisco|New York|Seattle|Los Angeles|Boston|Austin|Denver|Chicago|Washington|London|Paris|Berlin|Tokyo|Seoul|Singapore|Hong Kong|Shanghai|Beijing|Sydney|Toronto|Vancouver|Silicon Valley|Bay Area)\b/i;

const ACTION_PATTERNS = {
  corporate: /\b(expansion|expands?|headquarters|office|campus|relocat|moves?|opens?|building)\b/i,
  funding: /\b(funding|raises?|investment|valuation|IPO|series [A-Z]|million|billion|capital)\b/i,
  product:
    /\b(launch|launches?|releases?|announces?|unveils?|introduces?|new product|feature|update|version)\b/i,
  partnership:
    /\b(partnership|partners?|collaborat|acquires?|acquisition|merger|deal|agreement|joins?)\b/i,
  ai_technology:
    /\b(AI|artificial intelligence|machine learning|ML|GPT|LLM|neural|model|algorithm|AGI|chatbot|generative)\b/i,
};

function extractKeywords(title: string): ExtractedKeywords {
  return {
    company: title.match(COMPANY_PATTERNS)?.[0],
    location: title.match(LOCATION_PATTERNS)?.[0],
    action: detectAction(title),
    topic: detectTopic(title),
  };
}

function detectAction(title: string): string | undefined {
  for (const [action, pattern] of Object.entries(ACTION_PATTERNS)) {
    if (pattern.test(title)) {
      return action;
    }
  }
  return undefined;
}

function detectTopic(title: string): string | undefined {
  const topicPatterns: Record<string, RegExp> = {
    ai: /\b(AI|GPT|LLM|Claude|Gemini|ChatGPT|Copilot|neural|machine learning)\b/i,
    cloud: /\b(cloud|AWS|Azure|GCP|infrastructure|server|data center)\b/i,
    mobile: /\b(iPhone|Android|mobile|smartphone|tablet|app store)\b/i,
    security: /\b(security|privacy|hack|breach|cyber|encryption)\b/i,
    finance: /\b(fintech|payment|banking|crypto|blockchain|bitcoin)\b/i,
  };

  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(title)) {
      return topic;
    }
  }
  return undefined;
}

function detectVisualTheme(keywords: ExtractedKeywords): VisualThemeKey {
  // Priority-based theme detection
  if (keywords.action === "funding") return "funding";
  if (keywords.action === "partnership") return "partnership";
  if (keywords.action === "product") return "product";
  if (keywords.action === "ai_technology" || keywords.topic === "ai") return "ai_technology";
  if (keywords.action === "corporate" || keywords.location) return "corporate";

  return "default";
}

export interface ThumbnailRequest {
  content_id: string;
  title: string;
  summary?: string;
  source_name?: string;
  article_type?: ArticleType; // AI-classified article type from DB (primary source)
  force_regenerate?: boolean;
}

export interface ThumbnailResult {
  success: boolean;
  thumbnail_url?: string;
  source: "gemini" | "og_image" | "manual" | "default";
  error?: string;
  cost_usd?: number;
}

// ===========================================
// Improved Prompt Generation
// ===========================================

/**
 * Generate optimized thumbnail prompt based on article content
 * Uses structured prompt format: Subject + Context + Style + Quality
 */
function generatePrompt(title: string, summary?: string, articleType?: ArticleType): string {
  // Extract keywords from title and summary (for location detection)
  const combinedText = summary ? `${title} ${summary}` : title;
  const keywords = extractKeywords(combinedText);

  // Theme selection priority:
  // 1. AI-classified article_type from DB (most accurate)
  // 2. Keyword-based fallback detection
  let themeKey: VisualThemeKey;

  if (articleType && ARTICLE_TYPE_TO_VISUAL_THEME[articleType]) {
    // PRIMARY: Use AI-classified article type
    themeKey = ARTICLE_TYPE_TO_VISUAL_THEME[articleType];
    console.log(`[Thumbnail] Using AI-classified type: ${articleType} → theme: ${themeKey}`);
  } else {
    // FALLBACK: Use keyword-based detection
    themeKey = detectVisualTheme(keywords);
    console.log(`[Thumbnail] Using keyword fallback → theme: ${themeKey}`);
  }

  const theme = NEWS_VISUAL_THEMES[themeKey];

  // Select random elements for variety (with fallbacks)
  const subjectIndex = Math.floor(Math.random() * theme.subjects.length);
  const contextIndex = Math.floor(Math.random() * theme.contexts.length);
  const subject =
    theme.subjects[subjectIndex] || theme.subjects[0] || "abstract tech visualization";
  const context =
    theme.contexts[contextIndex] || theme.contexts[0] || "professional dark background";

  // Build location-aware subject if applicable
  const locationSubject = keywords.location
    ? subject.replace(
        /\b(in urban setting|in digital space|floating in space)\b/gi,
        `in ${keywords.location}`
      )
    : subject;

  // Construct the optimized prompt
  return `${locationSubject}, ${context}.

Style: ${theme.style}
Lighting: ${theme.lighting}
Camera: Wide angle lens, 35mm, professional composition, rule of thirds.
Quality: 4K resolution, high detail, sharp focus, professional grade photography.
Mood: ${theme.mood}
Color palette: Deep navy blue, warm coral orange accents, electric blue highlights.

Important: Do not include any text, words, letters, human faces, or company logos in the image.`;
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

  const prompt = generatePrompt(request.title, request.summary, request.article_type);
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
        aspectRatio: "16:9", // Optimal for news thumbnails
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
      cost_usd: 0.04,
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
  skipAiGeneration = false,
  articleType?: ArticleType
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
    article_type: articleType,
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
