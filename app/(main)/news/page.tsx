import Link from "next/link";
import { Newspaper, RefreshCw, ArrowRight, ExternalLink, Clock, Building2 } from "lucide-react";
import { NEWS_ARTICLES, UPDATE_POSTS } from "@/lib/data/news-content";
import { createClient } from "@/lib/supabase/server";
import VersionCarousel from "@/components/news/VersionCarousel";
import OfficialNewsCard from "@/components/news/OfficialNewsCard";
import PressNewsCard from "@/components/news/PressNewsCard";
import type { ContentItem } from "@/types/automation";

// ===========================================
// SEO Metadata
// ===========================================

export const metadata = {
  title: "News & Updates | CCgather - Claude Code News and Release Notes",
  description:
    "Stay updated with the latest Claude Code news, version updates, and feature releases. Learn new features with easy-to-follow guides and examples.",
  keywords: [
    "Claude Code",
    "Claude Code updates",
    "Claude Code news",
    "AI coding",
    "Anthropic",
    "Claude Code tutorial",
    "release notes",
  ],
  openGraph: {
    title: "News & Updates | CCgather",
    description: "Latest Claude Code news and version updates",
    type: "website",
  },
};

// ===========================================
// Data Fetching
// ===========================================

async function getNewsContent() {
  try {
    const supabase = await createClient();

    // Fetch official news
    const { data: officialNews } = await supabase
      .from("contents")
      .select("*")
      .eq("type", "news")
      .eq("status", "published")
      .eq("content_type", "official")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(5);

    // Fetch press news
    const { data: pressNews } = await supabase
      .from("contents")
      .select("*")
      .eq("type", "news")
      .eq("status", "published")
      .eq("content_type", "press")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(9);

    return {
      official: (officialNews || []) as ContentItem[],
      press: (pressNews || []) as ContentItem[],
    };
  } catch (error) {
    console.error("Failed to fetch news content:", error);
    return { official: [], press: [] };
  }
}

// ===========================================
// Fallback News Card (for static data)
// ===========================================

function NewsCard({ article }: { article: (typeof NEWS_ARTICLES)[0] }) {
  const date = new Date(article.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article className="group p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all">
      {/* Source & Date */}
      <div className="flex items-center justify-between mb-3 text-xs text-text-muted">
        {article.source && (
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-primary transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            {article.source}
          </a>
        )}
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {date}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-[var(--color-text-primary)] mb-2 group-hover:text-primary transition-colors leading-snug">
        {article.title}
      </h3>

      {/* Summary */}
      <p className="text-sm text-text-secondary leading-relaxed">{article.summary}</p>
    </article>
  );
}

// ===========================================
// Main Page Component
// ===========================================

export default async function NewsPage() {
  const { official, press } = await getNewsContent();

  // Use DB content if available, otherwise fallback to static
  const hasDbContent = official.length > 0 || press.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      {/* Header */}
      <header className="mb-10 md:mb-12">
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          News & Updates
        </h1>
        <p className="text-text-muted text-sm md:text-base">
          Stay updated with Claude Code releases and community news
        </p>
      </header>

      {/* Section 1: Version Updates (Carousel) */}
      <section className="mb-12 md:mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-green-500/10">
            <RefreshCw className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Version Updates
            </h2>
            <p className="text-xs text-text-muted">New features and how to use them</p>
          </div>
        </div>

        <VersionCarousel updates={UPDATE_POSTS} />

        <div className="mt-6 text-center">
          <Link
            href="/news/updates"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-green-400 transition-colors font-medium"
          >
            View all updates <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Section 2: Anthropic Official */}
      <section className="mb-12 md:mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-orange-500/10">
            <Building2 className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Anthropic Official
            </h2>
            <p className="text-xs text-text-muted">Official announcements from Anthropic</p>
          </div>
        </div>

        <div className="space-y-4">
          {official.length > 0 ? (
            official.map((article) => <OfficialNewsCard key={article.id} article={article} />)
          ) : (
            <div className="text-center py-8 text-white/40 bg-white/[0.02] rounded-xl border border-white/10">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No official announcements yet</p>
              <p className="text-xs mt-1">Check back soon for updates from Anthropic</p>
            </div>
          )}
        </div>
      </section>

      {/* Section 3: Press News */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-blue-500/10">
            <Newspaper className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Press News</h2>
            <p className="text-xs text-text-muted">Claude Code in the headlines</p>
          </div>
        </div>

        {hasDbContent && press.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {press.map((article) => (
              <PressNewsCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          // Fallback to static data
          <div className="grid grid-cols-1 gap-4">
            {NEWS_ARTICLES.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
