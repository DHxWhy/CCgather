import { Newspaper, ExternalLink, Sparkles, Zap, Building2 } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import NewsCard from "@/components/news/NewsCard";
import HorizontalScrollSection from "@/components/news/HorizontalScrollSection";
import type { ContentItem } from "@/types/automation";

// ===========================================
// SEO Metadata
// ===========================================

export const metadata = {
  title: "News | CCgather - Claude Code News and AI Updates",
  description:
    "Stay updated with the latest Claude Code news, AI industry updates, and Anthropic announcements. Get curated news from trusted sources.",
  keywords: [
    "Claude Code",
    "Claude Code news",
    "AI news",
    "Anthropic",
    "AI coding",
    "Claude Code updates",
  ],
  openGraph: {
    title: "News | CCgather",
    description: "Latest Claude Code and AI news curated for developers",
    type: "website",
  },
};

// ===========================================
// Quick Links Data (Official Anthropic/Claude Logos)
// ===========================================

const QUICK_LINKS = [
  {
    title: "Claude Code Changelog",
    description: "Official release notes",
    url: "https://docs.anthropic.com/en/docs/claude-code/changelog",
    logo: "/logos/claude-symbol-clay.svg",
    color: "claude",
  },
  {
    title: "Anthropic News",
    description: "Official announcements",
    url: "https://www.anthropic.com/news",
    logo: "/logos/anthropic-icon-ivory.svg",
    color: "anthropic",
  },
  {
    title: "Claude Code Docs",
    description: "Documentation & guides",
    url: "https://docs.anthropic.com/en/docs/claude-code",
    logo: "/logos/claude-symbol-clay.svg",
    color: "claude",
  },
];

// ===========================================
// Data Fetching
// ===========================================

async function getNewsContent() {
  try {
    const supabase = await createClient();

    // Fetch latest article for LATEST card
    const { data: latestArticle } = await supabase
      .from("contents")
      .select("*")
      .eq("type", "news")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    // Fetch Claude Code related news (official + claude code keyword)
    const { data: claudeCodeNews } = await supabase
      .from("contents")
      .select("*")
      .eq("type", "news")
      .eq("status", "published")
      .or("content_type.eq.official,content_type.eq.claude_code")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(10);

    // Fetch AI general news (press/general AI news)
    const { data: aiNews } = await supabase
      .from("contents")
      .select("*")
      .eq("type", "news")
      .eq("status", "published")
      .eq("content_type", "press")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(12);

    // Filter out the latest article from other lists to avoid duplication
    const latestId = latestArticle?.id;
    const filteredClaudeCode = (claudeCodeNews || []).filter(
      (a) => a.id !== latestId
    ) as ContentItem[];
    const filteredAiNews = (aiNews || []).filter((a) => a.id !== latestId) as ContentItem[];

    return {
      latestArticle: latestArticle as ContentItem | null,
      claudeCodeNews: filteredClaudeCode,
      aiNews: filteredAiNews,
    };
  } catch (error) {
    console.error("Failed to fetch news content:", error);
    return { latestArticle: null, claudeCodeNews: [], aiNews: [] };
  }
}

// ===========================================
// Quick Link Card Component (Official Logos)
// ===========================================

// Color schemes matching Anthropic brand (supports light/dark mode)
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

type QuickLinkColor = keyof typeof COLOR_CLASSES;

function QuickLinkCard({ link }: { link: (typeof QUICK_LINKS)[number] }) {
  const color = link.color as QuickLinkColor;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-center gap-3 p-3 rounded-xl border border-[var(--border-default)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] ${COLOR_CLASSES[color]}`}
      aria-label={`${link.title} - ${link.description} (opens in new tab)`}
    >
      <div className={`p-2 rounded-lg ${LOGO_BG_CLASSES[color]} transition-colors`}>
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
// Section Header Component
// ===========================================

function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  id,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  subtitle: string;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`p-2 rounded-lg ${iconColor}`}>
        <Icon className="w-4 h-4" aria-hidden="true" />
      </div>
      <div>
        <h2 id={id} className="text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
        </h2>
        <p className="text-[10px] text-text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

// ===========================================
// Empty State Component
// ===========================================

function EmptyState({
  icon: Icon,
  message,
  submessage,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
  submessage: string;
}) {
  return (
    <div
      className="text-center py-12 bg-black/[0.02] dark:bg-white/5 rounded-lg border border-[var(--border-default)]"
      role="status"
      aria-live="polite"
    >
      <Icon className="w-10 h-10 mx-auto mb-3 text-text-muted" aria-hidden="true" />
      <p className="text-sm text-[var(--color-text-primary)]">{message}</p>
      <p className="text-xs text-text-muted mt-1">{submessage}</p>
    </div>
  );
}

// ===========================================
// Main Page Component
// ===========================================

export default async function NewsPage() {
  const { latestArticle, claudeCodeNews, aiNews } = await getNewsContent();

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 xl:px-8 py-8 md:py-10 xl:py-12">
      {/* Header */}
      <header className="mb-8 md:mb-10">
        <h1 className="text-2xl md:text-3xl xl:text-4xl font-bold text-[var(--color-text-primary)] mb-2">
          News
        </h1>
        <p className="text-text-muted text-sm md:text-base">
          Stay updated with the latest Claude Code and AI industry news
        </p>
      </header>

      {/* Section 1: Quick Links (Compact) */}
      <section className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {QUICK_LINKS.map((link) => (
            <QuickLinkCard key={link.title} link={link} />
          ))}
        </div>
      </section>

      {/* Section 2: LATEST Article + Claude Code News */}
      <section className="mb-10" aria-labelledby="claude-code-news-heading">
        <SectionHeader
          icon={Zap}
          iconColor="bg-orange-500/10 text-orange-400"
          title="Claude Code News"
          subtitle="Official updates and related news"
          id="claude-code-news-heading"
        />

        {latestArticle || claudeCodeNews.length > 0 ? (
          <HorizontalScrollSection ariaLabel="Claude Code news list">
            {/* LATEST Card */}
            {latestArticle && <NewsCard article={latestArticle} variant="featured" isLatest />}
            {/* Claude Code News Cards */}
            {claudeCodeNews.map((article) => (
              <NewsCard key={article.id} article={article} variant="default" />
            ))}
          </HorizontalScrollSection>
        ) : (
          <EmptyState
            icon={Building2}
            message="No Claude Code news yet"
            submessage="Check back soon for the latest updates"
          />
        )}
      </section>

      {/* Section 3: AI News */}
      <section className="mb-10" aria-labelledby="ai-news-heading">
        <SectionHeader
          icon={Newspaper}
          iconColor="bg-purple-500/10 text-purple-400"
          title="AI Industry News"
          subtitle="Trends and highlights from the AI industry"
          id="ai-news-heading"
        />

        {aiNews.length > 0 ? (
          <HorizontalScrollSection ariaLabel="AI industry news list">
            {aiNews.map((article) => (
              <NewsCard key={article.id} article={article} variant="compact" />
            ))}
          </HorizontalScrollSection>
        ) : (
          <EmptyState
            icon={Newspaper}
            message="No AI news yet"
            submessage="Check back soon for the latest AI industry updates"
          />
        )}
      </section>

      {/* Official Resources Footer */}
      <section className="pt-6 border-t border-[var(--border-default)]">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-medium text-text-muted">
            Always verify official information from the original source
          </span>
        </div>
        <p className="text-[11px] text-text-muted/60 leading-relaxed">
          CCgather curates Claude Code related news. All news content cites original sources. For
          official documentation and announcements, please visit Anthropic&apos;s official channels.
        </p>
      </section>
    </div>
  );
}
