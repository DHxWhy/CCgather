import Link from "next/link";
import { ArrowLeft, History, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import VersionCard from "@/components/changelog/VersionCard";
import type { ChangelogVersionWithCounts } from "@/types/changelog";

// ===========================================
// SEO Metadata
// ===========================================

export const metadata = {
  title: "Changelog | CCgather - Claude Code Version History",
  description:
    "Complete history of Claude Code releases. Browse all versions, features, improvements, and bug fixes with easy-to-follow guides.",
  keywords: [
    "Claude Code changelog",
    "Claude Code versions",
    "Claude Code updates",
    "Claude Code release notes",
    "Claude Code history",
  ],
  openGraph: {
    title: "Changelog | CCgather",
    description: "Complete history of Claude Code releases",
    type: "website",
  },
};

// ===========================================
// Data Fetching
// ===========================================

async function getChangelogVersions() {
  try {
    const supabase = await createClient();

    // 버전 목록 조회 (with counts)
    const { data: versions, error } = await supabase
      .from("changelog_versions_with_counts")
      .select("*")
      .order("version", { ascending: false });

    if (error) {
      console.error("Failed to fetch changelog versions:", error);
      return [];
    }

    return (versions || []) as ChangelogVersionWithCounts[];
  } catch (error) {
    console.error("Changelog fetch error:", error);
    return [];
  }
}

// ===========================================
// Main Page Component
// ===========================================

export default async function ChangelogPage() {
  const versions = await getChangelogVersions();

  // Group by major version
  const groupedVersions: Record<string, ChangelogVersionWithCounts[]> = {};
  for (const v of versions) {
    const majorVersion = v.version.split(".")[0] || "0";
    if (!groupedVersions[majorVersion]) {
      groupedVersions[majorVersion] = [];
    }
    groupedVersions[majorVersion]!.push(v);
  }

  const majorVersions = Object.keys(groupedVersions).sort((a, b) => parseInt(b) - parseInt(a));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      {/* Back Link */}
      <Link
        href="/news"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-[var(--color-text-primary)] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to News
      </Link>

      {/* Header */}
      <header className="mb-10 md:mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-green-500/10">
            <History className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
              Changelog
            </h1>
            <p className="text-text-muted text-sm">Complete history of Claude Code releases</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-text-muted">
          <span className="flex items-center gap-1">
            <Tag className="w-4 h-4" />
            {versions.length} versions
          </span>
          <span>
            {versions.reduce((sum, v) => sum + (v.actual_changes || v.total_changes), 0)} total
            changes
          </span>
        </div>
      </header>

      {/* Empty State */}
      {versions.length === 0 && (
        <div className="text-center py-16 text-white/40 bg-white/[0.02] rounded-xl border border-white/10">
          <History className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg mb-2">No versions yet</p>
          <p className="text-sm">Changelog will be populated soon. Check back later!</p>
        </div>
      )}

      {/* Version List by Major Version */}
      {majorVersions.map((major) => (
        <section key={major} className="mb-10">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-mono">
              v{major}.x
            </span>
            <span className="text-text-muted text-sm font-normal">
              ({groupedVersions[major]!.length} releases)
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupedVersions[major]!.map((version, index) => (
              <VersionCard
                key={version.id}
                version={version}
                isLatest={major === majorVersions[0] && index === 0}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Official Link */}
      <div className="mt-12 text-center">
        <a
          href="https://docs.anthropic.com/claude-code/changelog"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-green-400 transition-colors"
        >
          📖 View Official Changelog
        </a>
      </div>
    </div>
  );
}
