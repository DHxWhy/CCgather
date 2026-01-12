import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Terminal, BookOpen, Lightbulb } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ChangelogItemCard from "@/components/changelog/ChangelogItemCard";
import type { ChangelogItem, ChangelogVersion } from "@/types/changelog";
import type { Metadata } from "next";

// ===========================================
// Types
// ===========================================

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ===========================================
// Metadata
// ===========================================

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("changelog_items")
    .select("title, overview")
    .eq("slug", slug)
    .single();

  if (!item) {
    return {
      title: "Guide Not Found | CCgather",
    };
  }

  return {
    title: `${item.title} | Claude Code Guide | CCgather`,
    description:
      item.overview ||
      `Learn how to use ${item.title} in Claude Code with easy-to-follow examples.`,
    keywords: [item.title, "Claude Code guide", "Claude Code tutorial", "how to use Claude Code"],
    openGraph: {
      title: `${item.title} | CCgather`,
      description: item.overview || `Learn how to use ${item.title} in Claude Code`,
      type: "article",
    },
  };
}

// ===========================================
// Data Fetching
// ===========================================

async function getGuideData(slug: string) {
  try {
    const supabase = await createClient();

    // 가이드 항목 조회
    const { data: item, error: itemError } = await supabase
      .from("changelog_items")
      .select("*")
      .eq("slug", slug)
      .eq("verification_status", "approved")
      .single();

    if (itemError || !item) {
      return null;
    }

    // 버전 정보 조회
    const { data: version } = await supabase
      .from("changelog_versions")
      .select("*")
      .eq("id", item.version_id)
      .single();

    // 연관 항목 조회
    let relatedItems: ChangelogItem[] = [];
    if (item.related_slugs && item.related_slugs.length > 0) {
      const { data: related } = await supabase
        .from("changelog_items")
        .select("*")
        .in("slug", item.related_slugs)
        .eq("verification_status", "approved")
        .limit(5);

      if (related) {
        relatedItems = related as ChangelogItem[];
      }
    }

    return {
      item: item as ChangelogItem,
      version: version as ChangelogVersion | null,
      relatedItems,
    };
  } catch (error) {
    console.error("Guide fetch error:", error);
    return null;
  }
}

// ===========================================
// Main Page Component
// ===========================================

export default async function GuideDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getGuideData(slug);

  if (!data) {
    notFound();
  }

  const { item, version, relatedItems } = data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      {/* Back Link */}
      <Link
        href={version ? `/news/changelog/${version.version_slug}` : "/news/changelog"}
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-[var(--color-text-primary)] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {version ? `Back to v${version.version}` : "Back to Changelog"}
      </Link>

      {/* Header */}
      <header className="mb-8">
        {/* Version Badge */}
        {version && (
          <span className="inline-block px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs font-mono mb-3">
            Introduced in v{version.version}
          </span>
        )}

        {/* Category */}
        {item.category && (
          <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs">
            {item.category}
          </span>
        )}

        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mt-2">
          {item.title}
        </h1>
      </header>

      {/* Overview */}
      {item.overview && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            📖 Overview
          </h2>
          <p className="text-text-secondary leading-relaxed">{item.overview}</p>
        </section>
      )}

      {/* How to Use */}
      {item.how_to_use && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            How to Use
          </h2>
          <div className="prose prose-invert max-w-none">
            {item.how_to_use.split("\n").map((line, i) => (
              <p key={i} className="text-text-secondary leading-relaxed mb-2">
                {line}
              </p>
            ))}
          </div>

          {/* Commands */}
          {item.commands && item.commands.length > 0 && (
            <div className="mt-4 space-y-2">
              {item.commands.map((cmd, i) => (
                <code
                  key={i}
                  className="block px-4 py-3 text-sm font-mono bg-gray-500/20 text-orange-400 rounded-lg"
                >
                  {cmd}
                </code>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Use Cases */}
      {item.use_cases && item.use_cases.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            ✨ Use Cases
          </h2>
          <ul className="space-y-2">
            {item.use_cases.map((useCase, i) => (
              <li key={i} className="flex items-start gap-2 text-text-secondary">
                <span className="text-green-400 mt-1">•</span>
                <span>{useCase}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tips */}
      {item.tips && item.tips.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            Tips
          </h2>
          <div className="space-y-3">
            {item.tips.map((tip, i) => (
              <div
                key={i}
                className="p-4 rounded-lg bg-yellow-500/10 border-l-2 border-yellow-500/50"
              >
                <p className="text-text-secondary text-sm">{tip}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FOR BEGINNERS */}
      {item.for_beginners && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            FOR BEGINNERS
          </h2>
          <div className="p-6 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-text-secondary leading-relaxed whitespace-pre-line">
              {item.for_beginners}
            </p>
          </div>
        </section>
      )}

      {/* Related Guides */}
      {relatedItems.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            🔗 Related
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatedItems.map((related) => (
              <ChangelogItemCard key={related.id} item={related} variant="compact" />
            ))}
          </div>
        </section>
      )}

      {/* Official Docs Link */}
      {item.official_doc_url && (
        <div className="mt-12 text-center">
          <a
            href={item.official_doc_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-green-400 transition-colors"
          >
            📖 View Official Documentation <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}
