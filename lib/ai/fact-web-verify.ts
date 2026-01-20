/**
 * Web-Verified Fact Check
 *
 * Uses Gemini's Google Search Grounding to verify facts in rewritten articles
 * against real-time web sources. This catches hallucinations that the AI
 * self-verification cannot detect.
 *
 * Cost: ~$0.01-0.05 per article (depends on number of search queries)
 */

import { GoogleGenAI } from "@google/genai";

// ===========================================
// Types
// ===========================================

export interface WebVerifyResult {
  passed: boolean;
  score: number; // 0-100
  verifiedFacts: VerifiedFact[];
  unverifiedFacts: UnverifiedFact[];
  sources: SourceCitation[];
  searchQueries: string[];
  costUsd: number;
}

export interface VerifiedFact {
  claim: string;
  verified: boolean;
  source?: string;
  sourceUrl?: string;
  confidence: "high" | "medium" | "low";
}

export interface UnverifiedFact {
  claim: string;
  issue: string;
  suggestion?: string;
}

export interface SourceCitation {
  title: string;
  url: string;
  snippet?: string;
}

// ===========================================
// Web Verification Function
// ===========================================

/**
 * Verify key facts in a rewritten article using Google Search
 *
 * @param title - Article title
 * @param keyFacts - Key facts to verify (dates, numbers, names, claims)
 * @param sourceUrl - Original source URL (for reference)
 */
export async function verifyFactsWithWebSearch(
  title: string,
  keyFacts: string[],
  sourceUrl: string
): Promise<WebVerifyResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY is required");
  }

  const client = new GoogleGenAI({ apiKey });

  const prompt = `You are a fact-checker. Verify the following claims from a news article.

ARTICLE TITLE: ${title}
SOURCE URL: ${sourceUrl}

CLAIMS TO VERIFY:
${keyFacts.map((f, i) => `${i + 1}. ${f}`).join("\n")}

For each claim:
1. Search the web to verify it
2. Check if the dates, numbers, and facts are accurate
3. Note any discrepancies

IMPORTANT: Pay special attention to:
- Dates and years (e.g., "January 1, 2026" vs "January 1, 2025")
- Version numbers
- Company names and people
- Specific statistics or metrics

Respond in JSON format:
{
  "verifiedFacts": [
    {
      "claim": "original claim",
      "verified": true/false,
      "source": "source name",
      "sourceUrl": "URL",
      "confidence": "high/medium/low",
      "note": "optional note about verification"
    }
  ],
  "unverifiedFacts": [
    {
      "claim": "claim that could not be verified or is incorrect",
      "issue": "what's wrong or uncertain",
      "suggestion": "corrected version if applicable"
    }
  ],
  "overallAssessment": "brief summary of fact-check results"
}`;

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-preview-05-20",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    // Parse response
    const text = response.text || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[WebVerify] Failed to parse response:", text);
      throw new Error("Failed to parse verification response");
    }

    const result = JSON.parse(jsonMatch[0]);

    // Extract grounding metadata
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const searchQueries = groundingMetadata?.webSearchQueries || [];
    const groundingChunks = groundingMetadata?.groundingChunks || [];

    const sources: SourceCitation[] = groundingChunks.map(
      (chunk: { web?: { uri?: string; title?: string } }) => ({
        title: chunk.web?.title || "Unknown",
        url: chunk.web?.uri || "",
      })
    );

    // Calculate score
    const totalFacts = keyFacts.length;
    const verifiedCount = result.verifiedFacts?.filter((f: VerifiedFact) => f.verified).length || 0;
    const score = totalFacts > 0 ? Math.round((verifiedCount / totalFacts) * 100) : 100;

    // Estimate cost (rough: $0.01 per search query)
    const costUsd = searchQueries.length * 0.01;

    return {
      passed: score >= 80 && (result.unverifiedFacts?.length || 0) === 0,
      score,
      verifiedFacts: result.verifiedFacts || [],
      unverifiedFacts: result.unverifiedFacts || [],
      sources,
      searchQueries,
      costUsd,
    };
  } catch (error) {
    console.error("[WebVerify] Error:", error);
    throw error;
  }
}

/**
 * Extract key facts from rewritten article for verification
 */
export function extractKeyFactsForVerification(
  title: string,
  bodyHtml: string,
  extractedFacts?: {
    version?: string;
    releaseDate?: string;
    metrics?: string[];
  }
): string[] {
  const facts: string[] = [];

  // Add title as a fact
  facts.push(`Article title: "${title}"`);

  // Add version if present
  if (extractedFacts?.version) {
    facts.push(`Version mentioned: ${extractedFacts.version}`);
  }

  // Add release date if present
  if (extractedFacts?.releaseDate) {
    facts.push(`Release/effective date: ${extractedFacts.releaseDate}`);
  }

  // Add metrics
  if (extractedFacts?.metrics) {
    extractedFacts.metrics.slice(0, 3).forEach((m) => {
      facts.push(`Metric: ${m}`);
    });
  }

  // Extract dates from body
  const datePattern =
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|(?:first day of|beginning of|starting)\s+\d{4}/gi;
  const bodyText = bodyHtml.replace(/<[^>]+>/g, " ");
  const dates = bodyText.match(datePattern) || [];

  dates.slice(0, 3).forEach((date) => {
    facts.push(`Date mentioned: ${date}`);
  });

  // Extract percentages and numbers
  const numberPattern =
    /\d+(?:\.\d+)?%|\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion))?|\d+(?:,\d{3})+/g;
  const numbers = bodyText.match(numberPattern) || [];

  numbers.slice(0, 3).forEach((num) => {
    facts.push(`Number mentioned: ${num}`);
  });

  return facts;
}
