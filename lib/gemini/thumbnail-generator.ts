/**
 * Dual-Model Thumbnail Generator
 * Generates AI thumbnails using both Imagen 4 and Gemini Flash Image models
 *
 * SDK: @google/genai
 * Models:
 *   - imagen-4.0-generate-001 (Imagen 4 Standard) - $0.04/image
 *   - gemini-2.5-flash-image (Gemini Flash Image) - $0.039/image
 *   - gemini-3-pro-image-preview (Gemini Pro Image) - $0.134/image (higher quality)
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
const GEMINI_FLASH_IMAGE_MODEL = "gemini-2.5-flash-image";
const DEFAULT_PLACEHOLDER = "/images/news-placeholder.svg";
const SUPABASE_BUCKET = "thumbnails";

// ===========================================
// Pricing Constants (USD per image/request)
// ===========================================
const IMAGE_GENERATION_COSTS = {
  [IMAGEN_MODEL]: 0.04, // $0.04/image
  [GEMINI_FLASH_IMAGE_MODEL]: 0.039, // $0.039/image (includes style transfer)
} as const;

/**
 * Log AI usage to database for cost tracking
 */
async function logAIUsage(params: {
  model: string;
  operation: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("ai_usage_log").insert({
      request_type: "image_generation",
      model: params.model,
      operation: params.operation,
      input_tokens: params.inputTokens || 0,
      output_tokens: params.outputTokens || 0,
      total_tokens: (params.inputTokens || 0) + (params.outputTokens || 0),
      cost_usd: params.costUsd,
      metadata: params.metadata || {},
    });
  } catch (error) {
    console.error("[Thumbnail] Failed to log AI usage:", error);
  }
}

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
  // Rich content for better image planning (from pipeline step 3)
  key_takeaways?: string[];
  one_liner?: string;
}

export interface ThumbnailResult {
  success: boolean;
  thumbnail_url?: string;
  source: "imagen" | "gemini_flash" | "og_image" | "manual" | "default";
  error?: string;
  cost_usd?: number;
  model?: string;
}

export interface DualThumbnailResult {
  imagen?: ThumbnailResult;
  gemini_flash?: ThumbnailResult;
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

CRITICAL - ABSOLUTELY NO TEXT: The image must contain ZERO text, letters, words, numbers, symbols, labels, captions, watermarks, logos, or any readable characters. No code, no syntax, no programming text.
AVOID: Human faces, company logos, abstract waves, flowing particles, sine wave patterns, any form of written text or code.
PREFER: Abstract geometric shapes, glowing nodes, colorful rectangles, 3D architectural elements, light effects.`;
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

    // Log AI usage for cost tracking
    await logAIUsage({
      model: IMAGEN_MODEL,
      operation: "thumbnail_imagen",
      costUsd: IMAGE_GENERATION_COSTS[IMAGEN_MODEL],
      metadata: { content_id: request.content_id, title: request.title.slice(0, 100) },
    });

    return {
      success: true,
      thumbnail_url: url,
      source: "imagen",
      cost_usd: IMAGE_GENERATION_COSTS[IMAGEN_MODEL],
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

// ===========================================
// OG+AI Fusion Thumbnail Generation (Single Model Approach)
// ===========================================

/**
 * Fetch OG image and convert to base64 for Gemini Flash Image input
 */
async function fetchOgImageAsBase64(
  ogImageUrl: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const imageResponse = await fetch(ogImageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CCgather/1.0)" },
    });
    if (!imageResponse.ok) {
      console.error("[Thumbnail] Failed to fetch OG image:", imageResponse.status);
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

    return { data: base64Image, mimeType };
  } catch (error) {
    console.error("[Thumbnail] OG image fetch error:", error);
    return null;
  }
}

/**
 * Extract key concepts from article title for image generation
 * Kept for potential future use, currently replaced by rich content analysis in style transfer
 */
export function extractArticleConcepts(title: string): string[] {
  const concepts: string[] = [];

  // AI/Tech company keywords → visual concepts
  const companyToConcept: Record<string, string> = {
    anthropic: "AI brain with neural connections",
    openai: "futuristic AI interface",
    google: "interconnected data nodes",
    microsoft: "enterprise cloud architecture",
    meta: "virtual reality environment",
    nvidia: "GPU processing visualization",
  };

  // Feature keywords → visual concepts
  const featureToConcept: Record<string, string> = {
    agent: "autonomous robotic arm or AI assistant visualization",
    agentic: "self-operating digital workflow",
    automation: "flowing automated process with connected nodes",
    file: "organized digital documents floating in space",
    cowork: "collaborative workspace with AI elements",
    api: "connected endpoints and data streams",
    model: "neural network layers visualization",
    launch: "rocket or upward momentum visualization",
    update: "evolving transformation visual",
    security: "digital shield with protection elements",
    // Developer/Code related - NO TEXT INDUCING WORDS
    json: "layered geometric rectangles in dark interface with colorful accents",
    schema: "interconnected nodes forming a validation flowchart without any labels",
    structured: "organized hierarchy of colored blocks connected by lines",
    output: "dark screen with glowing colorful horizontal bars",
    code: "dark interface with stacked colorful rectangular blocks",
    developer: "modern dark workspace with geometric UI elements",
    programming: "modular colored blocks arranged in patterns",
    sdk: "3D building blocks floating in organized formation",
    cli: "dark terminal aesthetic with glowing geometric lines",
    // AI/ML specific - ABSTRACT VISUALS ONLY
    claude: "AI brain visualization with warm orange neural connections",
    prompt: "glowing input interface with processing light effects",
    llm: "layered transformer architecture with flowing light particles",
    chatbot: "abstract conversation flow with connected speech bubbles shapes",
    embedding: "3D vector space with clustered glowing spheres",
    // Integration/System
    integration: "puzzle pieces connecting in 3D space",
    workflow: "connected geometric shapes forming a process flow",
    pipeline: "sequential glowing tubes with data light flowing through",
    config: "control panel with sliders and toggle switches",
  };

  const lowerTitle = title.toLowerCase();

  // Extract company concepts
  for (const [keyword, concept] of Object.entries(companyToConcept)) {
    if (lowerTitle.includes(keyword)) {
      concepts.push(concept);
      break; // Only one company
    }
  }

  // Extract feature concepts (up to 2)
  let featureCount = 0;
  for (const [keyword, concept] of Object.entries(featureToConcept)) {
    if (lowerTitle.includes(keyword) && featureCount < 2) {
      concepts.push(concept);
      featureCount++;
    }
  }

  return concepts;
}

/**
 * Image concept data for thumbnail generation
 */
interface ImageConceptData {
  title: string;
  summary?: string;
  keyTakeaways?: string[];
  oneLiner?: string;
  articleType?: ArticleType;
}

/**
 * Generate style-transfer prompt for Gemini Flash Image
 * Two-phase approach within single call:
 * 1. Analyze content → Plan image concept
 * 2. Analyze OG style → Generate matching image
 */
function generateStyleTransferPrompt(conceptData: ImageConceptData): string {
  const { title, summary, keyTakeaways, oneLiner, articleType } = conceptData;

  // Build rich content context for image planning
  const contentContext = [
    `TITLE: ${title}`,
    oneLiner ? `ONE-LINER: ${oneLiner}` : null,
    summary ? `SUMMARY: ${summary.slice(0, 500)}` : null,
    keyTakeaways?.length ? `KEY POINTS:\n${keyTakeaways.map((k) => `- ${k}`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Chain-of-thought style prompt for better image planning
  const prompt = `You are a professional editorial thumbnail designer. Your task is to create a compelling news thumbnail.

═══════════════════════════════════════════════════
PHASE 1: UNDERSTAND THE ARTICLE CONTENT
═══════════════════════════════════════════════════

${contentContext}

Based on this content, think about:
- What is the CORE MESSAGE of this article?
- What VISUAL METAPHOR would best represent this story?
- What SCENE or IMAGERY would readers immediately associate with this topic?

═══════════════════════════════════════════════════
PHASE 2: ANALYZE THE REFERENCE IMAGE STYLE
═══════════════════════════════════════════════════

Look at the reference image above and identify:
- Visual style (photographic, illustration, 3D render, graphic design, etc.)
- Color palette and color temperature
- Lighting characteristics
- Composition and framing style
- Overall mood and atmosphere

═══════════════════════════════════════════════════
PHASE 3: CREATE THE THUMBNAIL
═══════════════════════════════════════════════════

Now generate a NEW thumbnail that:

1. REPRESENTS THE ARTICLE: The image should visually communicate the article's core message
   - If it's about a company expansion → show relevant architectural/business imagery
   - If it's about a product launch → show the product category or its impact
   - If it's about AI technology → show appropriate tech visualization
   - If it's about an event → show the event atmosphere or outcome

2. MATCHES THE REFERENCE STYLE: Apply the same visual style from the reference
   - Same type of imagery (photo-realistic if reference is photo, illustrated if reference is illustration)
   - Same color mood and palette
   - Same lighting approach
   - Same level of detail and polish

3. EDITORIAL QUALITY: Professional news thumbnail standards
   - 16:9 aspect ratio
   - Clear focal point
   - Visually striking but informative

⚠️ RULES:
- NO text, logos, watermarks, or brand names in the image
- Create ORIGINAL imagery (don't copy specific objects from reference)
- Match the STYLE, not the exact content of the reference

OUTPUT: Generate a single professional thumbnail image.`;

  console.log(
    `[Thumbnail] Style transfer with content analysis for: "${title.slice(0, 50)}..." (type: ${articleType || "auto"})`
  );
  return prompt;
}

/**
 * Generate thumbnail using OG image as style reference (Single Model Approach)
 * Uses Gemini Flash Image to analyze OG style AND generate new image in one call
 *
 * Benefits:
 * - Single API call (cost efficient)
 * - Consistent style interpretation (same model analyzes and generates)
 * - No separate Vision API dependency
 */
export async function generateThumbnailWithOgReference(
  request: ThumbnailRequest & { og_image_url: string }
): Promise<ThumbnailResult> {
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

  console.log(`[Thumbnail] Generating OG style-transfer for: "${request.title.slice(0, 50)}..."`);

  // Step 1: Fetch OG image as base64
  const ogImageData = await fetchOgImageAsBase64(request.og_image_url);
  if (!ogImageData) {
    console.log("[Thumbnail] OG image fetch failed, falling back to standard generation");
    return generateThumbnailWithGeminiFlash(request);
  }

  // Step 2: Generate style transfer prompt with rich content
  const stylePrompt = generateStyleTransferPrompt({
    title: request.title,
    summary: request.summary,
    keyTakeaways: request.key_takeaways,
    oneLiner: request.one_liner,
    articleType: request.article_type,
  });

  try {
    // Step 3: Single call to Gemini Flash Image with OG image input
    const ai = new GoogleGenAI({ apiKey });

    console.log(`[Thumbnail] Using model: ${GEMINI_FLASH_IMAGE_MODEL} (with OG reference)`);

    const response = await ai.models.generateContent({
      model: GEMINI_FLASH_IMAGE_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: ogImageData.mimeType,
                data: ogImageData.data,
              },
            },
            {
              text: stylePrompt,
            },
          ],
        },
      ],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    // Extract generated image from response
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      console.error("[Thumbnail] No content in style-transfer response");
      return generateThumbnailWithGeminiFlash(request);
    }

    // Find image part in response
    const imagePart = candidate.content.parts.find(
      (part: { inlineData?: { mimeType?: string; data?: string } }) =>
        part.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart?.inlineData?.data) {
      console.error("[Thumbnail] No image generated from style-transfer");
      return generateThumbnailWithGeminiFlash(request);
    }

    // Upload to Supabase Storage
    const { url, error: uploadError } = await uploadToStorage(
      imagePart.inlineData.data,
      `style-${request.content_id}`
    );

    if (uploadError || !url) {
      console.error("[Thumbnail] Failed to upload style-transfer image:", uploadError);
      return {
        success: false,
        thumbnail_url: DEFAULT_PLACEHOLDER,
        source: "default",
        error: uploadError || "Upload failed",
      };
    }

    console.log(`[Thumbnail] OG style-transfer generated successfully: ${url}`);

    // Log AI usage - single model call
    await logAIUsage({
      model: GEMINI_FLASH_IMAGE_MODEL,
      operation: "thumbnail_style_transfer",
      costUsd: IMAGE_GENERATION_COSTS[GEMINI_FLASH_IMAGE_MODEL],
      metadata: {
        content_id: request.content_id,
        title: request.title.slice(0, 100),
        og_image_url: request.og_image_url,
        method: "single_model_style_transfer",
      },
    });

    return {
      success: true,
      thumbnail_url: url,
      source: "gemini_flash",
      model: GEMINI_FLASH_IMAGE_MODEL,
      cost_usd: IMAGE_GENERATION_COSTS[GEMINI_FLASH_IMAGE_MODEL],
    };
  } catch (error) {
    console.error("[Thumbnail] Style-transfer generation error:", error);
    // Fallback to standard generation on error
    return generateThumbnailWithGeminiFlash(request);
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
        thumbnail_generated_at:
          source === "imagen" || source === "gemini_flash" ? new Date().toISOString() : null,
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
 * Rich content options for better thumbnail generation
 */
export interface ThumbnailRichContent {
  key_takeaways?: string[];
  one_liner?: string;
}

/**
 * Get thumbnail with fallback strategy
 * Priority:
 *   1. OG Style Transfer (if OG image available) - uses OG colors/mood + article content analysis
 *   2. Standard AI Generation (if no OG image)
 *   3. OG Image (fallback if AI fails)
 *   4. Default placeholder
 *
 * @param model - "imagen" for Imagen 4, "gemini_flash" for Gemini Flash Image (default)
 * @param useStyleTransfer - if true, attempts OG style transfer first (default: true)
 * @param richContent - additional content for better image planning (key_takeaways, one_liner)
 *
 * Note: AI-generated thumbnails are preferred because OG images are excluded
 * from display in NewsCard for visual consistency.
 */
export async function getThumbnailWithFallback(
  contentId: string,
  sourceUrl: string,
  title: string,
  summary?: string,
  skipAiGeneration = false,
  articleType?: ArticleType,
  model: "imagen" | "gemini_flash" = "gemini_flash",
  useStyleTransfer = true,
  richContent?: ThumbnailRichContent
): Promise<ThumbnailResult> {
  // Skip AI generation if requested (for cost savings)
  if (skipAiGeneration) {
    // Try OG Image as fallback
    const ogResult = await fetchOgImage(sourceUrl);
    if (ogResult.success && ogResult.thumbnail_url) {
      await updateContentThumbnail(contentId, ogResult.thumbnail_url, "og_image");
      return ogResult;
    }
    return {
      success: true,
      thumbnail_url: DEFAULT_PLACEHOLDER,
      source: "default",
    };
  }

  // Generate AI thumbnail based on selected model
  const request: ThumbnailRequest = {
    content_id: contentId,
    title,
    summary,
    article_type: articleType,
    key_takeaways: richContent?.key_takeaways,
    one_liner: richContent?.one_liner,
  };

  let aiResult: ThumbnailResult;
  let thumbnailSource: ThumbnailResult["source"];

  // Try OG Style Transfer first (if enabled and using gemini_flash)
  if (useStyleTransfer && model === "gemini_flash") {
    // First, check if OG image is available
    const ogResult = await fetchOgImage(sourceUrl);
    if (ogResult.success && ogResult.thumbnail_url) {
      console.log(`[Thumbnail] Attempting OG style transfer for: "${title.slice(0, 50)}..."`);
      aiResult = await generateThumbnailWithOgReference({
        ...request,
        og_image_url: ogResult.thumbnail_url,
      });
      thumbnailSource = "gemini_flash";

      if (
        aiResult.success &&
        aiResult.thumbnail_url &&
        aiResult.thumbnail_url !== DEFAULT_PLACEHOLDER
      ) {
        const updated = await updateContentThumbnail(
          contentId,
          aiResult.thumbnail_url,
          thumbnailSource
        );
        if (!updated) {
          console.warn(
            `[Thumbnail] Failed to update DB for style-transfer thumbnail: ${contentId}`
          );
        }
        return aiResult;
      }
      console.log(`[Thumbnail] Style transfer failed, falling back to standard generation`);
    }
  }

  // Standard AI generation (no OG reference)
  if (model === "imagen") {
    // Use Imagen 4 model
    console.log(`[Thumbnail] Using Imagen 4 for: "${title.slice(0, 50)}..."`);
    aiResult = await generateThumbnail(request);
    thumbnailSource = "imagen";
  } else {
    // Use Gemini Flash Image model (default)
    console.log(`[Thumbnail] Using Gemini Flash for: "${title.slice(0, 50)}..."`);
    aiResult = await generateThumbnailWithGeminiFlash(request);
    thumbnailSource = "gemini_flash";
  }

  if (
    aiResult.success &&
    aiResult.thumbnail_url &&
    aiResult.thumbnail_url !== DEFAULT_PLACEHOLDER
  ) {
    const updated = await updateContentThumbnail(
      contentId,
      aiResult.thumbnail_url,
      thumbnailSource
    );
    if (!updated) {
      console.warn(`[Thumbnail] Failed to update DB for AI thumbnail: ${contentId}`);
    }
    return aiResult;
  }

  // Log AI generation failure reason
  console.warn(
    `[Thumbnail] AI generation failed for ${contentId}: ${aiResult.error || "unknown reason"}`
  );

  // Fallback to OG Image if AI generation fails
  const ogResult = await fetchOgImage(sourceUrl);
  if (ogResult.success && ogResult.thumbnail_url) {
    const updated = await updateContentThumbnail(contentId, ogResult.thumbnail_url, "og_image");
    if (!updated) {
      console.warn(`[Thumbnail] Failed to update DB for OG thumbnail: ${contentId}`);
    }
    console.log(`[Thumbnail] Fallback to OG image for: ${contentId}`);
    return ogResult;
  }

  // Final fallback: set thumbnail_source to "default" even if URL exists from initial insert
  console.warn(`[Thumbnail] All methods failed for ${contentId}, using default`);
  await updateContentThumbnail(contentId, DEFAULT_PLACEHOLDER, "default");
  return {
    success: true,
    thumbnail_url: DEFAULT_PLACEHOLDER,
    source: "default",
  };
}

// ===========================================
// Gemini Flash Image Generation
// ===========================================

/**
 * Generate thumbnail using Gemini 2.0 Flash Image model
 * Uses conversational image generation approach
 */
export async function generateThumbnailWithGeminiFlash(
  request: ThumbnailRequest
): Promise<ThumbnailResult> {
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
  console.log(`[Thumbnail] Gemini Flash generating for: "${request.title.slice(0, 50)}..."`);

  try {
    const ai = new GoogleGenAI({ apiKey });

    console.log(`[Thumbnail] Using model: ${GEMINI_FLASH_IMAGE_MODEL}`);

    // Generate image using Gemini Flash Image
    const response = await ai.models.generateContent({
      model: GEMINI_FLASH_IMAGE_MODEL,
      contents: `Generate a professional tech news thumbnail image (16:9 aspect ratio).\n\n${prompt}`,
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    // Extract generated image from response
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      console.error("[Thumbnail] No content in Gemini Flash response");
      return {
        success: false,
        thumbnail_url: DEFAULT_PLACEHOLDER,
        source: "default",
        error: "No content in response",
      };
    }

    // Find image part in response
    const imagePart = candidate.content.parts.find(
      (part: { inlineData?: { mimeType?: string; data?: string } }) =>
        part.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart?.inlineData?.data) {
      console.error("[Thumbnail] No image data in Gemini Flash response");
      return {
        success: false,
        thumbnail_url: DEFAULT_PLACEHOLDER,
        source: "default",
        error: "No image generated",
      };
    }

    // Upload to Supabase Storage
    const { url, error: uploadError } = await uploadToStorage(
      imagePart.inlineData.data,
      `flash-${request.content_id}`
    );

    if (uploadError || !url) {
      console.error("[Thumbnail] Failed to upload Gemini Flash image:", uploadError);
      return {
        success: false,
        thumbnail_url: DEFAULT_PLACEHOLDER,
        source: "default",
        error: uploadError || "Upload failed",
      };
    }

    console.log(`[Thumbnail] Gemini Flash generated successfully: ${url}`);

    // Log AI usage for cost tracking
    await logAIUsage({
      model: GEMINI_FLASH_IMAGE_MODEL,
      operation: "thumbnail_gemini",
      costUsd: IMAGE_GENERATION_COSTS[GEMINI_FLASH_IMAGE_MODEL],
      metadata: { content_id: request.content_id, title: request.title.slice(0, 100) },
    });

    return {
      success: true,
      thumbnail_url: url,
      source: "gemini_flash",
      model: GEMINI_FLASH_IMAGE_MODEL,
      cost_usd: IMAGE_GENERATION_COSTS[GEMINI_FLASH_IMAGE_MODEL],
    };
  } catch (error) {
    console.error("[Thumbnail] Gemini Flash generation error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return {
      success: false,
      thumbnail_url: DEFAULT_PLACEHOLDER,
      source: "default",
      error: errorMessage,
    };
  }
}

// ===========================================
// Dual Model Generation (Imagen + Gemini Flash)
// ===========================================

/**
 * Generate thumbnails using BOTH Imagen 4 and Gemini Flash Image models
 * Returns both results for comparison/selection
 */
export async function generateDualThumbnails(
  request: ThumbnailRequest
): Promise<DualThumbnailResult> {
  console.log(`[Thumbnail] Dual generation for: "${request.title.slice(0, 50)}..."`);

  // Run both generations in parallel
  const [imagenResult, geminiFlashResult] = await Promise.allSettled([
    generateThumbnail(request),
    generateThumbnailWithGeminiFlash(request),
  ]);

  const result: DualThumbnailResult = {};

  if (imagenResult.status === "fulfilled") {
    result.imagen = imagenResult.value;
  } else {
    result.imagen = {
      success: false,
      source: "default",
      error: imagenResult.reason?.message || "Imagen generation failed",
    };
  }

  if (geminiFlashResult.status === "fulfilled") {
    result.gemini_flash = geminiFlashResult.value;
  } else {
    result.gemini_flash = {
      success: false,
      source: "default",
      error: geminiFlashResult.reason?.message || "Gemini Flash generation failed",
    };
  }

  console.log(
    `[Thumbnail] Dual generation complete - Imagen: ${result.imagen?.success}, Flash: ${result.gemini_flash?.success}`
  );

  return result;
}

/**
 * Generate dual thumbnails with OG image reference
 */
export async function generateDualThumbnailsWithOgReference(
  request: ThumbnailRequest & { og_image_url: string }
): Promise<DualThumbnailResult> {
  console.log(`[Thumbnail] Dual OG+AI generation for: "${request.title.slice(0, 50)}..."`);

  // Run both generations in parallel
  const [imagenResult, geminiFlashResult] = await Promise.allSettled([
    generateThumbnailWithOgReference(request),
    generateThumbnailWithGeminiFlash(request), // Gemini Flash uses standard prompt
  ]);

  const result: DualThumbnailResult = {};

  if (imagenResult.status === "fulfilled") {
    result.imagen = imagenResult.value;
  } else {
    result.imagen = {
      success: false,
      source: "default",
      error: imagenResult.reason?.message || "Imagen OG+AI generation failed",
    };
  }

  if (geminiFlashResult.status === "fulfilled") {
    result.gemini_flash = geminiFlashResult.value;
  } else {
    result.gemini_flash = {
      success: false,
      source: "default",
      error: geminiFlashResult.reason?.message || "Gemini Flash generation failed",
    };
  }

  return result;
}
