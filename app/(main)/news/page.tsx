import { ExternalLink, Sparkles } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import NewsTagFilter from "@/components/news/NewsTagFilter";
import NewsInfiniteGrid from "@/components/news/NewsInfiniteGrid";
import { NEWS_FILTER_TAGS, type NewsFilterTag } from "@/components/news/news-tags";
import type { ContentItem } from "@/types/automation";
import { Suspense } from "react";

// ===========================================
// ISR Configuration - Revalidate every 5 minutes
// ===========================================
export const revalidate = 300;

// Optimized field selection for news list (excludes heavy fields)
const NEWS_LIST_FIELDS = `
  id,
  title,
  slug,
  source_name,
  source_url,
  thumbnail_url,
  thumbnail_source,
  favicon_url,
  published_at,
  created_at,
  news_tags,
  category,
  one_liner,
  difficulty,
  content_type,
  rich_content
`;

// ===========================================
// SEO Metadata
// ===========================================

export const metadata = {
  title: "News | CCgather - AI & Developer News",
  description:
    "Stay informed while coding with Claude. Curated news from Claude Code updates to AI industry trends for developers.",
  keywords: [
    "Claude Code",
    "Claude Code news",
    "AI news",
    "Anthropic",
    "AI coding",
    "Developer tools",
    "OpenAI",
    "Google Gemini",
  ],
  openGraph: {
    title: "News | CCgather - AI & Developer News",
    description: "Stay informed while coding with Claude. Curated AI news for developers.",
    type: "website",
  },
};

// ===========================================
// Quick Links Data
// ===========================================

const QUICK_LINKS = [
  {
    title: "Claude Code Changelog",
    description: "Official release notes",
    url: "https://docs.anthropic.com/en/docs/claude-code/changelog",
    logo: "/logos/claude-symbol-clay.svg",
    color: "claude" as const,
  },
  {
    title: "Anthropic News",
    description: "Official announcements",
    url: "https://www.anthropic.com/news",
    logo: "/logos/anthropic-icon-ivory.svg",
    color: "anthropic" as const,
  },
  {
    title: "Claude Code Docs",
    description: "Documentation & guides",
    url: "https://docs.anthropic.com/en/docs/claude-code",
    logo: "/logos/claude-symbol-clay.svg",
    color: "claude" as const,
  },
];

// ===========================================
// Data Fetching
// ===========================================

// Initial load: 10 items for fast render, infinite scroll loads more
const INITIAL_LOAD_COUNT = 10;

async function getNewsByTag(tag: NewsFilterTag) {
  try {
    const supabase = await createClient();

    // Use optimized field selection instead of SELECT *
    // This reduces payload by ~70% (excludes transcript, body_html, insight_html, etc.)
    let query = supabase
      .from("contents")
      .select(NEWS_LIST_FIELDS, { count: "exact" })
      .eq("type", "news")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(INITIAL_LOAD_COUNT);

    // Apply tag filter
    if (tag !== "all") {
      // Map filter tag to actual news_tags
      const tagMapping: Record<string, string[]> = {
        claude: ["claude", "anthropic", "claude-code", "update"],
        "dev-tools": ["dev-tools"],
        industry: ["industry", "openai", "google", "meta"],
      };

      const targetTags = tagMapping[tag];
      if (targetTags) {
        query = query.overlaps("news_tags", targetTags);
      }
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("Failed to fetch news:", error);
      return { articles: [], total: 0 };
    }

    return {
      articles: (data || []) as ContentItem[],
      total: count || 0,
    };
  } catch (error) {
    console.error("News fetch error:", error);
    return { articles: [], total: 0 };
  }
}

// ===========================================
// Quick Link Card Component
// ===========================================

const COLOR_CLASSES = {
  claude:
    "bg-[#D97757]/20 dark:bg-[#D97757]/25 hover:border-[#D97757]/50 hover:bg-[#D97757]/30 dark:hover:bg-[#D97757]/35",
  anthropic:
    "bg-black/10 dark:bg-white/15 hover:border-black/20 dark:hover:border-white/30 hover:bg-black/15 dark:hover:bg-white/20",
} as const;

const LOGO_BG_CLASSES = {
  claude: "bg-[#D97757]/20 dark:bg-[#D97757]/25",
  anthropic: "bg-black/10 dark:bg-white/10",
} as const;

function QuickLinkCard({ link }: { link: (typeof QUICK_LINKS)[number] }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-center gap-3 p-3 rounded-xl border border-[var(--border-default)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] ${COLOR_CLASSES[link.color]}`}
      aria-label={`${link.title} - ${link.description} (opens in new tab)`}
    >
      <div className={`p-2 rounded-lg ${LOGO_BG_CLASSES[link.color]} transition-colors`}>
        <Image
          src={link.logo}
          alt=""
          width={18}
          height={18}
          className="w-[18px] h-[18px]"
          aria-hidden="true"
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[var(--color-text-primary)] text-xs group-hover:text-white transition-colors">
          {link.title}
        </h3>
        <p className="text-[10px] text-text-muted">{link.description}</p>
      </div>
      <ExternalLink
        className="w-3.5 h-3.5 text-text-muted group-hover:text-white/60 transition-colors flex-shrink-0"
        aria-hidden="true"
      />
    </a>
  );
}

// ===========================================
// Loading Skeleton
// ===========================================

function NewsGridSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-[112px] rounded-2xl bg-[var(--color-bg-secondary)] animate-pulse border border-[var(--border-default)]"
        />
      ))}
    </div>
  );
}

// ===========================================
// News Grid Component (SSR + Infinite Scroll)
// ===========================================

async function NewsGrid({ tag }: { tag: NewsFilterTag }) {
  const { articles, total } = await getNewsByTag(tag);

  // Pass initial SSR data to client component for infinite scroll
  return <NewsInfiniteGrid initialArticles={articles} initialTotal={total} tag={tag} />;
}

// ===========================================
// Main Page Component
// ===========================================

interface NewsPageProps {
  searchParams: Promise<{ tag?: string }>;
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const params = await searchParams;
  const currentTag = (params.tag as NewsFilterTag) || "all";

  // Validate tag
  const validTags = NEWS_FILTER_TAGS.map((t) => t.id);
  const safeTag = validTags.includes(currentTag) ? currentTag : "all";

  return (
    <div className="max-w-[1000px] mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          📰 AI & Dev News
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Stay informed while you code with Claude
        </p>
      </header>

      {/* Quick Links */}
      <section className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {QUICK_LINKS.map((link) => (
            <QuickLinkCard key={link.title} link={link} />
          ))}
        </div>
      </section>

      {/* Mobile: Sticky Filter Bar (< 640px) */}
      <div className="sm:hidden sticky top-0 z-20 -mx-4 px-4 py-3 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm border-b border-[var(--border-default)]">
        <NewsTagFilter currentTag={safeTag} variant="mobile" />
      </div>

      {/* Main Content: Filter Sidebar + News Grid */}
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-4 lg:gap-8 mt-4 sm:mt-0">
        {/* Filter Sidebar - Tablet/Desktop (>= 640px) */}
        <aside className="hidden sm:block sm:w-28 lg:w-44 flex-shrink-0">
          <div className="sm:sticky sm:top-24">
            <NewsTagFilter currentTag={safeTag} variant="desktop" />
          </div>
        </aside>

        {/* News Grid */}
        <main className="flex-1 min-w-0">
          <Suspense fallback={<NewsGridSkeleton />}>
            <NewsGrid tag={safeTag} />
          </Suspense>
        </main>
      </div>

      {/* Footer */}
      <section className="mt-10 pt-6 border-t border-[var(--border-default)]">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-medium text-text-muted">
            Always verify official information from original sources
          </span>
        </div>
        <p className="text-[11px] text-text-muted/60 leading-relaxed">
          CCgather curates Claude Code and AI-related news. All articles cite their original
          sources. For official documentation and announcements, please visit Anthropic&apos;s
          official channels.
        </p>
      </section>
    </div>
  );
}
