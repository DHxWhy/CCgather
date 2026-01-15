"use client";

import { memo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink, Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolWithVoters, ToolCardVariant } from "@/types/tools";
import { CATEGORY_META, PRICING_META, isNewTool, isHotTool } from "@/types/tools";
import VoteButton from "./VoteButton";
import VoterPreview from "./VoterPreview";

// =====================================================
// Types
// =====================================================

interface ToolCardProps {
  tool: ToolWithVoters;
  variant?: ToolCardVariant;
  isVoted?: boolean;
  isBookmarked?: boolean;
  onVote?: (toolId: string) => Promise<void>;
  onBookmark?: (toolId: string) => Promise<void>;
  showVoters?: boolean;
  showComment?: boolean;
  className?: string;
}

// =====================================================
// Component
// =====================================================

function ToolCardComponent({
  tool,
  variant = "default",
  isVoted = false,
  isBookmarked = false,
  onVote,
  onBookmark,
  showVoters = true,
  showComment = true,
  className,
}: ToolCardProps) {
  const [voted, setVoted] = useState(isVoted);
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [voteCount, setVoteCount] = useState(tool.upvote_count);
  const [isVoting, setIsVoting] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);

  const categoryMeta = CATEGORY_META[tool.category];
  const pricingMeta = PRICING_META[tool.pricing_type];
  const isNew = isNewTool(tool.created_at);
  const isHot = isHotTool(tool.upvote_count, tool.created_at);
  const isFeatured = tool.status === "featured";

  const handleVote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isVoting) return;

    setIsVoting(true);
    try {
      await onVote?.(tool.id);
      setVoted(!voted);
      setVoteCount((prev) => (voted ? prev - 1 : prev + 1));
    } catch {
      // Revert on error
    } finally {
      setIsVoting(false);
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isBookmarking) return;

    setIsBookmarking(true);
    try {
      await onBookmark?.(tool.id);
      setBookmarked(!bookmarked);
    } catch {
      // Revert on error
    } finally {
      setIsBookmarking(false);
    }
  };

  // Featured 변형
  if (variant === "featured") {
    return (
      <Link href={`/tools/${tool.slug}`} className="block group">
        <motion.article
          whileHover={{ y: -2 }}
          className={cn(
            "relative w-[220px] h-[200px] p-4 rounded-xl overflow-hidden",
            "bg-gradient-to-br from-[var(--color-claude-coral)]/10 via-transparent to-purple-500/5",
            "border-2 border-[var(--color-claude-coral)]/30",
            "hover:border-[var(--color-claude-coral)]/50",
            "transition-all duration-300",
            className
          )}
        >
          {/* Featured Badge */}
          <div className="absolute top-2 left-2">
            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[var(--color-claude-coral)] to-[var(--color-claude-rust)] text-white text-[10px] font-bold flex items-center gap-1">
              ⭐ FEATURED
            </span>
          </div>

          {/* Logo */}
          <div className="flex justify-center mt-6 mb-3">
            {tool.logo_url ? (
              <Image
                src={tool.logo_url}
                alt={tool.name}
                width={48}
                height={48}
                className="rounded-lg object-cover"
                unoptimized
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center text-2xl">
                {categoryMeta.emoji}
              </div>
            )}
          </div>

          {/* Name */}
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] text-center truncate group-hover:text-[var(--color-claude-coral)] transition-colors">
            {tool.name}
          </h3>

          {/* Tagline */}
          <p className="text-[11px] text-[var(--color-text-secondary)] text-center line-clamp-2 mt-1 leading-tight">
            {tool.tagline}
          </p>

          {/* Bottom: Category + Stats */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {categoryMeta.emoji} {categoryMeta.label}
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--color-text-secondary)]">▲ {voteCount}</span>
            </div>
          </div>
        </motion.article>
      </Link>
    );
  }

  // Compact 변형
  if (variant === "compact") {
    return (
      <Link href={`/tools/${tool.slug}`} className="block group">
        <motion.article
          whileHover={{ y: -1 }}
          className={cn(
            "w-[160px] p-3 rounded-lg",
            "bg-[var(--color-bg-card)]",
            "border border-[var(--border-default)]",
            "hover:border-[var(--border-hover)]",
            "hover:bg-[var(--color-bg-card-hover)]",
            "transition-all duration-200",
            className
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            {tool.logo_url ? (
              <Image
                src={tool.logo_url}
                alt={tool.name}
                width={28}
                height={28}
                className="rounded-md object-cover flex-shrink-0"
                unoptimized
              />
            ) : (
              <div className="w-7 h-7 rounded-md bg-[var(--color-bg-elevated)] flex items-center justify-center text-base flex-shrink-0">
                {categoryMeta.emoji}
              </div>
            )}
            <h3 className="text-xs font-medium text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-claude-coral)]">
              {tool.name}
            </h3>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--color-text-muted)]">{categoryMeta.emoji}</span>
            <span className="text-[10px] text-[var(--color-text-secondary)]">▲ {voteCount}</span>
          </div>
        </motion.article>
      </Link>
    );
  }

  // Default 변형 - 콘텐츠 밀도 높게
  return (
    <Link href={`/tools/${tool.slug}`} className="block group">
      <motion.article
        whileHover={{ x: 2 }}
        className={cn(
          "relative p-3 rounded-lg",
          "bg-[var(--color-bg-card)]",
          "border border-[var(--border-default)]",
          "hover:border-[var(--color-claude-coral)]/30",
          "hover:bg-[var(--color-bg-card-hover)]",
          "transition-all duration-200",
          className
        )}
      >
        {/* Left accent bar on hover */}
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[var(--color-claude-coral)] to-[var(--color-claude-rust)] opacity-0 group-hover:opacity-100 transition-opacity rounded-l-lg" />

        {/* Main content row */}
        <div className="flex items-start gap-3">
          {/* Logo */}
          {tool.logo_url ? (
            <Image
              src={tool.logo_url}
              alt={tool.name}
              width={40}
              height={40}
              className="rounded-lg object-cover flex-shrink-0"
              unoptimized
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center text-xl flex-shrink-0">
              {categoryMeta.emoji}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title row with actions */}
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-claude-coral)] transition-colors">
                {tool.name}
              </h3>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <VoteButton
                  count={voteCount}
                  voted={voted}
                  loading={isVoting}
                  onClick={handleVote}
                  size="sm"
                />
                <button
                  onClick={handleBookmark}
                  disabled={isBookmarking}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    bookmarked
                      ? "text-yellow-500 bg-yellow-500/10"
                      : "text-[var(--color-text-muted)] hover:text-yellow-500 hover:bg-yellow-500/10"
                  )}
                  aria-label={bookmarked ? "북마크 해제" : "북마크"}
                >
                  {bookmarked ? (
                    <BookmarkCheck className="w-4 h-4" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Tagline */}
            <p className="text-xs text-[var(--color-text-secondary)] line-clamp-1 mt-0.5">
              {tool.tagline}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {/* Category */}
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium",
                  `bg-${categoryMeta.color}-500/20 text-${categoryMeta.color}-400`
                )}
                style={{
                  backgroundColor: `var(--color-cat-${tool.category.replace("-", "-")}, rgba(139, 92, 246, 0.2))`,
                }}
              >
                {categoryMeta.emoji} {categoryMeta.label}
              </span>

              {/* Pricing */}
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px]",
                  `bg-${pricingMeta.color}-500/15 text-${pricingMeta.color}-400`
                )}
              >
                {pricingMeta.label}
              </span>

              {/* Badges */}
              {isFeatured && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-gradient-to-r from-[var(--color-claude-coral)]/20 to-purple-500/20 text-[var(--color-claude-coral)]">
                  ⭐ Featured
                </span>
              )}
              {isHot && !isFeatured && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-400">
                  🔥 Hot
                </span>
              )}
              {isNew && !isHot && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400">
                  🆕 New
                </span>
              )}

              {/* External link */}
              <a
                href={tool.website_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Voters preview */}
            {showVoters && tool.voters.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[var(--border-default)]">
                <VoterPreview voters={tool.voters} totalVotes={tool.upvote_count} showCount={4} />
              </div>
            )}

            {/* Top comment */}
            {showComment && tool.top_comment && (
              <div className="mt-2 pt-2 border-t border-[var(--border-default)]">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-[var(--color-text-muted)]">💬</span>
                  <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-1 flex-1">
                    "{tool.top_comment.comment}"
                  </p>
                  <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
                    @{tool.top_comment.username}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.article>
    </Link>
  );
}

export default memo(ToolCardComponent);
