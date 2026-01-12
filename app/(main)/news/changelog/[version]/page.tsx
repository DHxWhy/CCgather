import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Tag, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import HighlightSection from "@/components/changelog/HighlightSection";
import ChangelogItemCard from "@/components/changelog/ChangelogItemCard";
import CollapsibleSection from "@/components/changelog/CollapsibleSection";
import type { ChangelogVersion, ChangelogItem } from "@/types/changelog";
import type { Metadata } from "next";

// ===========================================
// Types
// ===========================================

interface PageProps {
  params: Promise<{ version: string }>;
}

// ===========================================
// Metadata
// ===========================================

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { version } = await params;
  const versionNumber = version.replace(/^v/, "").replace(/-/g, ".");

  return {
    title: `v${versionNumber} | Claude Code Changelog | CCgather`,
    description: `What's new in Claude Code v${versionNumber}. Features, improvements, and how to use them with easy-to-follow guides.`,
    keywords: [
      `Claude Code v${versionNumber}`,
      "Claude Code update",
      "Claude Code changelog",
      "Claude Code features",
    ],
    openGraph: {
      title: `Claude Code v${versionNumber} | CCgather`,
      description: `What's new in Claude Code v${versionNumber}`,
      type: "article",
    },
  };
}

// ===========================================
// Data Fetching
// ===========================================

async function getVersionData(versionSlug: string) {
  try {
    const supabase = await createClient();

    // 버전 조회
    const { data: version, error: versionError } = await supabase
      .from("changelog_versions")
      .select("*")
      .eq("version_slug", versionSlug)
      .single();

    if (versionError || !version) {
      // version 번호로도 시도 (2.1.0 형식)
      const versionNumber = versionSlug.replace(/^v/, "").replace(/-/g, ".");
      const { data: versionByNumber, error: numberError } = await supabase
        .from("changelog_versions")
        .select("*")
        .eq("version", versionNumber)
        .single();

      if (numberError || !versionByNumber) {
        return null;
      }

      // items 조회
      const { data: items } = await supabase
        .from("changelog_items")
        .select("*")
        .eq("version_id", versionByNumber.id)
        .eq("verification_status", "approved")
        .order("display_order", { ascending: true });

      return {
        version: versionByNumber as ChangelogVersion,
        items: (items || []) as ChangelogItem[],
      };
    }

    // items 조회
    const { data: items } = await supabase
      .from("changelog_items")
      .select("*")
      .eq("version_id", version.id)
      .eq("verification_status", "approved")
      .order("display_order", { ascending: true });

    return {
      version: version as ChangelogVersion,
      items: (items || []) as ChangelogItem[],
    };
  } catch (error) {
    console.error("Version fetch error:", error);
    return null;
  }
}

// ===========================================
// Main Page Component
// ===========================================

export default async function VersionDetailPage({ params }: PageProps) {
  const { version: versionSlug } = await params;
  const data = await getVersionData(versionSlug);

  if (!data) {
    notFound();
  }

  const { version, items } = data;
  const highlights = items.filter((item) => item.is_highlight);
  const nonHighlights = items.filter((item) => !item.is_highlight);

  // Group items by category
  const groupedItems: Record<string, ChangelogItem[]> = {};
  for (const item of nonHighlights) {
    const category = item.category || "other";
    if (!groupedItems[category]) {
      groupedItems[category] = [];
    }
    groupedItems[category].push(item);
  }

  const categoryOrder = [
    "feature",
    "command",
    "improvement",
    "bugfix",
    "breaking",
    "deprecated",
    "other",
  ];
  const categoryLabels: Record<string, string> = {
    feature: "Features",
    command: "Commands",
    improvement: "Improvements",
    bugfix: "Bug Fixes",
    breaking: "Breaking Changes",
    deprecated: "Deprecated",
    other: "Other",
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      {/* Back Link */}
      <Link
        href="/news/changelog"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-[var(--color-text-primary)] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Changelog
      </Link>

      {/* Header */}
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 text-2xl font-mono font-bold">
            v{version.version}
          </span>
          {version.release_type && (
            <span
              className={`px-3 py-1 rounded text-sm font-medium ${
                version.release_type === "major"
                  ? "bg-red-500/20 text-red-400"
                  : version.release_type === "minor"
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-green-500/20 text-green-400"
              }`}
            >
              {version.release_type.toUpperCase()}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-text-muted">
          <span className="flex items-center gap-1">
            <Tag className="w-4 h-4" />
            {items.length} changes
          </span>
          {highlights.length > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              ⭐ {highlights.length} highlights
            </span>
          )}
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            {items.length} documented
          </span>
        </div>
      </header>

      {/* Highlights Section */}
      {highlights.length > 0 && <HighlightSection highlights={highlights} />}

      {/* All Changes by Category */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          📋 All Changes
        </h2>

        {categoryOrder.map((category) => {
          const categoryItems = groupedItems[category];
          if (!categoryItems || categoryItems.length === 0) return null;

          // Bug Fixes - Collapsible (default closed)
          if (category === "bugfix") {
            return (
              <CollapsibleSection
                key={category}
                title={`🐛 ${categoryLabels[category]}`}
                count={categoryItems.length}
                defaultOpen={false}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryItems.map((item) => (
                    <ChangelogItemCard key={item.id} item={item} />
                  ))}
                </div>
              </CollapsibleSection>
            );
          }

          // Other categories - Normal display
          return (
            <div key={category} className="mb-6">
              <h3 className="text-sm font-medium text-text-muted mb-3 uppercase tracking-wider">
                {categoryLabels[category]} ({categoryItems.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryItems.map((item) => (
                  <ChangelogItemCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="text-center py-12 text-white/40 bg-white/[0.02] rounded-xl border border-white/10">
            <p>No documented changes yet for this version.</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        )}
      </section>

      {/* Official Link */}
      {version.official_url && (
        <div className="mt-12 text-center">
          <a
            href={version.official_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-green-400 transition-colors"
          >
            📖 View Official Changelog <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}
