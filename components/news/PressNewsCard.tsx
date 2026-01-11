"use client";

import Image from "next/image";
import { ExternalLink, Clock } from "lucide-react";
import type { ContentItem } from "@/types/automation";

interface PressNewsCardProps {
  article: ContentItem;
}

export default function PressNewsCard({ article }: PressNewsCardProps) {
  const date = new Date(article.published_at || article.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="block group">
      <article className="h-full rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all overflow-hidden">
        {/* Thumbnail */}
        <div className="relative w-full aspect-video bg-black/20">
          {article.thumbnail_url ? (
            <Image
              src={article.thumbnail_url}
              alt={article.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500/10 to-purple-500/10">
              <span className="text-4xl opacity-30">📰</span>
            </div>
          )}
          {/* Source Badge */}
          {article.source_name && (
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-white text-[10px] font-medium">
              {article.source_name}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Date */}
          <div className="flex items-center gap-1 text-[10px] text-text-muted mb-2">
            <Clock className="w-3 h-3" />
            {date}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-[var(--color-text-primary)] mb-2 group-hover:text-blue-400 transition-colors leading-snug line-clamp-2 text-sm">
            {article.title}
          </h3>

          {/* Summary */}
          {article.summary_md && (
            <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
              {article.summary_md}
            </p>
          )}

          {/* Read More Link */}
          <div className="mt-3 flex items-center gap-1 text-xs text-blue-400 font-medium">
            <span>Read more</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        </div>
      </article>
    </a>
  );
}
