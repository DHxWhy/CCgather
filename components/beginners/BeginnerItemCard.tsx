"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import type { BeginnersDictionaryItem } from "@/types/changelog";
import { BEGINNER_CATEGORY_INFO } from "@/types/changelog";

interface BeginnerItemCardProps {
  item: BeginnersDictionaryItem;
  variant?: "default" | "featured" | "compact";
}

export default function BeginnerItemCard({ item, variant = "default" }: BeginnerItemCardProps) {
  const categoryInfo = BEGINNER_CATEGORY_INFO[item.category];

  if (variant === "featured") {
    return (
      <Link href={`/news/beginners/${item.slug}`} className="block group">
        <article className="p-5 rounded-xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent hover:border-blue-500/50 transition-all">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase">
              🔥 POPULAR
            </span>
            <span className="text-lg">{categoryInfo.emoji}</span>
          </div>

          {/* Name */}
          <h3 className="font-bold text-lg text-[var(--color-text-primary)] mb-2 group-hover:text-blue-400 transition-colors">
            {item.name}
          </h3>

          {/* Command Syntax */}
          {item.command_syntax && (
            <code className="block px-3 py-2 mb-3 text-sm font-mono bg-gray-500/20 text-orange-400 rounded-lg">
              {item.command_syntax}
            </code>
          )}

          {/* FOR BEGINNERS */}
          <div className="p-3 rounded-lg bg-white/5 border-l-2 border-blue-500/50">
            <div className="flex items-center gap-1 text-xs text-blue-400 font-medium mb-1">
              <BookOpen className="w-3 h-3" />
              FOR BEGINNERS
            </div>
            <p className="text-sm text-text-secondary leading-relaxed line-clamp-3">
              {item.for_beginners}
            </p>
          </div>

          {/* CTA */}
          <div className="mt-4 flex items-center gap-1 text-sm text-blue-400 font-medium">
            Learn more{" "}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </article>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link href={`/news/beginners/${item.slug}`} className="block group">
        <article className="p-3 rounded-lg border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">{categoryInfo.emoji}</span>
              <span className="font-mono text-sm text-[var(--color-text-primary)] group-hover:text-blue-400 transition-colors">
                {item.name}
              </span>
            </div>
            <ArrowRight className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </article>
      </Link>
    );
  }

  // Default variant
  return (
    <Link href={`/news/beginners/${item.slug}`} className="block group">
      <article className="p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="px-2 py-0.5 rounded bg-white/5 text-xs text-text-muted">
            {categoryInfo.emoji} {categoryInfo.label}
          </span>
          {item.is_featured && <span className="text-yellow-400 text-xs">🔥</span>}
        </div>

        {/* Name */}
        <h3 className="font-semibold text-[var(--color-text-primary)] mb-2 group-hover:text-blue-400 transition-colors">
          {item.name}
        </h3>

        {/* Command Syntax */}
        {item.command_syntax && (
          <code className="block px-2 py-1 mb-2 text-xs font-mono bg-gray-500/20 text-orange-400 rounded">
            {item.command_syntax}
          </code>
        )}

        {/* What it does */}
        {item.what_it_does && (
          <p className="text-xs text-text-secondary mb-2 line-clamp-1">{item.what_it_does}</p>
        )}

        {/* FOR BEGINNERS Preview */}
        <div className="p-2 rounded bg-blue-500/5 border-l-2 border-blue-500/30">
          <p className="text-xs text-text-secondary line-clamp-2">📘 {item.for_beginners}</p>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] text-text-muted">
            {item.popularity_score > 0 && `👀 ${item.popularity_score} views`}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            Learn <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </article>
    </Link>
  );
}
