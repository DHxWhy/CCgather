"use client";

import { memo, useState, useEffect, useCallback, type ReactNode } from "react";
import Image from "next/image";
import { Heart, MessageCircle, Trophy, Crown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ===========================================
// Types
// ===========================================

export interface HallOfFameEntry {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  count: number;
}

export type HallOfFamePeriod = "today" | "weekly" | "monthly";

interface HallOfFameProps {
  onUserClick?: (userId: string) => void;
  onPostClick?: (postId: string) => void;
  className?: string;
  /** External period control - hides internal header/filter when provided */
  period?: HallOfFamePeriod;
  /** Hide header (when controlled externally) */
  hideHeader?: boolean;
}

// ===========================================
// Rank Badge Component (Compact for 2-column)
// ===========================================

function RankBadge({ rank }: { rank: number }) {
  const badges: Record<number, { icon: ReactNode; color: string; bg: string }> = {
    1: {
      icon: <Crown size={8} />,
      color: "text-amber-400",
      bg: "bg-amber-400/20",
    },
    2: {
      icon: <span className="text-[8px] font-bold">#2</span>,
      color: "text-slate-300",
      bg: "bg-slate-400/20",
    },
    3: {
      icon: <span className="text-[8px] font-bold">#3</span>,
      color: "text-amber-600",
      bg: "bg-amber-600/20",
    },
  };

  const badge = badges[rank];
  if (!badge) return null;

  return (
    <div
      className={cn(
        "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0",
        badge.bg,
        badge.color
      )}
    >
      {badge.icon}
    </div>
  );
}

// ===========================================
// Compact Entry Row for 2-column layout
// ===========================================

function CompactEntryRow({
  entry,
  rank,
  type,
  onUserClick,
  onPostClick,
}: {
  entry: HallOfFameEntry;
  rank: number;
  type: "liked" | "replied";
  onUserClick?: (userId: string) => void;
  onPostClick?: (postId: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 py-1 px-1 -mx-1 rounded group hover:bg-white/5 transition-colors cursor-pointer">
      {/* Rank Badge */}
      <button
        onClick={() => onPostClick?.(entry.postId)}
        className="flex-shrink-0 hover:scale-110 transition-transform"
        title="View post"
      >
        <RankBadge rank={rank} />
      </button>

      {/* User Avatar */}
      <button
        onClick={() => onUserClick?.(entry.userId)}
        className="flex-shrink-0 hover:ring-1 hover:ring-[var(--color-claude-coral)]/50 rounded-full transition-all"
        title="View profile"
      >
        {entry.userAvatar ? (
          <Image
            src={entry.userAvatar}
            alt={entry.userName}
            width={20}
            height={20}
            className="w-5 h-5 rounded-full"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--color-claude-coral)] to-[var(--color-claude-rust)] flex items-center justify-center text-[8px] font-semibold text-white">
            {entry.userName[0]?.toUpperCase()}
          </div>
        )}
      </button>

      {/* User Name */}
      <button
        onClick={() => onUserClick?.(entry.userId)}
        className="flex-1 text-left text-[10px] text-[var(--color-text-primary)] truncate hover:text-[var(--color-claude-coral)] transition-colors min-w-0"
        title={entry.userName}
      >
        {entry.userName}
      </button>

      {/* Count */}
      <div className="flex items-center gap-0.5 text-[9px] text-[var(--color-text-muted)] flex-shrink-0">
        {type === "liked" ? (
          <Heart size={8} className="text-rose-400" />
        ) : (
          <MessageCircle size={8} className="text-[var(--color-accent-cyan)]" />
        )}
        <span className="tabular-nums font-medium">{entry.count}</span>
      </div>
    </div>
  );
}

// ===========================================
// Hall of Fame Component
// ===========================================

function HallOfFameComponent({
  onUserClick,
  onPostClick,
  className,
  period: externalPeriod,
  hideHeader = false,
}: HallOfFameProps) {
  const [internalPeriod, setInternalPeriod] = useState<HallOfFamePeriod>("today");
  const [mostLiked, setMostLiked] = useState<HallOfFameEntry[]>([]);
  const [mostReplied, setMostReplied] = useState<HallOfFameEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Use external period if provided, otherwise use internal state
  const period = externalPeriod ?? internalPeriod;

  const periodLabels: Record<HallOfFamePeriod, string> = {
    today: "1D",
    weekly: "7D",
    monthly: "30D",
  };

  // Fetch data when period changes
  const fetchData = useCallback(async (selectedPeriod: HallOfFamePeriod) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/community/hall-of-fame?period=${selectedPeriod}`);
      if (response.ok) {
        const data = await response.json();
        setMostLiked(data.mostLiked || []);
        setMostReplied(data.mostReplied || []);
      }
    } catch (error) {
      console.error("Failed to fetch Hall of Fame data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and refetch on period change
  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  const handlePeriodChange = (newPeriod: HallOfFamePeriod) => {
    if (newPeriod !== internalPeriod) {
      setInternalPeriod(newPeriod);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with Trophy + Period Toggle (hidden when externally controlled) */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy size={14} className="text-amber-400" />
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">
              Hall of Fame
            </span>
          </div>

          {/* Compact Period Toggle (only when not externally controlled) */}
          {!externalPeriod && (
            <div className="flex items-center h-[24px] glass rounded-lg overflow-hidden">
              {(Object.keys(periodLabels) as HallOfFamePeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  disabled={isLoading}
                  className={cn(
                    "h-[24px] px-1.5 text-[9px] font-medium transition-colors",
                    period === p
                      ? "bg-[var(--color-claude-coral)]/50 text-[var(--color-claude-coral)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]",
                    isLoading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-[var(--color-text-muted)]" />
        </div>
      ) : (
        /* 2-Column Layout */
        <div className="grid grid-cols-2 gap-3">
          {/* Most Liked Column */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider pb-1 border-b border-[var(--border-default)]">
              <Heart size={9} className="text-rose-400" />
              <span>Liked</span>
            </div>
            <div className="space-y-0">
              {mostLiked.slice(0, 3).map((entry, index) => (
                <CompactEntryRow
                  key={entry.id}
                  entry={entry}
                  rank={index + 1}
                  type="liked"
                  onUserClick={onUserClick}
                  onPostClick={onPostClick}
                />
              ))}
              {mostLiked.length === 0 && (
                <p className="text-[9px] text-[var(--color-text-muted)] italic py-2">
                  No posts yet
                </p>
              )}
            </div>
          </div>

          {/* Most Replied Column */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider pb-1 border-b border-[var(--border-default)]">
              <MessageCircle size={9} className="text-[var(--color-accent-cyan)]" />
              <span>Replied</span>
            </div>
            <div className="space-y-0">
              {mostReplied.slice(0, 3).map((entry, index) => (
                <CompactEntryRow
                  key={entry.id}
                  entry={entry}
                  rank={index + 1}
                  type="replied"
                  onUserClick={onUserClick}
                  onPostClick={onPostClick}
                />
              ))}
              {mostReplied.length === 0 && (
                <p className="text-[9px] text-[var(--color-text-muted)] italic py-2">
                  No posts yet
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export memoized component
const HallOfFame = memo(HallOfFameComponent);
export default HallOfFame;
