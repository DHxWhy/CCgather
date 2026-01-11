/**
 * News Automation Pipeline Types
 * Based on NEWS_AUTOMATION_PIPELINE.md
 */

// ============================================
// Automation Target Types
// ============================================

export type TargetType = "url" | "keyword" | "channel";
export type TargetCategory = "news" | "blog" | "official" | "community" | "youtube";

export interface AutomationTarget {
  id: string;
  type: TargetType;
  value: string;
  label?: string;
  category?: TargetCategory;
  priority: number;
  is_active: boolean;
  last_crawled_at?: string;
  crawl_count: number;
  success_count: number;
  fail_count: number;
  success_rate: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateTargetInput {
  type: TargetType;
  value: string;
  label?: string;
  category?: TargetCategory;
  priority?: number;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateTargetInput {
  label?: string;
  category?: TargetCategory;
  priority?: number;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

// ============================================
// Cron Job Types
// ============================================

export type CronStatus = "success" | "failed" | "running" | "cancelled";

export interface CronConfig {
  max_articles: number;
  delay_ms: number;
  parallel_workers?: number;
  timeout_ms?: number;
  retry_count?: number;
  categories?: TargetCategory[];
}

export interface CronJob {
  id: string;
  name: string;
  description?: string;
  schedule: string;
  timezone: string;
  is_enabled: boolean;
  is_running: boolean;
  last_run_at?: string;
  last_run_status?: CronStatus;
  last_run_duration_ms?: number;
  last_run_result?: CronRunResult;
  last_error?: string;
  run_count: number;
  success_count: number;
  fail_count: number;
  total_items_collected: number;
  config: CronConfig;
  created_at: string;
  updated_at: string;
}

export interface CronRunResult {
  items_found: number;
  items_valid: number;
  items_saved: number;
  items_skipped: number;
  sources_crawled: string[];
  errors?: string[];
}

export interface CronRunHistory {
  id: string;
  job_id: string;
  started_at: string;
  finished_at?: string;
  status: CronStatus;
  duration_ms?: number;
  items_found: number;
  items_valid: number;
  items_saved: number;
  items_skipped: number;
  error_message?: string;
  error_stack?: string;
  log: CronLogEntry[];
}

export interface CronLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
}

// ============================================
// Article Processing Types
// ============================================

export interface RawArticle {
  source_url: string;
  source_name: string;
  original_title: string;
  original_content?: string;
  published_at: string; // Original publication date - MUST preserve
  thumbnail_url?: string;
  author?: string;
  tags?: string[];
}

export interface ValidationResult {
  is_valid: boolean;
  reason: string;
  confidence: number; // 0-1
  checks: {
    source_trusted: boolean;
    url_accessible: boolean;
    date_valid: boolean;
    content_relevant: boolean;
    no_duplicates: boolean;
  };
}

export interface ValidatedArticle extends RawArticle {
  validation: ValidationResult;
  relevance_score: number; // 0-1
}

export interface ProcessedArticle extends ValidatedArticle {
  title: string; // Cleaned/improved title
  summary_md: string;
  key_points: string[];
  category: TargetCategory;
  language: string;
}

// ============================================
// Agent Types
// ============================================

export interface AgentConfig {
  model: string;
  max_tokens: number;
  temperature?: number;
  tools: ("WebSearch" | "WebFetch" | "Task")[];
}

export interface FactCheckerInput {
  article: RawArticle;
  trusted_sources: string[];
}

export interface FactCheckerOutput {
  valid: boolean;
  reason: string;
  confidence: number;
  source_reliability: "trusted" | "unknown" | "untrusted";
  content_accuracy: "verified" | "unverified" | "contradicted";
  date_freshness: "fresh" | "stale" | "invalid";
  relevance: "high" | "medium" | "low" | "none";
}

export interface SummarizerInput {
  article: ValidatedArticle;
}

export interface SummarizerOutput {
  title: string;
  summary: string;
  key_points: string[];
  source_name: string;
  source_url: string;
  category: string;
}

// ============================================
// Admin UI Types
// ============================================

export interface TargetManagerProps {
  targets: AutomationTarget[];
  onAdd: (input: CreateTargetInput) => Promise<void>;
  onUpdate: (id: string, input: UpdateTargetInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (ids: string[]) => Promise<void>;
}

export interface CronSchedulerProps {
  job: CronJob;
  history: CronRunHistory[];
  onToggle: (enabled: boolean) => Promise<void>;
  onUpdateSchedule: (schedule: string) => Promise<void>;
  onUpdateConfig: (config: Partial<CronConfig>) => Promise<void>;
  onManualRun: () => Promise<void>;
}

export interface PublishOrderItem {
  id: string;
  title: string;
  source_name: string;
  published_at: string; // Original date
  created_at: string; // Crawled date
  status: "pending" | "ready";
  order: number;
}

export interface PublishOrderProps {
  items: PublishOrderItem[];
  onReorder: (ids: string[]) => Promise<void>;
  onPublishAll: () => Promise<void>;
  onRejectAll: () => Promise<void>;
}

// ============================================
// Content Types (News Tab Redesign)
// ============================================

export type ContentType = "news" | "youtube";
export type ContentCategory = "version_update" | "official" | "press" | "community" | "youtube";
export type ContentStatus = "pending" | "ready" | "published" | "rejected";
export type ThumbnailSource = "gemini" | "og_image" | "manual" | "default";

export interface ContentItem {
  id: string;
  type: ContentType;
  content_type?: ContentCategory;
  title: string;
  source_url: string;
  source_name?: string;
  thumbnail_url?: string;
  thumbnail_source?: ThumbnailSource;
  thumbnail_generated_at?: string;
  summary_md?: string;
  key_points?: string[];
  category?: string;
  tags?: string[];
  status: ContentStatus;
  published_at?: string;
  created_at: string;
  updated_at?: string;
  // YouTube specific
  video_id?: string;
  channel_name?: string;
  channel_id?: string;
  duration?: string;
  view_count?: number;
}

export interface ThumbnailGenerationRequest {
  content_id: string;
  title: string;
  summary?: string;
  source_name?: string;
  force_regenerate?: boolean;
}

export interface ThumbnailGenerationResponse {
  success: boolean;
  thumbnail_url?: string;
  source: ThumbnailSource;
  error?: string;
}

// ============================================
// API Response Types
// ============================================

export interface TargetsResponse {
  targets: AutomationTarget[];
  total: number;
}

export interface CronJobResponse {
  job: CronJob;
  history?: CronRunHistory[];
}

export interface CrawlTriggerResponse {
  success: boolean;
  run_id: string;
  message: string;
}

export interface CrawlStatusResponse {
  is_running: boolean;
  current_run?: CronRunHistory;
  last_run?: CronRunHistory;
}
