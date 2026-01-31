import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// =====================================================
// Types
// =====================================================

interface CommentAuthor {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  current_level: number;
}

interface ReplyResponse {
  id: string;
  author: CommentAuthor;
  content: string;
  original_content?: string;
  translated_content?: string;
  original_language: string; // Always include for language indicator display
  is_translated?: boolean;
  parent_comment_id: string;
  created_at: string;
  likes_count: number;
  is_liked: boolean;
}

// =====================================================
// Translation Constants
// =====================================================

const GEMINI_MODEL = "gemini-2.0-flash-lite";
const TOKEN_COSTS = { input: 0.075, output: 0.3 };
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

// Country to language mapping
function countryToLanguage(countryCode: string | null | undefined): string {
  if (!countryCode) return "en";
  const countryLangMap: Record<string, string> = {
    KR: "ko",
    JP: "ja",
    CN: "zh",
    TW: "zh",
    DE: "de",
    FR: "fr",
    ES: "es",
    IT: "it",
    PT: "pt",
    BR: "pt",
    RU: "ru",
    NL: "nl",
    PL: "pl",
    TR: "tr",
    AR: "ar",
    TH: "th",
    VN: "vi",
    ID: "id",
  };
  return countryLangMap[countryCode.toUpperCase()] || "en";
}

// Detect language from text
function detectLanguage(text: string): string {
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return "ja";
  if (/[\u4E00-\u9FFF]/.test(text) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "zh";
  // European languages detection
  if (/[äöüßÄÖÜ]/.test(text)) return "de";
  if (/[éèêëàâùûôîïç]/i.test(text)) return "fr";
  if (/[áéíóúüñ¿¡]/i.test(text)) return "es";
  if (/[ãõáéíóúâêôç]/i.test(text)) return "pt";
  return "en";
}

// =====================================================
// GET /api/community/comments/[id]/replies
// Fetch replies for a specific comment with translation
// =====================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: commentId } = await params;
    const supabase = createServiceClient();
    const { userId: clerkId } = await auth();

    // Get current user's database ID and language preference
    let currentUserDbId: string | null = null;
    let targetLanguage: string | null = null;
    let autoTranslate = false;

    if (clerkId) {
      const { data: dbUser } = await supabase
        .from("users")
        .select("id, country_code")
        .eq("clerk_id", clerkId)
        .single();

      currentUserDbId = dbUser?.id || null;
      targetLanguage = countryToLanguage(dbUser?.country_code);

      // Get auto_translate setting
      if (currentUserDbId) {
        const { data: settings } = await supabase
          .from("user_notification_settings")
          .select("auto_translate")
          .eq("user_id", currentUserDbId)
          .single();
        autoTranslate = settings?.auto_translate ?? true;
      }
    }

    // Verify the parent comment exists
    const { data: parentComment } = await supabase
      .from("comments")
      .select("id, post_id")
      .eq("id", commentId)
      .is("deleted_at", null)
      .single();

    if (!parentComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Fetch replies for this comment
    const { data: replies, error } = await supabase
      .from("comments")
      .select(
        `
        id,
        content,
        parent_comment_id,
        likes_count,
        created_at,
        author:users!author_id (
          id,
          username,
          display_name,
          avatar_url,
          current_level
        )
      `
      )
      .eq("parent_comment_id", commentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching replies:", error);
      return NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 });
    }

    if (!replies || replies.length === 0) {
      return NextResponse.json({ replies: [] });
    }

    // Get liked reply IDs for current user
    let likedReplyIds: string[] = [];
    if (currentUserDbId) {
      const replyIds = replies.map((r: { id: string }) => r.id);
      const { data: likes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", currentUserDbId)
        .in("comment_id", replyIds);
      likedReplyIds = likes?.map((l: { comment_id: string }) => l.comment_id) || [];
    }

    // Handle translations
    const translationsMap = new Map<string, string>();

    // Translate for all users when autoTranslate is enabled (removed "!== en" condition)
    if (autoTranslate && targetLanguage) {
      // Check cache first
      const replyIds = replies.map((r: { id: string }) => r.id);
      const { data: cachedTranslations } = await supabase
        .from("translations")
        .select("content_id, translated_text")
        .eq("content_type", "comment")
        .eq("target_language", targetLanguage)
        .in("content_id", replyIds);

      cachedTranslations?.forEach((t: { content_id: string; translated_text: string }) => {
        translationsMap.set(t.content_id, t.translated_text);
      });

      // Find replies that need translation
      type ReplyItem = { id: string; content: string };
      const uncachedReplies: ReplyItem[] = replies.filter((r: ReplyItem) => {
        const lang = detectLanguage(r.content);
        return lang !== targetLanguage && !translationsMap.has(r.id);
      });

      // Translate uncached replies
      if (uncachedReplies.length > 0) {
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (apiKey) {
          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
            const toLang = SUPPORTED_LANGUAGES[targetLanguage];

            const textList = uncachedReplies
              .map((r, idx) => `[${idx + 1}] ${r.content}`)
              .join("\n\n");

            const prompt = `Translate each numbered text below to ${toLang}.

RULES:
- Keep the tone, style, and formatting
- Do NOT translate:
  - Technical terms: API, SDK, CLI, Docker, React, TypeScript, Next.js, Supabase, Claude, Anthropic, GitHub, npm, git, etc.
  - Code snippets in backticks (\`code\`)
  - @mentions (e.g., @username)
  - URLs and file paths
  - Emojis
  - Abbreviations like LLM, AI, ML, RAG, etc.
- Keep proper nouns and brand names as-is
- Output ONLY the translations in the same numbered format
- Do not add explanations

Texts to translate:
${textList}`;

            const result = await model.generateContent({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 4000 },
            });

            const translatedText = result.response.text().trim();
            const translations = parseNumberedTranslations(translatedText, uncachedReplies.length);

            // Save to cache
            const translationRecords = uncachedReplies.map((r, idx) => ({
              content_id: r.id,
              content_type: "comment" as const,
              target_language: targetLanguage,
              translated_text: translations[idx] || r.content,
            }));

            if (translationRecords.length > 0) {
              await supabase.from("translations").upsert(translationRecords, {
                onConflict: "content_id,content_type,target_language",
              });
            }

            // Add to map
            uncachedReplies.forEach((r, idx) => {
              translationsMap.set(r.id, translations[idx] || r.content);
            });

            // Log AI usage
            const usageMetadata = result.response.usageMetadata;
            const inputTokens = usageMetadata?.promptTokenCount || 0;
            const outputTokens = usageMetadata?.candidatesTokenCount || 0;
            const costUsd =
              (inputTokens / 1_000_000) * TOKEN_COSTS.input +
              (outputTokens / 1_000_000) * TOKEN_COSTS.output;

            await supabase.from("ai_usage_log").insert({
              model: GEMINI_MODEL,
              operation: "reply_translation",
              request_type: "translation",
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              total_tokens: inputTokens + outputTokens,
              cost_usd: costUsd,
              metadata: { target_language: targetLanguage, replies_count: uncachedReplies.length },
            });
          } catch (err) {
            console.error("[Translation] Gemini API error:", err);
          }
        }
      }
    }

    // Transform response
    const transformedReplies: ReplyResponse[] = replies.map(
      (reply: {
        id: string;
        content: string;
        parent_comment_id: string;
        likes_count: number;
        created_at: string;
        author: CommentAuthor;
      }) => {
        const author = reply.author as CommentAuthor;
        const translatedText = translationsMap.get(reply.id);
        const isTranslated = !!translatedText && translatedText !== reply.content;
        const originalLanguage = detectLanguage(reply.content);

        return {
          id: reply.id,
          author: {
            id: author.id,
            username: author.username,
            display_name: author.display_name,
            avatar_url: author.avatar_url,
            current_level: author.current_level,
          },
          content: translatedText || reply.content,
          original_content: isTranslated ? reply.content : undefined,
          translated_content: isTranslated ? translatedText : undefined,
          original_language: originalLanguage, // Always include for language indicator
          is_translated: isTranslated,
          parent_comment_id: reply.parent_comment_id,
          created_at: reply.created_at,
          likes_count: reply.likes_count,
          is_liked: likedReplyIds.includes(reply.id),
        };
      }
    );

    return NextResponse.json({ replies: transformedReplies });
  } catch (error) {
    console.error("Error in GET /api/community/comments/[id]/replies:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Helper to parse numbered translations
function parseNumberedTranslations(text: string, expectedCount: number): string[] {
  // Initialize with empty strings - use explicit string type to avoid literal "" inference
  const results = new Array<string>(expectedCount).fill("" as string);

  // Match both [1] text and 1. text formats
  const pattern = /(?:\[(\d+)\]|(\d+)\.)\s*(.+?)(?=\[\d+\]|\d+\.|$)/gs;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // match[1] = [n] format index, match[2] = n. format index, match[3] = text
    const indexStr = match[1] || match[2];
    const matchedText = match[3];
    if (indexStr && matchedText) {
      const idx = parseInt(indexStr, 10) - 1;
      if (idx >= 0 && idx < expectedCount) {
        (results as string[])[idx] = matchedText.trim();
      }
    }
  }

  // Fallback: line-by-line parsing
  if (results.every((r) => r === "")) {
    const lines = text.split("\n").filter((l) => l.trim());
    for (let idx = 0; idx < lines.length && idx < expectedCount; idx++) {
      const line = lines[idx];
      if (line) {
        // Remove both [1] and 1. formats
        (results as string[])[idx] = line
          .replace(/^\[\d+\]\s*/, "") // [1] format
          .replace(/^\d+\.\s*/, "") // 1. format
          .trim();
      }
    }
  }

  return results;
}
