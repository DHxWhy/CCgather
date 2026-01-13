"use client";

import { memo, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, Sparkles, ArrowRight } from "lucide-react";
import type { ContentItem } from "@/types/automation";
import { isNewArticle } from "@/lib/utils/sanitize";

// ===========================================
// Constants (outside component to avoid recreation)
// ===========================================

const DIFFICULTY_COLORS = {
  easy: "bg-green-500/20 text-green-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  hard: "bg-red-500/20 text-red-400",
} as const;

const DIFFICULTY_LABELS = {
  easy: "쉬움",
  medium: "보통",
  hard: "심화",
} as const;

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

const DEFAULT_ACCENT_COLOR = "#F97316";

// ===========================================
// Types
// ===========================================

interface NewsCardProps {
  article: ContentItem;
  variant?: "default" | "featured" | "compact";
  isLatest?: boolean;
}

type Difficulty = keyof typeof DIFFICULTY_COLORS;

// ===========================================
// Helper Components
// ===========================================

const DifficultyBadge = memo(function DifficultyBadge({
  difficulty,
  size = "default",
}: {
  difficulty: Difficulty;
  size?: "small" | "default";
}) {
  const sizeClass = size === "small" ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[9px]";
  return (
    <span className={`rounded font-medium ${sizeClass} ${DIFFICULTY_COLORS[difficulty]}`}>
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
});

const SourceBadge = memo(function SourceBadge({
  favicon,
  sourceName,
  size = "default",
}: {
  favicon?: string;
  sourceName?: string;
  size?: "small" | "default";
}) {
  if (!sourceName) return null;

  const iconSize = size === "small" ? 10 : 12;
  const textSize = size === "small" ? "text-[9px]" : "text-[10px]";
  const padding = size === "small" ? "px-1.5 py-0.5" : "px-2 py-0.5";
  const gap = size === "small" ? "gap-1" : "gap-1.5";
  const position = size === "small" ? "bottom-1.5 left-1.5" : "bottom-2 left-2";

  return (
    <div
      className={`absolute ${position} flex items-center ${gap} ${padding} rounded bg-black/70 backdrop-blur-sm`}
    >
      {favicon && (
        <Image
          src={favicon}
          alt=""
          width={iconSize}
          height={iconSize}
          className="rounded-sm"
          unoptimized
        />
      )}
      <span className={`text-white ${textSize} font-medium`}>{sourceName}</span>
    </div>
  );
});

const NewBadge = memo(function NewBadge({ size = "default" }: { size?: "small" | "default" }) {
  const sizeClass = size === "small" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]";
  return <span className={`rounded font-medium bg-green-500/90 text-white ${sizeClass}`}>NEW</span>;
});

// ===========================================
// Main Component
// ===========================================

function NewsCardComponent({ article, variant = "default", isLatest = false }: NewsCardProps) {
  // Memoize derived data to prevent recalculation on re-render
  const cardData = useMemo(() => {
    const richContent = article.rich_content;
    const hasRichContent = !!richContent;

    return {
      title: hasRichContent ? richContent.title.text : article.title,
      titleEmoji: hasRichContent ? richContent.title.emoji : undefined,
      summary:
        article.one_liner ||
        (hasRichContent ? richContent.summary.text : article.summary || article.summary_md),
      difficulty: (hasRichContent ? richContent.meta.difficulty : article.difficulty) as
        | Difficulty
        | undefined,
      category: hasRichContent ? richContent.meta.category : article.category,
      accentColor: hasRichContent ? richContent.style?.accentColor : DEFAULT_ACCENT_COLOR,
      favicon: article.favicon_url || richContent?.source?.favicon,
      date: new Date(article.published_at || article.created_at).toLocaleDateString(
        "ko-KR",
        DATE_FORMAT_OPTIONS
      ),
      isNew: isNewArticle(article.published_at, article.created_at),
      href: article.slug ? `/news/${article.slug}` : "#",
    };
  }, [article]);

  const {
    title,
    titleEmoji,
    summary,
    difficulty,
    category,
    accentColor,
    favicon,
    date,
    isNew,
    href,
  } = cardData;

  // Featured card (LATEST card)
  if (variant === "featured" || isLatest) {
    return (
      <Link
        href={href}
        className="block group snap-start flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-xl"
        aria-label={`최신 기사: ${title}`}
      >
        <article className="relative w-[320px] md:w-[400px] h-[280px] rounded-xl overflow-hidden border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-purple-500/5 hover:border-orange-500/50 transition-all">
          {/* Background Image */}
          {article.thumbnail_url && (
            <div className="absolute inset-0">
              <Image
                src={article.thumbnail_url}
                alt=""
                fill
                className="object-cover opacity-30 group-hover:opacity-40 transition-opacity duration-300"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            </div>
          )}

          {/* Content */}
          <div className="relative h-full p-5 flex flex-col justify-end">
            {/* LATEST Badge */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                LATEST
              </span>
              {isNew && <NewBadge />}
            </div>

            {/* Category & Date */}
            <div className="flex items-center gap-2 text-xs text-white/60 mb-2">
              {category && <span className="px-2 py-0.5 rounded bg-white/10">{category}</span>}
              <time
                className="flex items-center gap-1"
                dateTime={article.published_at || article.created_at}
              >
                <Clock className="w-3 h-3" aria-hidden="true" />
                {date}
              </time>
            </div>

            {/* Title */}
            <h3 className="text-lg md:text-xl font-bold text-white mb-2 group-hover:text-orange-400 transition-colors leading-tight line-clamp-2">
              {titleEmoji && (
                <span className="mr-1.5" aria-hidden="true">
                  {titleEmoji}
                </span>
              )}
              {title}
            </h3>

            {/* Summary (One-liner) */}
            {summary && (
              <p className="text-sm text-white/70 leading-relaxed line-clamp-2 mb-3">{summary}</p>
            )}

            {/* CTA */}
            <div
              className="flex items-center gap-2 text-sm text-orange-400 font-medium group-hover:gap-3 transition-all"
              aria-hidden="true"
            >
              <span>자세히 보기</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </article>
      </Link>
    );
  }

  // Compact card (for horizontal scroll)
  if (variant === "compact") {
    return (
      <Link
        href={href}
        className="block group snap-start flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg"
        aria-label={`기사: ${title}`}
      >
        <article className="w-[260px] h-[200px] rounded-lg border border-[var(--border-default)] bg-white/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] hover:border-[var(--border-hover)] transition-all overflow-hidden">
          {/* Thumbnail */}
          <div className="relative w-full h-[100px] bg-black/20">
            {article.thumbnail_url ? (
              <Image
                src={article.thumbnail_url}
                alt=""
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
                <span className="text-3xl opacity-30" aria-hidden="true">
                  {titleEmoji || "📰"}
                </span>
              </div>
            )}
            <SourceBadge favicon={favicon} sourceName={article.source_name} size="small" />
            {isNew && (
              <div className="absolute top-1.5 right-1.5">
                <NewBadge size="small" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-3">
            {/* Date */}
            <div className="flex items-center gap-1 text-[9px] text-text-muted mb-1">
              <Clock className="w-2.5 h-2.5" aria-hidden="true" />
              <time dateTime={article.published_at || article.created_at}>{date}</time>
              {difficulty && (
                <span className="ml-1">
                  <DifficultyBadge difficulty={difficulty} size="small" />
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-xs font-medium text-[var(--color-text-primary)] group-hover:text-orange-400 transition-colors leading-snug line-clamp-2">
              {title}
            </h3>
          </div>
        </article>
      </Link>
    );
  }

  // Default card
  return (
    <Link
      href={href}
      className="block group snap-start flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg"
      aria-label={`기사: ${title}`}
    >
      <article className="w-[280px] md:w-[300px] h-[240px] rounded-lg border border-[var(--border-default)] bg-white/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] hover:border-[var(--border-hover)] transition-all overflow-hidden">
        {/* Thumbnail */}
        <div className="relative w-full h-[130px] bg-black/20">
          {article.thumbnail_url ? (
            <Image
              src={article.thumbnail_url}
              alt=""
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
              <span className="text-4xl opacity-30" aria-hidden="true">
                {titleEmoji || "📰"}
              </span>
            </div>
          )}
          <SourceBadge favicon={favicon} sourceName={article.source_name} />
          {/* Difficulty & New Badge */}
          <div className="absolute top-2 right-2 flex items-center gap-1">
            {isNew && <NewBadge size="small" />}
            {difficulty && <DifficultyBadge difficulty={difficulty} />}
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          {/* Date & Category */}
          <div className="flex items-center gap-2 text-[10px] text-text-muted mb-1.5">
            <time
              className="flex items-center gap-1"
              dateTime={article.published_at || article.created_at}
            >
              <Clock className="w-2.5 h-2.5" aria-hidden="true" />
              {date}
            </time>
            {category && (
              <span className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">{category}</span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-orange-400 transition-colors leading-snug line-clamp-2">
            {titleEmoji && (
              <span className="mr-1" aria-hidden="true">
                {titleEmoji}
              </span>
            )}
            {title}
          </h3>

          {/* Summary */}
          {summary && (
            <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-1 mt-1">
              {summary}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}

// Export memoized component to prevent unnecessary re-renders
const NewsCard = memo(NewsCardComponent);
export default NewsCard;
