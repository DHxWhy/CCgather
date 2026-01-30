// Community feature mock data for E2E tests

// ============================================
// Types
// ============================================

export interface MockCommunitySettings {
  settings: {
    notify_rank_updates: boolean;
    notify_level_up: boolean;
    notify_badges: boolean;
    notify_submissions: boolean;
    notify_post_likes: boolean;
    notify_post_comments: boolean;
    notify_comment_replies: boolean;
    auto_translate: boolean;
  };
  preferred_language: string;
  supported_languages: string[];
}

export interface MockCommunityPost {
  id: string;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    current_level: number;
    country_code: string | null;
  };
  content: string;
  tab: "vibes" | "showcase" | "help" | "canu";
  original_language: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  liked_by: Array<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  }>;
  preview_comments: Array<{
    id: string;
    author: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      current_level: number;
    };
    content: string;
    original_language: string;
    likes_count: number;
    created_at: string;
    is_liked: boolean;
    replies_count: number;
  }>;
  has_more_comments: boolean;
}

export interface MockTranslationResult {
  id: string;
  type: "post" | "comment";
  translated_text: string;
  from_cache: boolean;
}

export interface MockHallOfFameEntry {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  count: number;
}

export interface MockCommunityCountryStat {
  code: string;
  name: string;
  posts: number;
  likes: number;
  contributors: number;
}

// ============================================
// Mock Data Generators
// ============================================

const SAMPLE_CONTENT: Record<string, string[]> = {
  en: [
    "Just got my CLI working! This is amazing!",
    "Sharing my latest project built with Claude Code",
    "How do I optimize token usage?",
    "Can anyone help me debug this error?",
  ],
  ko: [
    "Claude Code 정말 대박이네요!",
    "제가 만든 프로젝트 공유합니다",
    "토큰 사용량을 어떻게 최적화하나요?",
    "이 에러 좀 도와주실 수 있나요?",
  ],
  ja: [
    "Claude Code すごく便利です!",
    "新しいプロジェクトをシェアします",
    "トークン使用量を最適化するには?",
    "このエラーを助けてください",
  ],
  zh: [
    "Claude Code 太棒了！",
    "分享我的最新项目",
    "如何优化令牌使用？",
    "有人能帮我调试这个错误吗？",
  ],
  es: [
    "¡Claude Code es increíble!",
    "Compartiendo mi último proyecto",
    "¿Cómo optimizar el uso de tokens?",
    "¿Alguien puede ayudarme con este error?",
  ],
};

const LANGUAGES = ["en", "ko", "ja", "zh", "es"];
const TABS = ["vibes", "showcase", "help", "canu"] as const;
const COUNTRIES = ["US", "KR", "JP", "CN", "ES", "FR", "DE"];

export function createMockCommunitySettings(
  autoTranslate: boolean = true,
  preferredLanguage: string = "en"
): MockCommunitySettings {
  return {
    settings: {
      notify_rank_updates: true,
      notify_level_up: true,
      notify_badges: true,
      notify_submissions: true,
      notify_post_likes: true,
      notify_post_comments: true,
      notify_comment_replies: true,
      auto_translate: autoTranslate,
    },
    preferred_language: preferredLanguage,
    supported_languages: ["en", "ko", "ja", "zh", "es", "fr", "de", "pt"],
  };
}

export function createMockCommunityPosts(count: number = 20): MockCommunityPost[] {
  return Array.from({ length: count }, (_, i) => {
    const lang = LANGUAGES[i % LANGUAGES.length]!;
    const contentIndex = i % 4;
    const country = COUNTRIES[i % COUNTRIES.length]!;

    return {
      id: `post-${i + 1}`,
      author: {
        id: `user-${(i % 10) + 1}`,
        username: `developer${(i % 10) + 1}`,
        display_name: `Developer ${(i % 10) + 1}`,
        avatar_url: i % 3 === 0 ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}` : null,
        current_level: Math.floor(i / 5) + 1,
        country_code: country,
      },
      content: SAMPLE_CONTENT[lang]![contentIndex]!,
      tab: TABS[i % TABS.length]!,
      original_language: lang,
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
      likes_count: Math.floor(Math.random() * 50),
      comments_count: i % 3 === 0 ? Math.floor(Math.random() * 10) : 0,
      is_liked: i % 7 === 0,
      liked_by: [],
      preview_comments: [],
      has_more_comments: false,
    };
  });
}

export function createCommunityPostsResponse(
  posts: MockCommunityPost[],
  autoTranslateEnabled: boolean = true,
  preferredLanguage: string = "en",
  hasMore: boolean = false
) {
  return {
    posts,
    total: posts.length,
    hasMore,
    auto_translate_enabled: autoTranslateEnabled,
    preferred_language: preferredLanguage,
  };
}

export function createMockTranslationResponse(
  items: Array<{ id: string; type: "post" | "comment"; text: string }>,
  targetLanguage: string
): {
  translations: MockTranslationResult[];
  stats: { total: number; from_cache: number; translated: number };
} {
  const translations = items.map((item) => ({
    id: item.id,
    type: item.type,
    translated_text: `[Translated to ${targetLanguage}] ${item.text}`,
    from_cache: Math.random() > 0.5,
  }));

  const fromCacheCount = translations.filter((t) => t.from_cache).length;

  return {
    translations,
    stats: {
      total: items.length,
      from_cache: fromCacheCount,
      translated: items.length - fromCacheCount,
    },
  };
}

export function createMockHallOfFame(period: "today" | "weekly" | "monthly") {
  const multiplier = period === "today" ? 1 : period === "weekly" ? 7 : 30;

  return {
    most_liked: Array.from({ length: 3 }, (_, i) => ({
      id: `hof-liked-${i + 1}`,
      postId: `post-${i + 1}`,
      userId: `user-${i + 1}`,
      userName: `TopDev${i + 1}`,
      userAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
      count: (50 - i * 10) * multiplier,
    })),
    most_replied: Array.from({ length: 3 }, (_, i) => ({
      id: `hof-replied-${i + 1}`,
      postId: `post-${i + 4}`,
      userId: `user-${i + 4}`,
      userName: `ActiveDev${i + 1}`,
      userAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`,
      count: (30 - i * 7) * multiplier,
    })),
  };
}

export function createMockCountryStats(): MockCommunityCountryStat[] {
  const countries = [
    { code: "US", name: "United States", base: 100 },
    { code: "KR", name: "South Korea", base: 85 },
    { code: "JP", name: "Japan", base: 70 },
    { code: "CN", name: "China", base: 60 },
    { code: "DE", name: "Germany", base: 45 },
    { code: "FR", name: "France", base: 40 },
    { code: "ES", name: "Spain", base: 35 },
    { code: "BR", name: "Brazil", base: 30 },
  ];

  return countries.map((c) => ({
    code: c.code,
    name: c.name,
    posts: c.base + Math.floor(Math.random() * 20),
    likes: c.base * 2 + Math.floor(Math.random() * 50),
    contributors: Math.floor(c.base / 5) + Math.floor(Math.random() * 10),
  }));
}
