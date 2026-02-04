import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { countryToLanguage, isEnglishCountry, SUPPORTED_LANGUAGES } from "@/lib/utils/translation";

// =====================================================
// Constants
// =====================================================

const GEMINI_MODEL = "gemini-2.0-flash-lite";

// In-memory cache for agreement translations
// Key: language code, Value: translated texts
const translationCache = new Map<string, AgreementTexts>();

// =====================================================
// Types
// =====================================================

export interface AgreementTexts {
  // Header
  joinTitle: string;
  // Community Participation Section
  communityParticipation: string;
  byJoiningYouAgree: string;
  displayGitHubProfile: string;
  receiveAnnouncements: string;
  receiveUpdates: string;
  agreeToParticipate: string;
  // Data Integrity Section
  dataIntegrity: string;
  manipulatingWarningTitle: string;
  manipulatingWarningContent: string;
  promiseNotToManipulate: string;
  typeAgreeToConfirm: string;
  // Footer
  termsAndPrivacy: string;
  joiningButton: string;
  joinCommunityButton: string;
  // Incomplete hints
  communityIncomplete: string;
}

interface TranslateRequest {
  countryCode: string;
}

// =====================================================
// Original English Texts
// =====================================================

const ORIGINAL_TEXTS: AgreementTexts = {
  joinTitle: "Join CCgather",
  communityParticipation: "Community Participation",
  byJoiningYouAgree: "By joining, you agree to:",
  displayGitHubProfile: "Display your GitHub profile on the public leaderboard",
  receiveAnnouncements: "Receive important service announcements",
  receiveUpdates: "Receive major feature updates & account notifications",
  agreeToParticipate: "I agree to participate in the community",
  dataIntegrity: "Data Integrity",
  manipulatingWarningTitle: "Manipulating usage data may result in:",
  manipulatingWarningContent: "Claude Code malfunction \u2022 Account suspension",
  promiseNotToManipulate: "I promise not to manipulate my usage data",
  typeAgreeToConfirm: 'Type "agree" to confirm',
  termsAndPrivacy: "By joining, you agree to our Terms and Privacy Policy",
  joiningButton: "Joining...",
  joinCommunityButton: "Join the Community",
  communityIncomplete: "Community",
};

// =====================================================
// POST /api/translate/agreement
// Translate agreement modal texts based on country
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const body: TranslateRequest = await request.json();
    const { countryCode } = body;

    // Validate country code
    if (!countryCode || typeof countryCode !== "string") {
      return NextResponse.json({ error: "Country code is required" }, { status: 400 });
    }

    // Check if English country - no translation needed
    if (isEnglishCountry(countryCode)) {
      return NextResponse.json({
        translations: null,
        targetLanguage: "en",
        isOriginal: true,
      });
    }

    const targetLanguage = countryToLanguage(countryCode);

    // Check if language is supported
    if (!SUPPORTED_LANGUAGES[targetLanguage]) {
      return NextResponse.json({
        translations: null,
        targetLanguage: "en",
        isOriginal: true,
      });
    }

    // Check in-memory cache
    const cached = translationCache.get(targetLanguage);
    if (cached) {
      return NextResponse.json({
        translations: cached,
        targetLanguage,
        isOriginal: false,
        fromCache: true,
      });
    }

    // Initialize Gemini
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[Agreement Translation] GOOGLE_GEMINI_API_KEY not set");
      return NextResponse.json({
        translations: null,
        targetLanguage: "en",
        isOriginal: true,
        error: "Translation service unavailable",
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const toLang = SUPPORTED_LANGUAGES[targetLanguage];

    // Build translation prompt
    const textsToTranslate = Object.entries(ORIGINAL_TEXTS)
      .map(([key, value], idx) => `[${idx + 1}] ${key}: ${value}`)
      .join("\n");

    const prompt = `Translate the following UI texts from English to ${toLang}.
Keep the tone professional and friendly. Maintain formatting and special characters.
IMPORTANT: Keep "agree" in English (do not translate "agree").
IMPORTANT: Keep "CCgather" as is.
Output ONLY the translations in the same numbered format.
Each translation should be on its own line starting with [number] key: translated_text.

Texts to translate:
${textsToTranslate}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
      },
    });

    const response = result.response;
    const translatedText = response.text().trim();

    // Parse translations
    const translations = parseTranslations(translatedText, ORIGINAL_TEXTS);

    // Cache the result
    translationCache.set(targetLanguage, translations);

    return NextResponse.json({
      translations,
      targetLanguage,
      isOriginal: false,
      fromCache: false,
    });
  } catch (error) {
    console.error("[Agreement Translation] Error:", error);
    // Return null translations on error - frontend will use original
    return NextResponse.json({
      translations: null,
      targetLanguage: "en",
      isOriginal: true,
      error: error instanceof Error ? error.message : "Translation failed",
    });
  }
}

// =====================================================
// Helper: Parse translation response
// =====================================================

function parseTranslations(text: string, originalTexts: AgreementTexts): AgreementTexts {
  const result: AgreementTexts = { ...originalTexts };
  const keys = Object.keys(originalTexts) as (keyof AgreementTexts)[];

  // Parse each line
  const lines = text.split("\n");
  for (const line of lines) {
    // Match format: [n] key: value or [n] value
    const matchWithKey = line.match(/^\[(\d+)\]\s*(\w+):\s*(.+)$/);
    const matchWithoutKey = line.match(/^\[(\d+)\]\s*(.+)$/);

    if (matchWithKey) {
      const [, , key, value] = matchWithKey;
      if (key && value && key in result) {
        result[key as keyof AgreementTexts] = value.trim();
      }
    } else if (matchWithoutKey) {
      const indexStr = matchWithoutKey[1];
      const value = matchWithoutKey[2];
      if (indexStr && value) {
        const index = parseInt(indexStr, 10) - 1;
        const key = keys[index];
        if (index >= 0 && index < keys.length && key) {
          result[key] = value.trim();
        }
      }
    }
  }

  return result;
}

// =====================================================
// GET /api/translate/agreement
// Get original texts (for reference)
// =====================================================

export async function GET() {
  return NextResponse.json({
    originalTexts: ORIGINAL_TEXTS,
    supportedLanguages: SUPPORTED_LANGUAGES,
  });
}
