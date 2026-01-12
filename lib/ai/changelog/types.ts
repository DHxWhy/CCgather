/**
 * Changelog AI Pipeline Types
 *
 * Multi-model pipeline for changelog content generation:
 * - Haiku ($0.001): Collector - URL parsing, metadata extraction
 * - Sonnet ($0.015): Writer - Content creation, FOR BEGINNERS analogies
 * - Opus ($0.075): Verifier - Fact-checking, quality verification
 */

// ============================================
// Stage 1: Collector (Haiku) Types
// ============================================

export interface CollectorInput {
  sourceUrl: string;
  htmlContent?: string;
  versionHint?: string;
}

export interface ChangelogEntry {
  title: string;
  description: string;
  category: "feature" | "command" | "improvement" | "bugfix" | "breaking" | "deprecated" | "other";
  isHighlight: boolean;
  commands?: string[];
  relatedSlugs?: string[];
}

export interface CollectorOutput {
  version: string;
  releaseDate: string;
  releaseType: "major" | "minor" | "patch";
  entries: ChangelogEntry[];
  rawSummary: string;
}

// ============================================
// Stage 2: Writer (Sonnet) Types
// ============================================

export interface WriterInput {
  entry: ChangelogEntry;
  version: string;
  targetAudience: "beginner" | "intermediate" | "advanced";
}

export interface ForBeginnersContent {
  analogy: string;
  explanation: string;
  whenToUse: string;
}

export interface WriterOutput {
  slug: string;
  title: string;
  overview: string;
  howToUse: string;
  useCases: string[];
  tips: string[];
  forBeginners: ForBeginnersContent | null;
  commands: string[];
  difficulty: "easy" | "medium" | "hard";
  category: string;
  isHighlight: boolean;
  confidence?: number; // Self-assessed confidence (0-100) for 2-stage pipeline
}

// ============================================
// Stage 3: Verifier (Opus) Types
// ============================================

export interface VerifierInput {
  generatedContent: WriterOutput;
  originalEntry: ChangelogEntry;
  sourceUrl: string;
}

export interface VerificationCheck {
  passed: boolean;
  reason: string;
}

export interface VerifierOutput {
  confidence: number; // 0-100
  status: "auto" | "confirm" | "revision" | "manual";
  checks: {
    factualAccuracy: VerificationCheck;
    analogyQuality: VerificationCheck;
    completeness: VerificationCheck;
    clarity: VerificationCheck;
    technicalCorrectness: VerificationCheck;
  };
  suggestions: string[];
  finalContent: WriterOutput;
}

// ============================================
// Pipeline Types
// ============================================

export interface PipelineStageResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
}

export interface ChangelogPipelineResult {
  success: boolean;
  version?: {
    version: string;
    releaseDate: string;
    releaseType: "major" | "minor" | "patch";
  };
  items: Array<{
    entry: ChangelogEntry;
    content: WriterOutput;
    verification: VerifierOutput;
  }>;
  totalCost: number;
  stages: {
    collector: PipelineStageResult<CollectorOutput>;
    writer: PipelineStageResult<WriterOutput>[];
    verifier: PipelineStageResult<VerifierOutput>[];
  };
  error?: string;
}

// ============================================
// Confidence Thresholds
// ============================================

export const CONFIDENCE_THRESHOLDS = {
  AUTO: 95, // 95-100: Auto publish
  CONFIRM: 85, // 85-94: Admin review then publish
  REVISION: 50, // 50-84: Edit and re-verify
  MANUAL: 0, // 0-49: Admin writes directly
} as const;

export function getVerificationStatus(confidence: number): VerifierOutput["status"] {
  if (confidence >= CONFIDENCE_THRESHOLDS.AUTO) return "auto";
  if (confidence >= CONFIDENCE_THRESHOLDS.CONFIRM) return "confirm";
  if (confidence >= CONFIDENCE_THRESHOLDS.REVISION) return "revision";
  return "manual";
}

// ============================================
// FOR BEGINNERS Category Priority
// ============================================

export const FOR_BEGINNERS_PRIORITY = {
  // Required: Must have FOR BEGINNERS
  highlight: "required",
  feature: "recommended",
  command: "recommended",
  // Optional
  improvement: "optional",
  breaking: "optional",
  // Usually skip
  bugfix: "skip",
  deprecated: "skip",
  other: "skip",
} as const;

export function shouldHaveForBeginners(
  category: ChangelogEntry["category"],
  isHighlight: boolean
): "required" | "recommended" | "optional" | "skip" {
  if (isHighlight) return "required";
  return FOR_BEGINNERS_PRIORITY[category] || "skip";
}

// ============================================
// Approved Global Service Analogies
// ============================================

export const APPROVED_ANALOGIES = {
  // Services that can be used as analogies (global, not country-specific)
  services: [
    "Netflix",
    "Instagram",
    "YouTube",
    "Spotify",
    "Gmail",
    "Google Maps",
    "Amazon",
    "WhatsApp",
    "Uber",
    "Airbnb",
  ],
  // Template analogies for common features
  templates: {
    hotReload:
      "Like updating your Instagram profile - changes appear instantly without logging out",
    resume: "Like Netflix's 'Continue Watching' - pick up exactly where you left off",
    ignore:
      "Like telling movers on moving day 'skip this room' - some things don't need to be touched",
    background:
      "Like a food delivery app - you place the order and continue your day while it works",
    mcp: "Like a smartphone app store - one device, endless capabilities through add-ons",
    config: "Like your phone's Settings app - customize everything in one central place",
    hooks: "Like automatic email filters - set rules once, they run every time",
  },
} as const;
