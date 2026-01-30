import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// =====================================================
// Constants
// =====================================================

const GEMINI_MODEL = "gemini-2.0-flash-lite";

const TOKEN_COSTS = {
  input: 0.075,
  output: 0.3,
};

const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: "English",
  ko: "Korean",
  ja: "Japanese",
  zh: "Chinese (Simplified)",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
};

// =====================================================
// Types
// =====================================================

interface TranslationItem {
  id: string;
  type: "post" | "comment";
  text: string;
}

interface TranslationResult {
  id: string;
  type: "post" | "comment";
  translated_text: string;
  from_cache: boolean;
}

interface BatchTranslateRequest {
  items: TranslationItem[];
  targetLanguage: string;
}

// =====================================================
// POST /api/community/translate-batch
// 배치 번역 API - 여러 텍스트를 한 번에 번역
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: BatchTranslateRequest = await request.json();
    const { items, targetLanguage } = body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Items array is required" }, { status: 400 });
    }

    if (!targetLanguage || !SUPPORTED_LANGUAGES[targetLanguage]) {
      return NextResponse.json(
        { error: "Invalid target language", supported: Object.keys(SUPPORTED_LANGUAGES) },
        { status: 400 }
      );
    }

    // Limit batch size
    if (items.length > 100) {
      return NextResponse.json({ error: "Maximum 100 items per batch" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const results: TranslationResult[] = [];
    const itemsToTranslate: TranslationItem[] = [];

    // =====================================================
    // Step 1: Check cache for existing translations
    // =====================================================

    const postIds = items.filter((i) => i.type === "post").map((i) => i.id);
    const commentIds = items.filter((i) => i.type === "comment").map((i) => i.id);

    // Query cached translations
    const cachedMap = new Map<string, string>();

    if (postIds.length > 0) {
      const { data: cachedPosts } = await supabase
        .from("translations")
        .select("content_id, translated_text")
        .eq("content_type", "post")
        .eq("target_language", targetLanguage)
        .in("content_id", postIds);

      cachedPosts?.forEach((c: { content_id: string; translated_text: string }) => {
        cachedMap.set(`post:${c.content_id}`, c.translated_text);
      });
    }

    if (commentIds.length > 0) {
      const { data: cachedComments } = await supabase
        .from("translations")
        .select("content_id, translated_text")
        .eq("content_type", "comment")
        .eq("target_language", targetLanguage)
        .in("content_id", commentIds);

      cachedComments?.forEach((c: { content_id: string; translated_text: string }) => {
        cachedMap.set(`comment:${c.content_id}`, c.translated_text);
      });
    }

    // Separate cached and uncached items
    for (const item of items) {
      const cacheKey = `${item.type}:${item.id}`;
      const cached = cachedMap.get(cacheKey);

      if (cached) {
        results.push({
          id: item.id,
          type: item.type,
          translated_text: cached,
          from_cache: true,
        });
      } else {
        itemsToTranslate.push(item);
      }
    }

    // =====================================================
    // Step 2: Translate uncached items via Gemini
    // =====================================================

    if (itemsToTranslate.length > 0) {
      const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "Translation service unavailable" }, { status: 503 });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

      const toLang = SUPPORTED_LANGUAGES[targetLanguage];

      // Build batch prompt with numbered items
      const textList = itemsToTranslate
        .map((item, idx) => `[${idx + 1}] ${item.text}`)
        .join("\n\n");

      const prompt = `Translate each numbered text below to ${toLang}.
Keep the tone and style. Do not add explanations.
Output ONLY the translations in the same numbered format.
Each translation should be on its own line starting with [number].

Texts to translate:
${textList}`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8000,
        },
      });

      const response = result.response;
      const translatedText = response.text().trim();
      const usageMetadata = response.usageMetadata;

      // Parse numbered responses
      const translations = parseNumberedTranslations(translatedText, itemsToTranslate.length);

      // Calculate cost
      const inputTokens = usageMetadata?.promptTokenCount || 0;
      const outputTokens = usageMetadata?.candidatesTokenCount || 0;
      const totalTokens = inputTokens + outputTokens;
      const costUsd =
        (inputTokens / 1_000_000) * TOKEN_COSTS.input +
        (outputTokens / 1_000_000) * TOKEN_COSTS.output;

      // =====================================================
      // Step 3: Save translations to cache
      // =====================================================

      const translationRecords = itemsToTranslate.map((item, idx) => ({
        content_id: item.id,
        content_type: item.type,
        target_language: targetLanguage,
        translated_text: translations[idx] || item.text, // fallback to original
      }));

      // Upsert translations
      if (translationRecords.length > 0) {
        await supabase.from("translations").upsert(translationRecords, {
          onConflict: "content_id,content_type,target_language",
        });
      }

      // Add to results
      itemsToTranslate.forEach((item, idx) => {
        results.push({
          id: item.id,
          type: item.type,
          translated_text: translations[idx] || item.text,
          from_cache: false,
        });
      });

      // Log AI usage
      await supabase.from("ai_usage_log").insert({
        model: GEMINI_MODEL,
        operation: "batch_translation",
        request_type: "translation",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost_usd: costUsd,
        metadata: {
          target_language: targetLanguage,
          items_count: itemsToTranslate.length,
          cached_count: items.length - itemsToTranslate.length,
        },
      });
    }

    // Sort results to match input order
    const resultMap = new Map(results.map((r) => [`${r.type}:${r.id}`, r]));
    const sortedResults = items
      .map((item) => resultMap.get(`${item.type}:${item.id}`)!)
      .filter(Boolean);

    return NextResponse.json({
      translations: sortedResults,
      stats: {
        total: items.length,
        from_cache: results.filter((r) => r.from_cache).length,
        translated: itemsToTranslate.length,
      },
    });
  } catch (error) {
    console.error("[Batch Translation API] Error:", error);
    return NextResponse.json(
      {
        error: "Translation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// =====================================================
// Helper: Parse numbered translation responses
// =====================================================

function parseNumberedTranslations(text: string, expectedCount: number): string[] {
  const results: string[] = [];
  for (let i = 0; i < expectedCount; i++) {
    results.push("");
  }

  // Match both [1] text and 1. text formats
  const pattern = /(?:\[(\d+)\]|(\d+)\.)\s*(.+?)(?=\[\d+\]|\d+\.|$)/gs;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // match[1] = [n] format index, match[2] = n. format index, match[3] = text
    const indexStr = match[1] || match[2];
    const matchedText = match[3];
    if (indexStr && matchedText) {
      const index = parseInt(indexStr, 10) - 1;
      if (index >= 0 && index < expectedCount) {
        results[index] = matchedText.trim();
      }
    }
  }

  // Fallback: if regex didn't work well, try line-by-line
  let hasContent = false;
  for (const r of results) {
    if (r !== "") {
      hasContent = true;
      break;
    }
  }

  if (!hasContent) {
    const lines = text.split("\n").filter((l) => l.trim());
    for (let idx = 0; idx < lines.length && idx < expectedCount; idx++) {
      const line = lines[idx];
      if (line) {
        // Remove both [1] and 1. formats
        results[idx] = line
          .replace(/^\[\d+\]\s*/, "") // [1] format
          .replace(/^\d+\.\s*/, "") // 1. format
          .trim();
      }
    }
  }

  return results;
}
