import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, BookOpen, Terminal, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BeginnerItemCard from "@/components/beginners/BeginnerItemCard";
import type { BeginnersDictionaryItem } from "@/types/changelog";
import { BEGINNER_CATEGORY_INFO } from "@/types/changelog";
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
    .from("beginners_dictionary")
    .select("name, what_it_does, for_beginners")
    .eq("slug", slug)
    .single();

  if (!item) {
    return {
      title: "Not Found | CCgather",
    };
  }

  return {
    title: `${item.name} Explained | Claude Code for Beginners | CCgather`,
    description:
      item.for_beginners ||
      item.what_it_does ||
      `Learn how to use ${item.name} in Claude Code with simple everyday analogies.`,
    keywords: [item.name, "Claude Code beginner", "Claude Code explained", "vibe coding"],
    openGraph: {
      title: `${item.name} | Claude Code for Beginners | CCgather`,
      description: item.for_beginners || `Learn ${item.name} with everyday examples`,
      type: "article",
    },
  };
}

// ===========================================
// Data Fetching
// ===========================================

async function getBeginnerItemData(slug: string) {
  try {
    const supabase = await createClient();

    // 항목 조회
    const { data: item, error } = await supabase
      .from("beginners_dictionary")
      .select("*")
      .eq("slug", slug)
      .eq("verification_status", "approved")
      .single();

    if (error || !item) {
      return null;
    }

    // 인기도 증가 (비동기)
    supabase
      .from("beginners_dictionary")
      .update({ popularity_score: (item.popularity_score || 0) + 1 })
      .eq("id", item.id)
      .then(() => {});

    // 연관 항목 조회
    let relatedItems: BeginnersDictionaryItem[] = [];
    if (item.related_slugs && item.related_slugs.length > 0) {
      const { data: related } = await supabase
        .from("beginners_dictionary")
        .select("*")
        .in("slug", item.related_slugs)
        .eq("verification_status", "approved")
        .limit(4);

      if (related) {
        relatedItems = related as BeginnersDictionaryItem[];
      }
    }

    // 연관 changelog 조회
    let relatedChangelog: { slug: string; title: string }[] = [];
    if (item.related_changelog_slugs && item.related_changelog_slugs.length > 0) {
      const { data: changelog } = await supabase
        .from("changelog_items")
        .select("slug, title")
        .in("slug", item.related_changelog_slugs)
        .eq("verification_status", "approved")
        .limit(3);

      if (changelog) {
        relatedChangelog = changelog;
      }
    }

    return {
      item: item as BeginnersDictionaryItem,
      relatedItems,
      relatedChangelog,
    };
  } catch (error) {
    console.error("Beginner item fetch error:", error);
    return null;
  }
}

// ===========================================
// Main Page Component
// ===========================================

export default async function BeginnerItemDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getBeginnerItemData(slug);

  if (!data) {
    notFound();
  }

  const { item, relatedItems, relatedChangelog } = data;
  const categoryInfo = BEGINNER_CATEGORY_INFO[item.category];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      {/* Back Link */}
      <Link
        href="/news/beginners"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-[var(--color-text-primary)] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Beginners Guide
      </Link>

      {/* Header */}
      <header className="mb-8">
        {/* Category Badge */}
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 text-text-muted text-sm mb-3">
          {categoryInfo.emoji} {categoryInfo.label}
        </span>

        {/* Name */}
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
          {item.name}
        </h1>

        {/* What it does */}
        {item.what_it_does && <p className="text-text-secondary mt-2">{item.what_it_does}</p>}
      </header>

      {/* Command Syntax */}
      {item.command_syntax && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Command
          </h2>
          <code className="block px-4 py-3 text-lg font-mono bg-gray-500/20 text-orange-400 rounded-lg">
            {item.command_syntax}
          </code>
        </section>
      )}

      {/* FOR BEGINNERS - Main Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-400" />
          FOR BEGINNERS
        </h2>
        <div className="p-6 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <p className="text-lg text-text-secondary leading-relaxed whitespace-pre-line">
            {item.for_beginners}
          </p>
        </div>
      </section>

      {/* Related Beginner Items */}
      {relatedItems.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            🔗 Related Commands
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatedItems.map((related) => (
              <BeginnerItemCard key={related.id} item={related} variant="compact" />
            ))}
          </div>
        </section>
      )}

      {/* Related Changelog */}
      {relatedChangelog.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            📋 Related Updates
          </h2>
          <div className="space-y-2">
            {relatedChangelog.map((cl) => (
              <Link
                key={cl.slug}
                href={`/news/guides/${cl.slug}`}
                className="flex items-center justify-between p-3 rounded-lg border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all group"
              >
                <span className="text-sm text-[var(--color-text-primary)] group-hover:text-green-400 transition-colors">
                  {cl.title}
                </span>
                <ArrowRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Official Docs */}
      {item.official_doc_url && (
        <div className="mt-12 text-center">
          <a
            href={item.official_doc_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-blue-400 transition-colors"
          >
            📖 View Official Documentation <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}
