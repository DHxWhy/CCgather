import Link from "next/link";
import {
  Newspaper,
  History,
  ArrowRight,
  ExternalLink,
  Clock,
  Building2,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { NEWS_ARTICLES } from "@/lib/data/news-content";
import { createClient } from "@/lib/supabase/server";
import OfficialNewsCard from "@/components/news/OfficialNewsCard";
import PressNewsCard from "@/components/news/PressNewsCard";
import type { ContentItem } from "@/types/automation";
import type {
  ChangelogVersionWithCounts,
  ChangelogItem,
  BeginnersDictionaryItem,
} from "@/types/changelog";

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

    // Fetch changelog versions (latest 3)
    const { data: versions } = await supabase
      .from("changelog_versions_with_counts")
      .select("*")
      .order("version", { ascending: false })
      .limit(3);

    // Fetch highlighted changelog items
    const { data: highlights } = await supabase
      .from("changelog_items")
      .select("*, changelog_versions!inner(version, version_slug)")
      .eq("is_highlight", true)
      .eq("verification_status", "approved")
      .order("created_at", { ascending: false })
      .limit(4);

    // Fetch featured beginners items
    const { data: beginners } = await supabase
      .from("beginners_dictionary")
      .select("*")
      .eq("verification_status", "approved")
      .eq("is_featured", true)
      .order("popularity_score", { ascending: false })
      .limit(4);

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
      versions: (versions || []) as ChangelogVersionWithCounts[],
      highlights: (highlights || []) as (ChangelogItem & {
        changelog_versions: { version: string; version_slug: string };
      })[],
      beginners: (beginners || []) as BeginnersDictionaryItem[],
      official: (officialNews || []) as ContentItem[],
      press: (pressNews || []) as ContentItem[],
    };
  } catch (error) {
    console.error("Failed to fetch news content:", error);
    return { versions: [], highlights: [], beginners: [], official: [], press: [] };
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
    <article className="group p-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-all">
      <div className="flex items-center justify-between mb-2 text-[10px] text-text-muted">
        {article.source && (
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-primary transition-colors"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            {article.source}
          </a>
        )}
        <span className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {date}
        </span>
      </div>
      <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1.5 group-hover:text-primary transition-colors leading-snug line-clamp-2">
        {article.title}
      </h3>
      <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2">
        {article.summary}
      </p>
    </article>
  );
}

// ===========================================
// Version Card Component
// ===========================================

function VersionCard({ version }: { version: ChangelogVersionWithCounts }) {
  const releaseTypeColor = {
    major: "bg-red-500/20 text-red-400",
    minor: "bg-blue-500/20 text-blue-400",
    patch: "bg-green-500/20 text-green-400",
  };

  return (
    <Link
      href={`/news/changelog/${version.version_slug}`}
      className="group p-4 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-green-500/30 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="px-2.5 py-0.5 rounded-md bg-green-500/20 text-green-400 font-mono text-xs font-semibold">
          v{version.version}
        </span>
        {version.release_type && (
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] ${releaseTypeColor[version.release_type] || releaseTypeColor.patch}`}
          >
            {version.release_type.toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-text-muted">
        <span>{version.actual_changes || version.total_changes} changes</span>
        {version.highlight_count > 0 && (
          <span className="text-yellow-400">⭐ {version.highlight_count}</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-text-muted group-hover:text-green-400 transition-colors">
        View details <ArrowRight className="w-3 h-3" />
      </div>
    </Link>
  );
}

// ===========================================
// Highlight Card Component
// ===========================================

function HighlightCard({
  item,
}: {
  item: ChangelogItem & { changelog_versions: { version: string; version_slug: string } };
}) {
  return (
    <Link
      href={`/news/guides/${item.slug}`}
      className="group p-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-yellow-500/30 transition-all"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles className="w-3 h-3 text-yellow-400" />
        <span className="text-[10px] text-text-muted font-mono">
          v{item.changelog_versions.version}
        </span>
      </div>
      <h3 className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-yellow-400 transition-colors line-clamp-2">
        {item.title}
      </h3>
      {item.overview && (
        <p className="text-[11px] text-text-muted mt-1.5 line-clamp-2">{item.overview}</p>
      )}
    </Link>
  );
}

// ===========================================
// Beginner Card Component
// ===========================================

function BeginnerCard({ item }: { item: BeginnersDictionaryItem }) {
  return (
    <Link
      href={`/news/beginners/${item.slug}`}
      className="group p-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/30 transition-all"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <BookOpen className="w-3 h-3 text-blue-400" />
        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
          {item.category}
        </span>
      </div>
      <h3 className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-blue-400 transition-colors">
        {item.name}
      </h3>
      {item.what_it_does && (
        <p className="text-[11px] text-text-muted mt-1.5 line-clamp-2">{item.what_it_does}</p>
      )}
    </Link>
  );
}

// ===========================================
// Main Page Component
// ===========================================

export default async function NewsPage() {
  const { versions, highlights, beginners, official, press } = await getNewsContent();
  const hasDbContent = official.length > 0 || press.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 xl:px-8 py-8 md:py-10 xl:py-12">
      {/* Header */}
      <header className="mb-8 md:mb-10 xl:mb-12">
        <h1 className="text-2xl md:text-3xl xl:text-4xl font-bold text-[var(--color-text-primary)] mb-2">
          News & Updates
        </h1>
        <p className="text-text-muted text-sm md:text-base">
          Stay updated with Claude Code releases and community news
        </p>
      </header>

      {/* Section 1: Changelog */}
      <section className="mb-10 xl:mb-12">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-500/10">
              <History className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Changelog</h2>
              <p className="text-[10px] text-text-muted">Latest releases</p>
            </div>
          </div>
          <Link
            href="/news/changelog"
            className="text-xs text-text-muted hover:text-green-400 transition-colors flex items-center gap-1"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {versions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {versions.map((version) => (
              <VersionCard key={version.id} version={version} />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-white/40 bg-white/[0.02] rounded-lg border border-white/10">
            <History className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Changelog coming soon</p>
          </div>
        )}

        {/* Highlights */}
        {highlights.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-yellow-400" /> Recent Highlights
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {highlights.map((item) => (
                <HighlightCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Section 2: FOR BEGINNERS */}
      <section className="mb-10 xl:mb-12">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <BookOpen className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                FOR BEGINNERS
              </h2>
              <p className="text-[10px] text-text-muted">Everyday examples</p>
            </div>
          </div>
          <Link
            href="/news/beginners"
            className="text-xs text-text-muted hover:text-blue-400 transition-colors flex items-center gap-1"
          >
            View dictionary <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {beginners.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {beginners.map((item) => (
              <BeginnerCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-white/40 bg-white/[0.02] rounded-lg border border-white/10">
            <BookOpen className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Beginner's guide coming soon</p>
          </div>
        )}
      </section>

      {/* Section 3: Anthropic Official */}
      <section className="mb-10 xl:mb-12">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <Building2 className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Anthropic Official
            </h2>
            <p className="text-[10px] text-text-muted">Official announcements</p>
          </div>
        </div>

        <div className="space-y-3">
          {official.length > 0 ? (
            official.map((article) => <OfficialNewsCard key={article.id} article={article} />)
          ) : (
            <div className="text-center py-6 text-white/40 bg-white/[0.02] rounded-lg border border-white/10">
              <Building2 className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No official announcements yet</p>
            </div>
          )}
        </div>
      </section>

      {/* Section 4: Press News */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Newspaper className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Press News</h2>
            <p className="text-[10px] text-text-muted">In the headlines</p>
          </div>
        </div>

        {hasDbContent && press.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {press.map((article) => (
              <PressNewsCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {NEWS_ARTICLES.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
