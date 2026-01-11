import Link from "next/link";
import { Newspaper, RefreshCw, ArrowRight, ExternalLink, Clock } from "lucide-react";
import { NEWS_ARTICLES, UPDATE_POSTS } from "@/lib/data/news-content";

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
// News Card Component
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
        <span>{date}</span>
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
// Update Card Component
// ===========================================

function UpdateCard({ post }: { post: (typeof UPDATE_POSTS)[0] }) {
  const date = new Date(post.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Link href={`/news/updates/${post.slug}`}>
      <article className="group h-full p-5 rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent hover:border-green-500/40 hover:from-green-500/10 transition-all cursor-pointer">
        {/* Version Badge & Date */}
        <div className="flex items-center justify-between mb-3">
          <span className="px-2.5 py-1 rounded-md bg-green-500/20 text-green-400 text-xs font-mono font-medium">
            {post.version}
          </span>
          <span className="text-xs text-text-muted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {date}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-[var(--color-text-primary)] mb-2 group-hover:text-green-400 transition-colors leading-snug">
          {post.title}
        </h3>

        {/* Summary */}
        <p className="text-sm text-text-secondary mb-4 leading-relaxed">{post.summary}</p>

        {/* Read More */}
        <span className="inline-flex items-center gap-1.5 text-sm text-green-400 font-medium group-hover:gap-2.5 transition-all">
          Read more <ArrowRight className="w-4 h-4" />
        </span>
      </article>
    </Link>
  );
}

// ===========================================
// Main Page Component
// ===========================================

export default function NewsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      {/* Header */}
      <header className="mb-10 md:mb-12">
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          News & Updates
        </h1>
        <p className="text-text-muted text-sm md:text-base">
          Stay updated with Claude Code releases and community news
        </p>
      </header>

      {/* Updates Section */}
      <section className="mb-12 md:mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-green-500/10">
            <RefreshCw className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Updates</h2>
            <p className="text-xs text-text-muted">New features and how to use them</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {UPDATE_POSTS.map((post) => (
            <UpdateCard key={post.slug} post={post} />
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/news/updates"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary transition-colors font-medium"
          >
            View all updates <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* News Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-blue-500/10">
            <Newspaper className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">News</h2>
            <p className="text-xs text-text-muted">Claude Code in the headlines</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {NEWS_ARTICLES.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      </section>
    </div>
  );
}
