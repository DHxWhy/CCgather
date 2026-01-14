// =====================================================
// Tools Tab Type Definitions
// =====================================================

// =====================================================
// Constants
// =====================================================

export const TOOL_CATEGORIES = [
  "ai-coding",
  "devops",
  "productivity",
  "design",
  "api-data",
  "open-source",
  "learning",
  "social",
  "marketing",
] as const;

export const TOOL_STATUS = ["pending", "approved", "featured", "rejected"] as const;

export const TOOL_PRICING_TYPES = ["free", "freemium", "paid", "open_source"] as const;

export const TOOL_SOURCES = ["user", "admin", "automation"] as const;

export const TRUST_TIERS = ["elite", "power_user", "verified", "member"] as const;

export const TOOL_PERIODS = ["week", "month", "all"] as const;

export const TOOL_SORT_OPTIONS = ["votes", "weighted", "newest"] as const;

// =====================================================
// Category Metadata
// =====================================================

export const CATEGORY_META: Record<ToolCategory, { label: string; emoji: string; color: string }> =
  {
    "ai-coding": { label: "AI Coding", emoji: "🤖", color: "purple" },
    devops: { label: "DevOps", emoji: "🚀", color: "orange" },
    productivity: { label: "Productivity", emoji: "⚡", color: "yellow" },
    design: { label: "Design", emoji: "🎨", color: "pink" },
    "api-data": { label: "API & Data", emoji: "🔗", color: "cyan" },
    "open-source": { label: "Open Source", emoji: "💻", color: "green" },
    learning: { label: "Learning", emoji: "📚", color: "blue" },
    social: { label: "Social", emoji: "💬", color: "indigo" },
    marketing: { label: "Marketing", emoji: "📢", color: "red" },
  };

export const PRICING_META: Record<ToolPricingType, { label: string; color: string }> = {
  free: { label: "Free", color: "green" },
  freemium: { label: "Freemium", color: "blue" },
  paid: { label: "Paid", color: "purple" },
  open_source: { label: "Open Source", color: "cyan" },
};

export const TRUST_TIER_META: Record<
  TrustTier,
  { label: string; emoji: string; color: string; weight: number }
> = {
  elite: { label: "Elite", emoji: "🏆", color: "gold", weight: 3.0 },
  power_user: { label: "Power User", emoji: "⚡", color: "silver", weight: 2.0 },
  verified: { label: "Verified", emoji: "✅", color: "emerald", weight: 1.5 },
  member: { label: "Member", emoji: "👤", color: "gray", weight: 1.0 },
};

// =====================================================
// Type Definitions
// =====================================================

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];
export type ToolStatus = (typeof TOOL_STATUS)[number];
export type ToolPricingType = (typeof TOOL_PRICING_TYPES)[number];
export type ToolSource = (typeof TOOL_SOURCES)[number];
export type TrustTier = (typeof TRUST_TIERS)[number];
export type ToolPeriod = (typeof TOOL_PERIODS)[number];
export type ToolSortOption = (typeof TOOL_SORT_OPTIONS)[number];

// =====================================================
// Database Types
// =====================================================

export interface Tool {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string | null;
  website_url: string;
  logo_url: string | null;
  category: ToolCategory;
  tags: string[];
  pricing_type: ToolPricingType;
  status: ToolStatus;
  submitted_by: string | null;
  source: ToolSource;
  upvote_count: number;
  bookmark_count: number;
  weighted_score: number;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
}

export interface ToolVote {
  tool_id: string;
  user_id: string;
  weight: number;
  comment: string | null;
  created_at: string;
}

export interface ToolBookmark {
  tool_id: string;
  user_id: string;
  created_at: string;
}

export interface UserTrustLevel {
  id: string;
  username: string;
  avatar_url: string | null;
  current_level: number;
  global_rank: number | null;
  total_tokens: number;
  last_submission_at: string | null;
  trust_tier: TrustTier;
  vote_weight: number;
}

// =====================================================
// Extended Types (with relations)
// =====================================================

export interface ToolWithSubmitter extends Tool {
  submitter?: {
    id: string;
    username: string;
    avatar_url: string | null;
    trust_tier: TrustTier;
    current_level: number;
    global_rank: number | null;
  } | null;
}

export interface ToolWithVoters extends Tool {
  voters: Array<{
    user_id: string;
    username: string;
    avatar_url: string | null;
    trust_tier: TrustTier;
    weight: number;
    comment: string | null;
  }>;
  top_comment?: {
    username: string;
    avatar_url: string | null;
    trust_tier: TrustTier;
    comment: string;
  } | null;
  // Suggester info (who suggested this tool)
  suggester?: {
    id: string;
    username: string;
    avatar_url: string | null;
    trust_tier: TrustTier;
    current_level: number;
  } | null;
}

export interface ToolWithInteraction extends ToolWithVoters {
  is_voted: boolean;
  is_bookmarked: boolean;
}

// =====================================================
// API Request/Response Types
// =====================================================

export interface GetToolsParams {
  category?: ToolCategory | "all";
  period?: ToolPeriod;
  sort?: ToolSortOption;
  limit?: number;
  offset?: number;
  status?: ToolStatus; // admin only
}

export interface GetToolsResponse {
  tools: ToolWithVoters[];
  total: number;
  hasMore: boolean;
}

export interface SubmitToolRequest {
  name: string;
  website_url: string;
  tagline: string;
  description?: string;
  category: ToolCategory;
  pricing_type?: ToolPricingType;
  logo_url?: string;
  tags?: string[];
}

export interface SubmitToolResponse {
  success: boolean;
  tool?: Tool;
  error?: string;
}

export interface VoteToolRequest {
  tool_id: string;
  comment?: string;
}

export interface VoteToolResponse {
  success: boolean;
  voted: boolean;
  new_count: number;
  new_weighted_score: number;
}

export interface BookmarkToolRequest {
  tool_id: string;
}

export interface BookmarkToolResponse {
  success: boolean;
  bookmarked: boolean;
  new_count: number;
}

export interface AdminUpdateToolRequest {
  status?: ToolStatus;
  name?: string;
  tagline?: string;
  description?: string;
  category?: ToolCategory;
  pricing_type?: ToolPricingType;
  logo_url?: string;
  tags?: string[];
}

// =====================================================
// Admin Types
// =====================================================

export interface AdminToolStats {
  total: number;
  pending: number;
  approved: number;
  featured: number;
  rejected: number;
  by_category: Record<ToolCategory, number>;
  by_source: Record<ToolSource, number>;
}

export interface AdminToolListItem extends Tool {
  submitter?: {
    id: string;
    username: string;
    avatar_url: string | null;
    trust_tier: TrustTier;
    current_level: number;
    global_rank: number | null;
  } | null;
  priority: "high" | "medium" | "low"; // 신뢰도 기반 우선순위
}

// =====================================================
// Form Types
// =====================================================

export interface ToolSubmitFormData {
  name: string;
  website_url: string;
  tagline: string;
  description: string;
  category: ToolCategory;
  pricing_type: ToolPricingType;
  logo_url: string;
}

export interface ToolSubmitFormErrors {
  name?: string;
  website_url?: string;
  tagline?: string;
  category?: string;
}

// =====================================================
// Utility Types
// =====================================================

export type ToolCardVariant = "default" | "featured" | "compact";

export interface ToolFilterState {
  category: ToolCategory | "all";
  period: ToolPeriod;
  sort: ToolSortOption;
}

// =====================================================
// Helper Functions
// =====================================================

export function getCategoryMeta(category: ToolCategory) {
  return CATEGORY_META[category];
}

export function getPricingMeta(pricingType: ToolPricingType) {
  return PRICING_META[pricingType];
}

export function getTrustTierMeta(tier: TrustTier) {
  return TRUST_TIER_META[tier];
}

export function calculatePriority(
  submitter: { trust_tier: TrustTier } | null
): "high" | "medium" | "low" {
  if (!submitter) return "low";
  switch (submitter.trust_tier) {
    case "elite":
      return "high";
    case "power_user":
      return "high";
    case "verified":
      return "medium";
    default:
      return "low";
  }
}

export function isNewTool(createdAt: string, daysThreshold = 7): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= daysThreshold;
}

export function isHotTool(upvoteCount: number, createdAt: string, threshold = 10): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

  // 24시간 내 threshold 이상 투표 받으면 Hot
  if (diffHours <= 24 && upvoteCount >= threshold) {
    return true;
  }
  return false;
}
