"use client";

import Image from "next/image";
import { ExternalLink, Clock } from "lucide-react";
import type { ContentItem } from "@/types/automation";

interface OfficialNewsCardProps {
  article: ContentItem;
}

export default function OfficialNewsCard({ article }: OfficialNewsCardProps) {
  const date = new Date(article.published_at || article.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="block group">
      <article className="flex gap-5 p-5 rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent hover:border-orange-500/40 hover:from-orange-500/10 transition-all">
        {/* Thumbnail */}
        {article.thumbnail_url && (
          <div className="relative w-48 h-28 rounded-lg overflow-hidden flex-shrink-0 bg-black/20">
            <Image
              src={article.thumbnail_url}
              alt={article.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
            {/* Anthropic Badge */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-orange-500/90 text-white text-[10px] font-bold">
              OFFICIAL
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Source & Date */}
          <div className="flex items-center gap-3 mb-2 text-xs text-text-muted">
            <span className="flex items-center gap-1 text-orange-400">
              <ExternalLink className="w-3 h-3" />
              {article.source_name || "Anthropic"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {date}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-[var(--color-text-primary)] mb-2 group-hover:text-orange-400 transition-colors leading-snug line-clamp-2">
            {article.title}
          </h3>

          {/* Summary */}
          {article.summary_md && (
            <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">
              {article.summary_md}
            </p>
          )}

          {/* Key Points */}
          {article.key_points && article.key_points.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {article.key_points.slice(0, 3).map((point, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-1 bg-orange-500/10 text-orange-400/80 rounded"
                >
                  {point.length > 30 ? point.slice(0, 30) + "..." : point}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
    </a>
  );
}
