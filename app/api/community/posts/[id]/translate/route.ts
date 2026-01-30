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

interface TranslateRequest {
  targetLanguage: string;
}

// =====================================================
// POST /api/community/posts/[id]/translate
// 단일 포스트 번역 (온디맨드 요청용)
// =====================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: postId } = await params;
    const body: TranslateRequest = await request.json();
    const { targetLanguage } = body;

    // Validate target language
    if (!targetLanguage || !SUPPORTED_LANGUAGES[targetLanguage]) {
      return NextResponse.json(
        { error: "Invalid target language", supported: Object.keys(SUPPORTED_LANGUAGES) },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get the post
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id, content, original_language")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Skip if same language
    if (post.original_language === targetLanguage) {
      return NextResponse.json({
        translated_content: post.content,
        from_cache: true,
        cost_usd: 0,
      });
    }

    // Check translations cache table
    const { data: cachedTranslation } = await supabase
      .from("translations")
      .select("translated_text")
      .eq("content_id", postId)
      .eq("content_type", "post")
      .eq("target_language", targetLanguage)
      .single();

    if (cachedTranslation) {
      return NextResponse.json({
        translated_content: cachedTranslation.translated_text,
        from_cache: true,
        cost_usd: 0,
      });
    }

    // Initialize Gemini
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Translation service unavailable" }, { status: 503 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Create translation prompt
    const fromLang = SUPPORTED_LANGUAGES[post.original_language] || "Unknown";
    const toLang = SUPPORTED_LANGUAGES[targetLanguage];

    const prompt = `Translate the following text from ${fromLang} to ${toLang}.
Keep the tone and style. Do not add explanations. Only output the translated text.

Text to translate:
${post.content}`;

    // Call Gemini API
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
      },
    });

    const response = result.response;
    const translatedContent = response.text().trim();
    const usageMetadata = response.usageMetadata;

    // Calculate cost
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = inputTokens + outputTokens;
    const costUsd =
      (inputTokens / 1_000_000) * TOKEN_COSTS.input +
      (outputTokens / 1_000_000) * TOKEN_COSTS.output;

    // Save translation to translations cache table
    await supabase.from("translations").upsert(
      {
        content_id: postId,
        content_type: "post",
        target_language: targetLanguage,
        translated_text: translatedContent,
      },
      {
        onConflict: "content_id,content_type,target_language",
      }
    );

    // Log AI usage
    await supabase.from("ai_usage_log").insert({
      model: GEMINI_MODEL,
      operation: "post_translation",
      request_type: "translation",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      cost_usd: costUsd,
      metadata: {
        post_id: postId,
        from_language: post.original_language,
        to_language: targetLanguage,
        content_length: post.content.length,
      },
    });

    return NextResponse.json({
      translated_content: translatedContent,
      from_cache: false,
      cost_usd: costUsd,
      tokens_used: totalTokens,
    });
  } catch (error) {
    console.error("[Translation API] Error:", error);
    return NextResponse.json(
      {
        error: "Translation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
