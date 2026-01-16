"use client";

import { memo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolWithVoters } from "@/types/tools";
import { CATEGORY_META, PRICING_META, isNewTool, isHotTool } from "@/types/tools";
import VoteButton from "./VoteButton";

// =====================================================
// Types
// =====================================================

interface ToolListItemProps {
  tool: ToolWithVoters;
  rank?: number;
  isVoted?: boolean;
  onVote?: (toolId: string) => Promise<void>;
  onSuggesterClick?: (userId: string) => void;
  showRank?: boolean;
  currentUserId?: string; // 현재 로그인된 사용자 ID
  currentUserAvatar?: string; // 현재 사용자 아바타
  currentUserName?: string; // 현재 사용자 이름
  className?: string;
}

// =====================================================
// Component - 새로운 2줄 레이아웃
// =====================================================

function ToolListItemComponent({
  tool,
  rank,
  isVoted = false,
  onVote,
  showRank = true,
  currentUserId,
  currentUserAvatar,
  currentUserName,
  className,
}: ToolListItemProps) {
  const [voted, setVoted] = useState(isVoted);
  const [voteCount, setVoteCount] = useState(tool.upvote_count);
  const [isVoting, setIsVoting] = useState(false);
  const [voters, setVoters] = useState(tool.voters);

  // isVoted prop이 변경되면 상태 동기화
  useEffect(() => {
    setVoted(isVoted);
  }, [isVoted]);

  const categoryMeta = CATEGORY_META[tool.category];
  const pricingMeta = PRICING_META[tool.pricing_type];
  const isNew = isNewTool(tool.created_at);
  const isHot = isHotTool(tool.upvote_count, tool.created_at);
  const isFeatured = tool.status === "featured";

  // 댓글 수 계산 (comment가 있는 voter 수)
  const commentCount = voters.filter((v) => v.comment).length;

  // 표시할 최대 아바타 수 (모바일에서는 더 적게)
  const MAX_VISIBLE_AVATARS_DESKTOP = 12;
  const MAX_VISIBLE_AVATARS_MOBILE = 4;

  const handleVote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isVoting) return;

    setIsVoting(true);
    const wasVoted = voted;

    try {
      // Optimistic UI 업데이트
      setVoted(!wasVoted);
      setVoteCount((prev) => (wasVoted ? prev - 1 : prev + 1));

      // 아바타 목록 optimistic 업데이트
      if (!wasVoted && currentUserId) {
        // 투표 추가 - 내 아바타를 맨 앞에 추가
        const newVoter = {
          user_id: currentUserId,
          username: currentUserName || "You",
          avatar_url: currentUserAvatar || null,
          trust_tier: "member" as const,
          weight: 1,
          comment: null,
        };
        setVoters((prev) => [newVoter, ...prev]);
      } else if (wasVoted && currentUserId) {
        // 투표 취소 - 내 아바타 제거 (슬라이딩 윈도우 효과)
        setVoters((prev) => prev.filter((v) => v.user_id !== currentUserId));
      }

      await onVote?.(tool.id);
    } catch {
      // 실패 시 롤백
      setVoted(wasVoted);
      setVoteCount((prev) => (wasVoted ? prev + 1 : prev - 1));
      setVoters(tool.voters);
    } finally {
      setIsVoting(false);
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

  // 가격 색상 클래스
  const getPricingColorClass = () => {
    switch (pricingMeta.color) {
      case "green":
        return "text-green-400";
      case "blue":
        return "text-blue-400";
      case "purple":
        return "text-purple-400";
      case "cyan":
        return "text-cyan-400";
      default:
        return "text-[var(--color-text-secondary)]";
    }
  };

  // 아바타 렌더링 헬퍼
  const renderAvatars = (maxAvatars: number) => (
    <AnimatePresence mode="popLayout">
      <div className="flex items-center">
        {voters.slice(0, maxAvatars).map((voter, index) => (
          <motion.div
            key={voter.user_id}
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -10 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
              delay: index * 0.02,
            }}
            className={cn(
              "relative w-6 h-6 rounded-full overflow-visible",
              "border-2 border-[var(--color-bg-card)]",
              "flex-shrink-0 group/avatar cursor-pointer"
            )}
            style={{
              marginLeft: index === 0 ? 0 : -8,
              zIndex: maxAvatars - index,
            }}
          >
            <div className="w-full h-full rounded-full overflow-hidden">
              {voter.avatar_url ? (
                <Image
                  src={voter.avatar_url}
                  alt={voter.username}
                  width={24}
                  height={24}
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--color-bg-elevated)] text-[9px] font-medium text-[var(--color-text-muted)]">
                  {voter.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[var(--color-bg-elevated)] border border-[var(--border-default)] rounded text-[10px] text-[var(--color-text-primary)] whitespace-nowrap opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              @{voter.username}
            </div>
          </motion.div>
        ))}
        {voters.length > maxAvatars && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "w-6 h-6 rounded-full",
              "border-2 border-[var(--color-bg-card)]",
              "bg-[var(--color-bg-elevated)]",
              "flex items-center justify-center",
              "text-[9px] font-medium text-[var(--color-text-muted)]",
              "flex-shrink-0"
            )}
            style={{ marginLeft: -8, zIndex: 0 }}
          >
            +{voters.length - maxAvatars}
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );

  // 상태 뱃지 렌더링 헬퍼
  const renderStatusBadge = () => {
    if (isFeatured) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] bg-gradient-to-r from-[var(--color-claude-coral)]/20 to-purple-500/20 text-[var(--color-claude-coral)] flex-shrink-0">
          ⭐
        </span>
      );
    }
    if (isHot) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] bg-orange-500/20 text-orange-400 flex-shrink-0">
          🔥
        </span>
      );
    }
    if (isNew) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-500/20 text-green-400 font-medium flex-shrink-0">
          NEW
        </span>
      );
    }
    return null;
  };

  return (
    <Link href={`/tools/${tool.slug}`} className="block group">
      <motion.div
        whileHover={{ x: 2 }}
        className={cn(
          "px-3 py-3 rounded-lg",
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
        {/* ==================== MOBILE LAYOUT (3-row) ==================== */}
        <div className="sm:hidden flex gap-2">
          {/* Left: Rank (vertically centered to entire card height) */}
          {showRank && rank && (
            <div className="w-6 flex-shrink-0 flex items-center justify-center">
              {getRankBadge() ? (
                <span className="text-base">{getRankBadge()}</span>
              ) : (
                <span className="text-[10px] font-bold text-[var(--color-text-muted)]">
                  #{rank}
                </span>
              )}
            </div>
          )}

          {/* Right: Logo + Content */}
          <div className="flex-1 min-w-0">
            {/* Top section: Logo + Name/Avatars */}
            <div className="flex gap-2.5">
              {/* Logo */}
              <div className="flex-shrink-0">
                {tool.logo_url ? (
                  <Image
                    src={tool.logo_url}
                    alt={tool.name}
                    width={40}
                    height={40}
                    className="rounded-lg object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center text-xl">
                    {categoryMeta.emoji}
                  </div>
                )}
              </div>

              {/* Name + Avatars column */}
              <div
                className={cn(
                  "flex-1 min-w-0 flex flex-col",
                  // vote한 사람이 없으면 세로 중앙 정렬
                  voters.length === 0 && "justify-center"
                )}
              >
                {/* Row 1: Name + Badge */}
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-claude-coral)] transition-colors">
                    {tool.name}
                  </h3>
                  {renderStatusBadge()}
                </div>

                {/* Row 2: Avatars + Vote Button (only if voters exist) */}
                {voters.length > 0 ? (
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                      {renderAvatars(MAX_VISIBLE_AVATARS_MOBILE)}
                      {commentCount > 0 && (
                        <div className="flex items-center gap-0.5 text-[var(--color-text-muted)]">
                          <MessageCircle className="w-3 h-3" />
                          <span className="text-[10px]">{commentCount}</span>
                        </div>
                      )}
                    </div>
                    <VoteButton
                      count={voteCount}
                      voted={voted}
                      loading={isVoting}
                      onClick={handleVote}
                      size="sm"
                    />
                  </div>
                ) : (
                  /* No voters: Vote button next to name */
                  <div className="flex items-center justify-end mt-1">
                    <VoteButton
                      count={voteCount}
                      voted={voted}
                      loading={isVoting}
                      onClick={handleVote}
                      size="sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Description (below logo, left-aligned with logo) */}
            <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-2 mt-1.5">
              {tool.tagline}
            </p>
          </div>
        </div>

        {/* ==================== DESKTOP LAYOUT (original) ==================== */}
        <div className="hidden sm:flex items-center gap-3">
          {/* Rank Badge */}
          {showRank && rank && (
            <div className="w-7 flex-shrink-0 flex items-center justify-center">
              {getRankBadge() ? (
                <span className="text-lg">{getRankBadge()}</span>
              ) : (
                <span className="text-xs font-bold text-[var(--color-text-muted)]">#{rank}</span>
              )}
            </div>
          )}

          {/* Logo */}
          <div className="flex-shrink-0">
            {tool.logo_url ? (
              <Image
                src={tool.logo_url}
                alt={tool.name}
                width={40}
                height={40}
                className="rounded-lg object-cover"
                unoptimized
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center text-xl">
                {categoryMeta.emoji}
              </div>
            )}
          </div>

          {/* Name + Tagline + Price */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-semibold text-sm text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-claude-coral)] transition-colors">
                {tool.name}
              </h3>
              {renderStatusBadge()}
              <span
                className={cn(
                  "text-[11px] font-medium flex-shrink-0 ml-auto",
                  getPricingColorClass()
                )}
              >
                {pricingMeta.label}
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] truncate pr-2">
              {tool.tagline}
            </p>
          </div>

          {/* Voter Avatars */}
          <div className="flex-shrink-0 flex items-center gap-2">
            {renderAvatars(MAX_VISIBLE_AVATARS_DESKTOP)}
            {commentCount > 0 && (
              <div className="flex items-center gap-1 text-[var(--color-text-muted)] ml-1">
                <MessageCircle className="w-3 h-3" />
                <span className="text-[10px]">{commentCount}</span>
              </div>
            )}
          </div>

          {/* Vote Button */}
          <div className="flex-shrink-0 pl-2">
            <VoteButton
              count={voteCount}
              voted={voted}
              loading={isVoting}
              onClick={handleVote}
              size="sm"
            />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default memo(ToolListItemComponent);
