"use client";

import Link from "next/link";
import { ArrowRight, Tag, CheckCircle2, Clock } from "lucide-react";
import type { ChangelogVersionWithCounts } from "@/types/changelog";

interface VersionCardProps {
  version: ChangelogVersionWithCounts;
  isLatest?: boolean;
}

export default function VersionCard({ version, isLatest }: VersionCardProps) {
  // Release type badge colors
  const releaseTypeColors = {
    major: "bg-red-500/20 text-red-400 border-red-500/30",
    minor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    patch: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  return (
    <Link href={`/news/changelog/${version.version_slug}`} className="block group">
      <article className="p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Version Badge */}
            <span className="px-3 py-1 rounded-md bg-green-500/20 text-green-400 text-sm font-mono font-medium">
              v{version.version}
            </span>

            {/* Release Type */}
            {version.release_type && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                  releaseTypeColors[version.release_type] || "bg-gray-500/20 text-gray-400"
                }`}
              >
                {version.release_type.toUpperCase()}
              </span>
            )}

            {/* Latest Badge */}
            {isLatest && (
              <span className="px-2 py-0.5 rounded-full bg-[var(--color-claude-coral)] text-white text-[10px] font-bold uppercase tracking-wider">
                LATEST
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-text-muted mb-3">
          <span className="flex items-center gap-1">
            <Tag className="w-3 h-3" />
            {version.actual_changes || version.total_changes} changes
          </span>
          {version.highlight_count > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              ⭐ {version.highlight_count} highlights
            </span>
          )}
          {version.approved_count > 0 && (
            <span className="flex items-center gap-1 text-green-400">
              <CheckCircle2 className="w-3 h-3" />
              {version.approved_count} documented
            </span>
          )}
        </div>

        {/* Highlights Preview */}
        {version.highlights && version.highlights.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {version.highlights.slice(0, 3).map((slug) => (
              <span key={slug} className="px-2 py-1 text-xs bg-white/5 text-text-secondary rounded">
                {slug.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(version.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
            })}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-green-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View details <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </article>
    </Link>
  );
}
