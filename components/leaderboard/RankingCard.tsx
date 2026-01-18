"use client";

import { forwardRef, type HTMLAttributes } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { RankChangeBadge } from "@/components/ui/Badge";

// ============================================
// Types
// ============================================

export interface RankingCardProps extends HTMLAttributes<HTMLDivElement> {
  rank: number;
  username: string;
  avatarUrl?: string;
  country?: string;
  countryFlag?: string;
  level?: number;
  tokens: string;
  cost: string;
  rankChange?: number;
  userId?: string;
}

// ============================================
// Component (Mobile-optimized card)
// ============================================

export const RankingCard = forwardRef<HTMLDivElement, RankingCardProps>(
  (
    {
      className,
      rank,
      username,
      avatarUrl,
      country,
      countryFlag,
      level,
      tokens,
      cost,
      rankChange = 0,
      userId,
      ...props
    },
    ref
  ) => {
    const content = (
      <div className="p-4">
        {/* Top section: Rank + User info + Rank change */}
        <div className="flex items-center justify-between mb-3">
          {/* Rank */}
          <span className="text-lg font-bold text-[var(--color-claude-coral)]">#{rank}</span>

          {/* Rank change */}
          <RankChangeBadge change={rankChange} size="sm" />
        </div>

        {/* User section */}
        <div className="flex items-center gap-3 mb-3">
          {/* Avatar */}
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={username}
              width={48}
              height={48}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-claude-coral)] to-[var(--color-claude-rust)] flex items-center justify-center text-white font-bold text-lg">
              {username.charAt(0).toUpperCase()}
            </div>
          )}

          {/* User info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[var(--color-text-primary)] truncate">{username}</p>
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              {countryFlag && <span>{countryFlag}</span>}
              {country && <span>{country}</span>}
              {level && <span className="text-[var(--color-text-secondary)]">Lv.{level}</span>}
            </div>
          </div>
        </div>

        {/* Stats section */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border-default)]">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Tokens</p>
            <p className="font-mono font-medium text-[var(--color-text-primary)]">{tokens}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Cost</p>
            <p className="font-mono text-[var(--color-text-secondary)]">{cost}</p>
          </div>
        </div>
      </div>
    );

    const cardClasses = cn(
      "group relative rounded-xl overflow-hidden",
      "bg-[var(--color-bg-card)]",
      "border border-[var(--border-default)]",
      "transition-all duration-200",
      "hover:border-[var(--color-claude-coral)]/20",
      "hover:bg-[var(--color-bg-card-hover)]",
      "active:scale-[0.98]",
      userId && "cursor-pointer",
      className
    );

    if (userId) {
      return (
        <Link href={`/u/${username}`} className="block">
          <div ref={ref} className={cardClasses} {...props}>
            {/* Left highlight bar */}
            <div
              className={cn(
                "absolute left-0 top-0 bottom-0 w-1",
                "bg-gradient-to-b from-[var(--color-claude-coral)] to-[var(--color-claude-rust)]",
                "opacity-0 group-hover:opacity-100",
                "transition-opacity duration-300"
              )}
            />
            {content}
          </div>
        </Link>
      );
    }

    return (
      <div ref={ref} className={cardClasses} {...props}>
        {/* Left highlight bar */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1",
            "bg-gradient-to-b from-[var(--color-claude-coral)] to-[var(--color-claude-rust)]",
            "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-300"
          )}
        />
        {content}
      </div>
    );
  }
);

RankingCard.displayName = "RankingCard";

export default RankingCard;
