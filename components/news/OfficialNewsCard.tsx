"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink, Clock, Sparkles } from "lucide-react";
import type { ContentItem } from "@/types/automation";

interface OfficialNewsCardProps {
  article: ContentItem;
}

export default function OfficialNewsCard({ article }: OfficialNewsCardProps) {
  const [imageError, setImageError] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  const richContent = article.rich_content;
  const hasRichContent = !!richContent;

  // Use rich content data if available, fallback to legacy fields
  const title = hasRichContent ? richContent.title.text : article.title;
  const titleEmoji = hasRichContent ? richContent.title.emoji : undefined;
  const summary = hasRichContent ? richContent.summary.text : article.summary || article.summary_md;
  const analogy = hasRichContent ? richContent.summary.analogy : undefined;
  const keyPoints = hasRichContent
    ? richContent.keyPoints
    : article.key_points?.map((text) => ({
        icon: "✅",
        text,
        highlight: undefined as string | undefined,
      }));
  const difficulty = hasRichContent ? richContent.meta.difficulty : article.difficulty;
  const readTime = hasRichContent ? richContent.meta.readTime : undefined;
  const favicon = article.favicon_url || richContent?.source.favicon;

  const date = new Date(article.published_at || article.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Difficulty badge colors
  const difficultyColors = {
    easy: "bg-green-500/20 text-green-400 border-green-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    hard: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="block group">
      <article className="flex gap-4 p-4 rounded-lg border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent hover:border-orange-500/40 hover:from-orange-500/10 transition-all">
        {/* Thumbnail */}
        {article.thumbnail_url && (
          <div className="relative w-40 h-24 rounded-md overflow-hidden flex-shrink-0 bg-black/20">
            {!imageError ? (
              <Image
                src={article.thumbnail_url}
                alt={title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="160px"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500/20 to-orange-500/5">
                <span className="text-3xl opacity-50">{titleEmoji || "📰"}</span>
              </div>
            )}
            {/* Anthropic Badge */}
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-orange-500/90 text-white text-[9px] font-bold flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" />
              OFFICIAL
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Source & Date & Meta */}
          <div className="flex items-center gap-2 mb-1.5 text-[10px] text-text-muted flex-wrap">
            <span className="flex items-center gap-1 text-orange-400">
              {favicon && (
                <Image
                  src={favicon}
                  alt=""
                  width={12}
                  height={12}
                  className="rounded-sm"
                  sizes="12px"
                />
              )}
              {article.source_name || "Anthropic"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {date}
            </span>
            {readTime && <span className="text-text-muted/60">📖 {readTime}</span>}
            {difficulty && (
              <span
                className={`px-1 py-0.5 rounded text-[9px] font-medium border ${difficultyColors[difficulty]}`}
              >
                {difficulty === "easy" ? "Easy" : difficulty === "medium" ? "Medium" : "Advanced"}
              </span>
            )}
          </div>

          {/* Title with Emoji */}
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1.5 group-hover:text-orange-400 transition-colors leading-snug line-clamp-2">
            {titleEmoji && <span className="mr-1">{titleEmoji}</span>}
            {title}
          </h3>

          {/* Summary */}
          {summary && (
            <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2 mb-1.5">
              {summary}
            </p>
          )}

          {/* Analogy (Rich Content Only) */}
          {analogy && (
            <div className="text-[10px] px-2 py-1.5 rounded-md bg-orange-500/10 border-l-2 border-orange-500/50 mb-2">
              <span className="mr-1">{analogy.icon}</span>
              <span className="text-text-secondary italic">{analogy.text}</span>
            </div>
          )}

          {/* Key Points */}
          {keyPoints && keyPoints.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keyPoints.slice(0, 3).map((point, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: point.highlight
                      ? `${point.highlight}15`
                      : "rgba(249, 115, 22, 0.1)",
                    color: point.highlight || "rgba(249, 115, 22, 0.9)",
                  }}
                >
                  <span>{point.icon}</span>
                  <span>
                    {point.text.length > 30 ? point.text.slice(0, 30) + "..." : point.text}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Read More */}
          <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            <span>Read more</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </div>
        </div>
      </article>
    </a>
  );
}
