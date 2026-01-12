/**
 * Changelog & Beginners Dictionary Types
 * Based on docs/콘텐츠.md specifications
 */

// =====================================================
// Changelog Version Types
// =====================================================

export type ReleaseType = "major" | "minor" | "patch";
export type VerificationStatus = "pending" | "approved" | "rejected" | "needs_revision";
export type ItemCategory =
  | "feature"
  | "command"
  | "improvement"
  | "bugfix"
  | "breaking"
  | "deprecated";

export interface ChangelogVersion {
  id: string;
  version: string; // "2.1.0"
  version_slug: string; // "v2-1-0"
  total_changes: number;
  highlights: string[] | null; // item slugs, max 3
  official_url: string | null;
  release_type: ReleaseType | null;
  created_at: string;
  updated_at: string;
}

export interface ChangelogVersionWithCounts extends ChangelogVersion {
  actual_changes: number;
  highlight_count: number;
  approved_count: number;
}

// =====================================================
// Changelog Item Types
// =====================================================

export interface CodeExample {
  language: string;
  code: string;
  title?: string;
  description?: string;
}

export interface VerificationIssue {
  type: "UNVERIFIED_CLAIM" | "REGIONAL_SERVICE" | "COMMAND_ERROR" | "LANGUAGE_ERROR" | "OTHER";
  location: string;
  content: string;
  reason: string;
}

export interface ChangelogItem {
  id: string;
  version_id: string;
  slug: string; // "auto-skill-hot-reload"
  title: string;
  category: ItemCategory | null;

  // CCgather 독자 콘텐츠
  overview: string | null;
  how_to_use: string | null;
  use_cases: string[] | null;
  tips: string[] | null;
  for_beginners: string | null;
  related_slugs: string[] | null;

  // 명령어 관련
  commands: string[] | null;
  code_examples: CodeExample[] | null;

  // 검증 상태
  verification_status: VerificationStatus;
  verification_confidence: number | null;
  verification_issues: VerificationIssue[] | null;
  verification_suggestions: string[] | null;

  // AI 처리 정보
  ai_model_used: string | null;
  ai_tokens_used: number | null;
  ai_cost_usd: number | null;
  ai_processed_at: string | null;

  // 메타
  official_doc_url: string | null;
  is_highlight: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Item with version info (for display)
export interface ChangelogItemWithVersion extends ChangelogItem {
  version: ChangelogVersion;
}

// =====================================================
// Beginners Dictionary Types
// =====================================================

export type BeginnerCategory =
  | "getting_started" // 🚀 Getting Started
  | "session" // 💾 Session Control
  | "speed" // ⚡ Speed & Savings
  | "extend" // 🔌 Extend Claude
  | "agents" // 🤖 Agents & Skills
  | "config"; // ⚙️ Config & Setup

export const BEGINNER_CATEGORY_INFO: Record<
  BeginnerCategory,
  { label: string; emoji: string; description: string }
> = {
  getting_started: {
    label: "Getting Started",
    emoji: "🚀",
    description: "Basic commands and first steps",
  },
  session: { label: "Session Control", emoji: "💾", description: "Managing your conversations" },
  speed: {
    label: "Speed & Savings",
    emoji: "⚡",
    description: "Token optimization and efficiency",
  },
  extend: { label: "Extend Claude", emoji: "🔌", description: "Plugins and extensions" },
  agents: { label: "Agents & Skills", emoji: "🤖", description: "Automation and workflows" },
  config: { label: "Config & Setup", emoji: "⚙️", description: "Settings and configuration" },
};

export interface BeginnersDictionaryItem {
  id: string;
  slug: string; // "resume-flag"
  name: string; // "--resume"
  category: BeginnerCategory;

  // 콘텐츠
  command_syntax: string | null;
  what_it_does: string | null;
  for_beginners: string; // 핵심: 일상 비유

  // 연관
  related_slugs: string[] | null;
  related_changelog_slugs: string[] | null;
  official_doc_url: string | null;

  // 검증
  verification_status: VerificationStatus;
  verification_confidence: number | null;

  // 메타
  popularity_score: number;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Content Generation Types (AI Pipeline)
// =====================================================

export type PipelineStage = "collect" | "generate" | "verify";
export type PipelineModel = "haiku" | "sonnet" | "opus";
export type LogStatus = "success" | "failed" | "skipped";

export interface ContentGenerationLog {
  id: string;
  target_table: "changelog_items" | "beginners_dictionary";
  target_id: string;
  stage: PipelineStage;
  model_used: PipelineModel;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  status: LogStatus;
  error_message: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: number | null;
  duration_ms: number | null;
  created_at: string;
}

// =====================================================
// AI Pipeline Input/Output Types
// =====================================================

// Stage 1: Collect (Haiku)
export interface CollectInput {
  changelog_url: string;
  version: string;
}

export interface CollectOutput {
  version: string;
  items: Array<{
    type: ItemCategory;
    title: string;
    raw_text: string;
    commands?: string[];
    category?: string;
  }>;
}

// Stage 2: Generate (Sonnet)
export interface GenerateInput {
  item: CollectOutput["items"][number];
  version: string;
}

export interface GenerateOutput {
  slug: string;
  title: string;
  overview: string;
  how_to_use: string;
  use_cases: string[];
  tips: string[];
  for_beginners: string;
  related_slugs: string[];
  code_examples?: CodeExample[];
}

// Stage 3: Verify (Opus)
export interface VerifyInput {
  content: GenerateOutput;
  version: string;
}

export interface VerifyOutput {
  status: "APPROVED" | "REJECTED" | "NEEDS_REVISION";
  issues: VerificationIssue[];
  suggestions: string[];
  confidence: number;
}

// =====================================================
// API Response Types
// =====================================================

export interface ChangelogListResponse {
  versions: ChangelogVersionWithCounts[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ChangelogDetailResponse {
  version: ChangelogVersion;
  items: ChangelogItem[];
  highlights: ChangelogItem[];
}

export interface GuideDetailResponse {
  item: ChangelogItemWithVersion;
  relatedItems: ChangelogItem[];
}

export interface BeginnersListResponse {
  categories: Array<{
    category: BeginnerCategory;
    info: (typeof BEGINNER_CATEGORY_INFO)[BeginnerCategory];
    items: BeginnersDictionaryItem[];
    itemCount: number;
  }>;
  featured: BeginnersDictionaryItem[];
  totalItems: number;
}

export interface BeginnersSearchResponse {
  items: BeginnersDictionaryItem[];
  query: string;
  totalResults: number;
}

// =====================================================
// Admin API Types
// =====================================================

export interface GenerateContentRequest {
  changelog_url?: string;
  version?: string;
  force_regenerate?: boolean;
}

export interface GenerateContentResponse {
  success: boolean;
  version?: string;
  items_generated?: number;
  items_verified?: number;
  errors?: string[];
  logs?: ContentGenerationLog[];
}

export interface VerifyContentRequest {
  target_table: "changelog_items" | "beginners_dictionary";
  target_ids: string[];
}

export interface VerifyContentResponse {
  success: boolean;
  results: Array<{
    id: string;
    status: VerificationStatus;
    confidence: number;
    issues?: VerificationIssue[];
  }>;
}

export interface PublishContentRequest {
  target_table: "changelog_items" | "beginners_dictionary";
  target_ids: string[];
}

export interface PublishContentResponse {
  success: boolean;
  published_count: number;
  skipped_count: number;
  errors?: string[];
}
