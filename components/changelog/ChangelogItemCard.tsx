"use client";

import Link from "next/link";
import { ArrowRight, Terminal, BookOpen, Lightbulb } from "lucide-react";
import type { ChangelogItem } from "@/types/changelog";

interface ChangelogItemCardProps {
  item: ChangelogItem;
  isHighlight?: boolean;
  variant?: "default" | "hero" | "compact";
}

export default function ChangelogItemCard({
  item,
  isHighlight,
  variant = "default",
}: ChangelogItemCardProps) {
  // Category badge colors
  const categoryColors: Record<string, string> = {
    feature: "bg-blue-500/20 text-blue-400",
    command: "bg-purple-500/20 text-purple-400",
    improvement: "bg-green-500/20 text-green-400",
    bugfix: "bg-orange-500/20 text-orange-400",
    breaking: "bg-red-500/20 text-red-400",
    deprecated: "bg-gray-500/20 text-gray-400",
  };

  // Category icons
  const categoryIcons: Record<string, React.ReactNode> = {
    feature: <Lightbulb className="w-3 h-3" />,
    command: <Terminal className="w-3 h-3" />,
    improvement: <ArrowRight className="w-3 h-3" />,
    bugfix: <span className="text-xs">🐛</span>,
    breaking: <span className="text-xs">⚠️</span>,
    deprecated: <span className="text-xs">📦</span>,
  };

  if (variant === "hero") {
    return (
      <Link href={`/news/guides/${item.slug}`} className="block group">
        <article className="p-6 rounded-xl border-2 border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent hover:border-green-500/50 transition-all">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              {isHighlight && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase mb-2">
                  ⭐ HIGHLIGHT
                </span>
              )}
              {item.category && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                    categoryColors[item.category] || "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {categoryIcons[item.category]}
                  {item.category}
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-3 group-hover:text-green-400 transition-colors">
            {item.title}
          </h3>

          {/* Overview */}
          {item.overview && (
            <p className="text-sm text-text-secondary leading-relaxed mb-4 line-clamp-2">
              {item.overview}
            </p>
          )}

          {/* Commands */}
          {item.commands && item.commands.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {item.commands.slice(0, 3).map((cmd, i) => (
                <code
                  key={i}
                  className="px-2 py-1 text-xs font-mono bg-gray-500/20 text-orange-400 rounded"
                >
                  {cmd}
                </code>
              ))}
            </div>
          )}

          {/* FOR BEGINNERS Preview */}
          {item.for_beginners && (
            <div className="p-3 rounded-lg bg-blue-500/10 border-l-2 border-blue-500/50 mb-4">
              <div className="flex items-center gap-1 text-xs text-blue-400 font-medium mb-1">
                <BookOpen className="w-3 h-3" />
                FOR BEGINNERS
              </div>
              <p className="text-xs text-text-secondary line-clamp-2">{item.for_beginners}</p>
            </div>
          )}

          {/* CTA */}
          <div className="flex items-center gap-1 text-sm text-green-400 font-medium">
            Read Full Guide{" "}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </article>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link href={`/news/guides/${item.slug}`} className="block group">
        <article className="p-3 rounded-lg border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all">
          <div className="flex items-center gap-2">
            {item.category && (
              <span
                className={`flex-shrink-0 w-2 h-2 rounded-full ${
                  categoryColors[item.category]?.replace("text-", "bg-") || "bg-gray-500"
                }`}
              />
            )}
            <span className="text-sm text-[var(--color-text-primary)] group-hover:text-green-400 transition-colors line-clamp-1">
              {item.title}
            </span>
          </div>
        </article>
      </Link>
    );
  }

  // Default variant
  return (
    <Link href={`/news/guides/${item.slug}`} className="block group">
      <article className="p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          {isHighlight && <span className="text-yellow-400 text-xs">⭐</span>}
          {item.category && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                categoryColors[item.category] || "bg-gray-500/20 text-gray-400"
              }`}
            >
              {categoryIcons[item.category]}
              {item.category}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-[var(--color-text-primary)] mb-2 group-hover:text-green-400 transition-colors line-clamp-2 text-sm">
          {item.title}
        </h3>

        {/* Overview */}
        {item.overview && (
          <p className="text-xs text-text-secondary leading-relaxed mb-3 line-clamp-2">
            {item.overview}
          </p>
        )}

        {/* Commands Preview */}
        {item.commands && item.commands.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {item.commands.slice(0, 2).map((cmd, i) => (
              <code
                key={i}
                className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-500/20 text-orange-400 rounded"
              >
                {cmd}
              </code>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1 text-xs text-green-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Learn more <ArrowRight className="w-3 h-3" />
        </div>
      </article>
    </Link>
  );
}
