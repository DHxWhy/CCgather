"use client";

import { memo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink, Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolWithVoters } from "@/types/tools";
import { CATEGORY_META, PRICING_META, isNewTool, isHotTool } from "@/types/tools";
import { AvatarGroup } from "@/components/ui/avatar-group";
import VoteButton from "./VoteButton";

// =====================================================
// Types
// =====================================================

interface ToolListItemProps {
  tool: ToolWithVoters;
  rank?: number;
  isVoted?: boolean;
  isBookmarked?: boolean;
  onVote?: (toolId: string) => Promise<void>;
  onBookmark?: (toolId: string) => Promise<void>;
  onSuggesterClick?: (userId: string) => void;
  showRank?: boolean;
  showWeighted?: boolean;
  showSuggester?: boolean;
  compact?: boolean;
  className?: string;
}

// =====================================================
// Component - 테이블 행 스타일의 밀도 높은 리스트 아이템
// =====================================================

function ToolListItemComponent({
  tool,
  rank,
  isVoted = false,
  isBookmarked = false,
  onVote,
  onBookmark,
  onSuggesterClick,
  showRank = true,
  showWeighted = false,
  showSuggester = true,
  compact = false,
  className,
}: ToolListItemProps) {
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

  // 상위 3위 특별 스타일
  const getRankStyle = () => {
    if (!rank) return {};
    if (rank === 1) return { borderColor: "var(--color-rank-gold)", boxShadow: "var(--glow-gold)" };
    if (rank === 2)
      return { borderColor: "var(--color-rank-silver)", boxShadow: "var(--glow-silver)" };
    if (rank === 3)
      return { borderColor: "var(--color-rank-bronze)", boxShadow: "var(--glow-bronze)" };
    return {};
  };

  const getRankBadge = () => {
    if (!rank) return null;
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  };

  return (
    <Link href={`/tools/${tool.slug}`} className="block group">
      <motion.div
        whileHover={{ x: 2 }}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg",
          "bg-[var(--color-bg-card)]",
          "border border-[var(--border-default)]",
          "hover:border-[var(--color-claude-coral)]/30",
          "hover:bg-[var(--color-bg-card-hover)]",
          "transition-all duration-200",
          rank && rank <= 3 && "border-2",
          className
        )}
        style={getRankStyle()}
      >
        {/* Rank */}
        {showRank && rank && (
          <div className="w-8 flex-shrink-0 text-center">
            {getRankBadge() ? (
              <span className="text-lg">{getRankBadge()}</span>
            ) : (
              <span className="text-sm font-bold text-[var(--color-text-muted)]">#{rank}</span>
            )}
          </div>
        )}

        {/* Logo */}
        {tool.logo_url ? (
          <Image
            src={tool.logo_url}
            alt={tool.name}
            width={compact ? 28 : 32}
            height={compact ? 28 : 32}
            className="rounded-md object-cover flex-shrink-0"
            unoptimized
          />
        ) : (
          <div
            className={cn(
              "rounded-md bg-[var(--color-bg-elevated)] flex items-center justify-center flex-shrink-0",
              compact ? "w-7 h-7 text-base" : "w-8 h-8 text-lg"
            )}
          >
            {categoryMeta.emoji}
          </div>
        )}

        {/* Name & Tagline */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                "font-medium text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-claude-coral)] transition-colors",
                compact ? "text-xs" : "text-sm"
              )}
            >
              {tool.name}
            </h3>

            {/* Badges */}
            {isFeatured && (
              <span className="px-1 py-0.5 rounded text-[9px] bg-gradient-to-r from-[var(--color-claude-coral)]/20 to-purple-500/20 text-[var(--color-claude-coral)] flex-shrink-0">
                ⭐
              </span>
            )}
            {isHot && !isFeatured && (
              <span className="px-1 py-0.5 rounded text-[9px] bg-orange-500/20 text-orange-400 flex-shrink-0">
                🔥
              </span>
            )}
            {isNew && !isHot && !isFeatured && (
              <span className="px-1 py-0.5 rounded text-[9px] bg-green-500/20 text-green-400 flex-shrink-0">
                NEW
              </span>
            )}
          </div>

          {!compact && (
            <p className="text-[11px] text-[var(--color-text-muted)] truncate">{tool.tagline}</p>
          )}
        </div>

        {/* Category */}
        <div className="hidden sm:flex items-center gap-1 w-24 flex-shrink-0">
          <span className="text-xs">{categoryMeta.emoji}</span>
          <span className="text-[11px] text-[var(--color-text-secondary)] truncate">
            {categoryMeta.label}
          </span>
        </div>

        {/* Pricing */}
        <div className="hidden md:block w-16 flex-shrink-0">
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px]",
              `bg-${pricingMeta.color}-500/15 text-${pricingMeta.color}-400`
            )}
          >
            {pricingMeta.label}
          </span>
        </div>

        {/* Suggester Info */}
        {showSuggester && tool.submitter && !compact && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSuggesterClick?.(tool.submitter!.id);
            }}
            className={cn(
              "hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md",
              "bg-[var(--color-bg-elevated)]/50",
              "hover:bg-[var(--color-bg-elevated)]",
              "transition-colors flex-shrink-0",
              "text-[10px] text-[var(--color-text-secondary)]",
              "hover:text-[var(--color-claude-coral)]"
            )}
          >
            {tool.submitter.avatar_url ? (
              <Image
                src={tool.submitter.avatar_url}
                alt={tool.submitter.username}
                width={16}
                height={16}
                className="rounded-full"
                unoptimized
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center text-[8px]">
                {tool.submitter.username.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="truncate max-w-[80px]">@{tool.submitter.username}</span>
          </button>
        )}

        {/* Top Voters Preview */}
        {tool.voters.length > 0 && (
          <div className="hidden lg:block flex-shrink-0">
            <AvatarGroup
              avatars={tool.voters.slice(0, 4).map((voter) => ({
                src: voter.avatar_url || "",
                alt: voter.username,
                label: `@${voter.username}`,
                fallback: voter.username.charAt(0).toUpperCase(),
              }))}
              maxVisible={4}
              size="sm"
              overlap="tight"
            />
          </div>
        )}

        {/* Weighted Score */}
        {showWeighted && (
          <div className="hidden xl:block w-16 text-right flex-shrink-0">
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {tool.weighted_score.toFixed(1)}
            </span>
          </div>
        )}

        {/* Vote Button */}
        <div className="flex-shrink-0">
          <VoteButton
            count={voteCount}
            voted={voted}
            loading={isVoting}
            onClick={handleVote}
            size={compact ? "xs" : "sm"}
          />
        </div>

        {/* Bookmark */}
        <button
          onClick={handleBookmark}
          disabled={isBookmarking}
          className={cn(
            "p-1 rounded transition-colors flex-shrink-0",
            bookmarked ? "text-yellow-500" : "text-[var(--color-text-muted)] hover:text-yellow-500"
          )}
          aria-label={bookmarked ? "북마크 해제" : "북마크"}
        >
          {bookmarked ? (
            <BookmarkCheck className={cn(compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
          ) : (
            <Bookmark className={cn(compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
          )}
        </button>

        {/* External Link */}
        <a
          href={tool.website_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors flex-shrink-0"
        >
          <ExternalLink className={cn(compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
        </a>
      </motion.div>
    </Link>
  );
}

export default memo(ToolListItemComponent);
