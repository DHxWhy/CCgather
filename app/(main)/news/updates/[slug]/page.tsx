import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Calendar, Lightbulb } from "lucide-react";
import { getUpdateBySlug, getAllUpdateSlugs, UpdateContent } from "@/lib/data/news-content";

// ===========================================
// Static Params for SSG (SEO)
// ===========================================

export async function generateStaticParams() {
  const slugs = getAllUpdateSlugs();
  return slugs.map((slug) => ({ slug }));
}

// ===========================================
// Dynamic Metadata (SEO)
// ===========================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getUpdateBySlug(slug);

  if (!post) {
    return {
      title: "Update Not Found | CCgather",
    };
  }

  return {
    title: `${post.title} | Claude Code ${post.version} Update - CCgather`,
    description: post.summary,
    keywords: ["Claude Code", post.version, "update", "new feature", "tutorial", "how to"],
    openGraph: {
      title: `${post.title} - Claude Code ${post.version}`,
      description: post.summary,
      type: "article",
      publishedTime: post.publishedAt,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary,
    },
  };
}

// ===========================================
// JSON-LD Structured Data (SEO)
// ===========================================

function JsonLd({ post }: { post: NonNullable<ReturnType<typeof getUpdateBySlug>> }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: post.title,
    description: post.summary,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: {
      "@type": "Organization",
      name: "CCgather",
      url: "https://ccgather.dev",
    },
    publisher: {
      "@type": "Organization",
      name: "CCgather",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://ccgather.dev/news/updates/${post.slug}`,
    },
    about: {
      "@type": "SoftwareApplication",
      name: "Claude Code",
      applicationCategory: "DeveloperApplication",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// ===========================================
// Content Renderers
// ===========================================

function ContentBlock({ block }: { block: UpdateContent }) {
  switch (block.type) {
    case "heading":
      return (
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mt-8 mb-4 first:mt-0">
          {block.content}
        </h2>
      );

    case "paragraph":
      return <p className="text-text-secondary leading-relaxed mb-4 text-base">{block.content}</p>;

    case "feature":
      return (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 mb-4">
          <p className="text-[var(--color-text-primary)] leading-relaxed">{block.content}</p>
        </div>
      );

    case "code":
      return (
        <div className="mb-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-t-lg border border-white/10 border-b-0">
            <span className="text-xs text-text-muted font-mono uppercase">
              {block.language || "code"}
            </span>
          </div>
          <pre className="p-4 bg-black/40 rounded-b-lg border border-white/10 overflow-x-auto">
            <code className="text-sm font-mono text-green-400">{block.content}</code>
          </pre>
        </div>
      );

    case "tip":
      return (
        <div className="flex gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 mb-4">
          <Lightbulb className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-[var(--color-text-primary)] leading-relaxed">{block.content}</p>
        </div>
      );

    default:
      return null;
  }
}

// ===========================================
// Main Page Component
// ===========================================

export default async function UpdateDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getUpdateBySlug(slug);

  if (!post) {
    notFound();
  }

  const publishedDate = new Date(post.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <JsonLd post={post} />

      <article className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        {/* Back Link */}
        <Link
          href="/news"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary transition-colors mb-8 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to News
        </Link>

        {/* Header */}
        <header className="mb-8 pb-8 border-b border-white/10">
          {/* Version Badge */}
          <span className="inline-block px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm font-mono font-semibold mb-4">
            {post.version}
          </span>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-4 leading-tight">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {publishedDate}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              ~3 min read
            </span>
          </div>

          {/* Summary */}
          <p className="mt-4 text-lg text-text-secondary leading-relaxed">{post.summary}</p>
        </header>

        {/* Content */}
        <div className="prose-custom">
          {post.content.map((block, index) => (
            <ContentBlock key={index} block={block} />
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <p className="text-sm text-text-muted">Found this helpful? Check out more updates!</p>
            <Link
              href="/news"
              className="px-4 py-2.5 rounded-lg bg-white/5 text-text-secondary hover:bg-white/10 hover:text-[var(--color-text-primary)] transition-colors text-sm font-medium border border-white/10"
            >
              View All Updates
            </Link>
          </div>

          {/* CLI Promo */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5">
            <p className="text-sm text-text-muted">Track your Claude Code usage →</p>
            <code className="px-3 py-1.5 rounded bg-black/30 text-green-400 font-mono text-xs">
              npx ccgather
            </code>
          </div>
        </footer>
      </article>
    </>
  );
}
