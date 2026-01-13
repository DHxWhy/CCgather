/**
 * AI Pipeline Types for Smart Hybrid Content Pipeline
 */

// ============================================
// Rich Content Structure
// ============================================

export interface RichContentTitle {
  text: string;
  emoji?: string; // Content type emoji: 📰news 🚀update 🔬research 💡tip
}

export interface RichContentAnalogy {
  text: string;
  icon: string;
}

export interface RichContentSummary {
  text: string;
  analogy?: RichContentAnalogy;
}

export interface RichContentKeyPoint {
  icon: string;
  text: string;
  highlight?: string; // Accent color
}

export interface RichContentSource {
  name: string;
  url: string;
  favicon?: string;
  publishedAt: string;
}

export interface RichContentMeta {
  difficulty: "easy" | "medium" | "hard";
  readTime?: string; // Optional - can be calculated from content length if needed
  category: string;
}

export interface RichContentStyle {
  accentColor: string;
  theme: "official" | "press" | "community" | "update";
}

export interface RichContent {
  title: RichContentTitle;
  summary: RichContentSummary;
  keyPoints: RichContentKeyPoint[];
  source: RichContentSource;
  meta: RichContentMeta;
  style: RichContentStyle;
}

// ============================================
// Fact Checker Types (Haiku)
// ============================================

export interface FactCheckInput {
  url: string;
  title: string;
  content: string;
  sourceName: string;
  publishedAt?: string;
}

export interface FactCheckResult {
  isValid: boolean;
  score: number; // 0-1
  reason: string;
  checks: {
    sourceReliable: boolean;
    contentRelevant: boolean;
    dateValid: boolean;
    notDuplicate: boolean;
  };
}

// ============================================
// Summarizer Types (Opus)
// ============================================

export interface SummarizerInput {
  url: string;
  title: string;
  content: string;
  sourceName: string;
  publishedAt: string;
  favicon?: string;
  category: string;
}

export interface SummarizerResult {
  richContent: RichContent;
  analogy: string;
  difficulty: "easy" | "medium" | "hard";
  keyPointsPlain: string[]; // For backwards compatibility
  summaryPlain: string; // Plain text summary
}

// ============================================
// Pipeline Types
// ============================================

export interface PipelineInput {
  url: string;
  category?: string;
}

export interface PipelineResult {
  success: boolean;
  article?: {
    url: string;
    title: string;
    content: string;
    sourceName: string;
    publishedAt: string;
    thumbnail?: string;
    favicon?: string;
  };
  factCheck?: FactCheckResult;
  summary?: SummarizerResult;
  error?: string;
  aiUsage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
}

// ============================================
// AI Model Configuration
// ============================================

export const AI_MODELS = {
  // Gemini 3 Flash - Primary model (NEWS_TAB_STRATEGY.md v3.2)
  GEMINI_FLASH: "gemini-3-flash-preview",
  // Legacy Claude models (for reference)
  HAIKU: "claude-3-5-haiku-20241022",
  OPUS: "claude-opus-4-5-20250514",
  SONNET: "claude-sonnet-4-20250514",
} as const;

export const TOKEN_COSTS = {
  // Gemini 3.0 Flash pricing (per 1M tokens) - PRIMARY
  [AI_MODELS.GEMINI_FLASH]: {
    input: 0.5, // $0.50 per 1M input
    output: 3.0, // $3.00 per 1M output
  },
  // Legacy Claude pricing (for reference)
  [AI_MODELS.HAIKU]: {
    input: 0.8, // $0.80 per 1M input
    output: 4.0, // $4.00 per 1M output
  },
  [AI_MODELS.OPUS]: {
    input: 15.0, // $15 per 1M input
    output: 75.0, // $75 per 1M output
  },
  [AI_MODELS.SONNET]: {
    input: 3.0, // $3 per 1M input
    output: 15.0, // $15 per 1M output
  },
} as const;

// Primary model for all AI operations
export const PRIMARY_AI_MODEL = AI_MODELS.GEMINI_FLASH;

export function calculateCost(
  model: keyof typeof TOKEN_COSTS,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = TOKEN_COSTS[model];
  return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;
}

// ============================================
// Category Colors
// ============================================

export const CATEGORY_COLORS = {
  official: "#F97316", // Orange
  update: "#22C55E", // Green
  version_update: "#22C55E", // Green (alias)
  press: "#3B82F6", // Blue
  community: "#8B5CF6", // Purple
  youtube: "#EF4444", // Red
} as const;

export const CATEGORY_THEMES: Record<string, RichContentStyle["theme"]> = {
  official: "official",
  version_update: "update",
  press: "press",
  community: "community",
  youtube: "community",
};
