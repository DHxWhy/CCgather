"use client";

import Image from "next/image";
import { ExternalLink, Clock } from "lucide-react";
import type { ContentItem } from "@/types/automation";

interface PressNewsCardProps {
  article: ContentItem;
}

export default function PressNewsCard({ article }: PressNewsCardProps) {
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
        icon: "•",
        text,
        highlight: undefined as string | undefined,
      }));
  const difficulty = hasRichContent ? richContent.meta.difficulty : article.difficulty;
  const accentColor = hasRichContent ? richContent.style.accentColor : "#3B82F6";
  const favicon = article.favicon_url || richContent?.source.favicon;

  const date = new Date(article.published_at || article.created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Difficulty badge colors
  const difficultyColors = {
    easy: "bg-green-500/20 text-green-400",
    medium: "bg-yellow-500/20 text-yellow-400",
    hard: "bg-red-500/20 text-red-400",
  };

  return (
    <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="block group">
      <article className="h-full rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all overflow-hidden">
        {/* Thumbnail */}
        <div className="relative w-full aspect-video bg-black/20">
          {article.thumbnail_url ? (
            <Image
              src={article.thumbnail_url}
              alt={title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${accentColor}15, transparent)`,
              }}
            >
              <span className="text-4xl opacity-30">{titleEmoji || "📰"}</span>
            </div>
          )}
          {/* Source Badge with Favicon */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm">
            {favicon && (
              <Image
                src={favicon}
                alt=""
                width={12}
                height={12}
                className="rounded-sm"
                unoptimized
              />
            )}
            <span className="text-white text-[10px] font-medium">{article.source_name}</span>
          </div>
          {/* Difficulty Badge */}
          {difficulty && (
            <div
              className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-medium ${difficultyColors[difficulty]}`}
            >
              {difficulty === "easy" ? "쉬움" : difficulty === "medium" ? "보통" : "심화"}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          {/* Date & Emoji */}
          <div className="flex items-center gap-2 text-[10px] text-text-muted mb-1.5">
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {date}
            </span>
            {titleEmoji && <span>{titleEmoji}</span>}
          </div>

          {/* Title */}
          <h3 className="font-medium text-[var(--color-text-primary)] mb-1.5 group-hover:text-blue-400 transition-colors leading-snug line-clamp-2 text-sm">
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
            <div
              className="text-[10px] px-2 py-1 rounded-md mb-1.5"
              style={{
                backgroundColor: `${accentColor}10`,
                borderLeft: `2px solid ${accentColor}`,
              }}
            >
              <span className="mr-1">{analogy.icon}</span>
              <span className="text-text-secondary">{analogy.text}</span>
            </div>
          )}

          {/* Key Points (max 2 for card) */}
          {keyPoints && keyPoints.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {keyPoints.slice(0, 2).map((point, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-white/5 text-text-muted rounded"
                  style={
                    point.highlight
                      ? { backgroundColor: `${point.highlight}20`, color: point.highlight }
                      : undefined
                  }
                >
                  <span>{point.icon}</span>
                  <span className="line-clamp-1">
                    {point.text.length > 20 ? point.text.slice(0, 20) + "..." : point.text}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Read More Link */}
          <div className="mt-auto pt-1.5 flex items-center gap-1 text-[10px] text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            <span>더 보기</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </div>
        </div>
      </article>
    </a>
  );
}
