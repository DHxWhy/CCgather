/**
 * News Constants
 * Centralized constants for news-related components
 */

// Category thumbnails (used when AI/manual thumbnail is unavailable)
export const CATEGORY_THUMBNAILS: Record<string, string> = {
  claude: "/thumbnails/claude-news.svg",
  "dev-tools": "/thumbnails/dev-tools-news.svg",
  industry: "/thumbnails/industry-news.svg",
  openai: "/thumbnails/openai-news.svg",
  cursor: "/thumbnails/cursor-news.svg",
  general: "/thumbnails/general-news.svg",
} as const;

// Category gradient colors (fallback for emoji display)
export const CATEGORY_GRADIENTS: Record<string, { from: string; to: string }> = {
  claude: { from: "#F97316", to: "#9333EA" },
  "dev-tools": { from: "#3B82F6", to: "#06B6D4" },
  industry: { from: "#10B981", to: "#059669" },
  openai: { from: "#22C55E", to: "#16A34A" },
  cursor: { from: "#8B5CF6", to: "#6366F1" },
  general: { from: "#6B7280", to: "#374151" },
} as const;

// Category emojis
export const CATEGORY_EMOJIS: Record<string, string> = {
  claude: "🤖",
  "dev-tools": "🛠️",
  industry: "📊",
  openai: "🧠",
  cursor: "✨",
  general: "📰",
} as const;

// Difficulty styling
export const DIFFICULTY_COLORS = {
  easy: "bg-green-500/20 text-green-600 dark:text-green-400",
  medium: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  hard: "bg-red-500/20 text-red-600 dark:text-red-400",
} as const;

export const DIFFICULTY_LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Advanced",
} as const;

export type Difficulty = keyof typeof DIFFICULTY_COLORS;

// Date format options
export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

// Tag mapping for news filtering
export const TAG_MAPPING: Record<string, string> = {
  claude: "claude",
  openai: "openai",
  cursor: "cursor",
  industry: "industry",
  "dev-tools": "dev-tools",
} as const;

// News list fields for SQL queries
export const NEWS_LIST_FIELDS = `
  id,
  title,
  slug,
  summary,
  content_type,
  category,
  difficulty,
  thumbnail_url,
  thumbnail_source,
  ai_thumbnail,
  title_emoji,
  source_url,
  source_name,
  published_at,
  created_at,
  status
`;
