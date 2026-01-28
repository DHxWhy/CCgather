"use client";

import { memo, useState, useEffect, useCallback, type ReactNode } from "react";
import Image from "next/image";
import { Heart, MessageCircle, Trophy, Flame, Crown, Loader2 } from "lucide-react";
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

interface HallOfFameProps {
  onUserClick?: (userId: string) => void;
  onPostClick?: (postId: string) => void;
  className?: string;
}

type TimePeriod = "today" | "weekly" | "monthly";

// ===========================================
// Rank Badge Component
// ===========================================

function RankBadge({ rank }: { rank: number }) {
  const badges: Record<number, { icon: ReactNode; color: string; bg: string }> = {
    1: {
      icon: <Crown size={10} />,
      color: "text-amber-400",
      bg: "bg-amber-400/20",
    },
    2: {
      icon: <span className="text-[9px] font-bold">#2</span>,
      color: "text-slate-300",
      bg: "bg-slate-400/20",
    },
    3: {
      icon: <span className="text-[9px] font-bold">#3</span>,
      color: "text-amber-600",
      bg: "bg-amber-600/20",
    },
  };

  const badge = badges[rank];
  if (!badge) return null;

  return (
    <div
      className={cn("w-5 h-5 rounded-full flex items-center justify-center", badge.bg, badge.color)}
    >
      {badge.icon}
    </div>
  );
}

// ===========================================
// Entry Row Component
// ===========================================

function EntryRow({
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
    <div className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg group hover:bg-white/5 transition-colors cursor-pointer">
      {/* Rank Badge - clickable to view post */}
      <button
        onClick={() => onPostClick?.(entry.postId)}
        className="flex-shrink-0 hover:scale-110 transition-transform"
        title="View post"
      >
        <RankBadge rank={rank} />
      </button>

      {/* User Avatar - clickable to view profile */}
      <button
        onClick={() => onUserClick?.(entry.userId)}
        className="flex-shrink-0 hover:ring-2 hover:ring-[var(--color-claude-coral)]/50 rounded-full transition-all"
        title="View profile"
      >
        {entry.userAvatar ? (
          <Image
            src={entry.userAvatar}
            alt={entry.userName}
            width={24}
            height={24}
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-claude-coral)] to-[var(--color-claude-rust)] flex items-center justify-center text-[10px] font-semibold text-white">
            {entry.userName[0]?.toUpperCase()}
          </div>
        )}
      </button>

      {/* User Name - clickable to view profile */}
      <button
        onClick={() => onUserClick?.(entry.userId)}
        className="flex-1 text-left text-xs text-[var(--color-text-primary)] truncate hover:text-[var(--color-claude-coral)] transition-colors"
        title="View profile"
      >
        {entry.userName}
      </button>

      {/* Count */}
      <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
        {type === "liked" ? (
          <Heart size={10} className="text-rose-400" />
        ) : (
          <MessageCircle size={10} className="text-[var(--color-accent-cyan)]" />
        )}
        <span className="tabular-nums font-medium">{entry.count}</span>
      </div>
    </div>
  );
}

// ===========================================
// Hall of Fame Component
// ===========================================

function HallOfFameComponent({ onUserClick, onPostClick, className }: HallOfFameProps) {
  const [period, setPeriod] = useState<TimePeriod>("today");
  const [mostLiked, setMostLiked] = useState<HallOfFameEntry[]>([]);
  const [mostReplied, setMostReplied] = useState<HallOfFameEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const periodLabels: Record<TimePeriod, string> = {
    today: "Today",
    weekly: "Weekly",
    monthly: "Monthly",
  };

  // Fetch data when period changes
  const fetchData = useCallback(async (selectedPeriod: TimePeriod) => {
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

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    if (newPeriod !== period) {
      setPeriod(newPeriod);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with Trophy */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-amber-400" />
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">
            Hall of Fame
          </span>
        </div>
        <Flame size={12} className="text-[var(--color-claude-coral)] animate-pulse" />
      </div>

      {/* Time Period Tabs */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--color-bg-card)]">
        {(Object.keys(periodLabels) as TimePeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => handlePeriodChange(p)}
            disabled={isLoading}
            className={cn(
              "flex-1 py-1 px-2 text-[10px] font-medium rounded-md transition-all",
              period === p
                ? "bg-[var(--color-claude-coral)] text-white"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" />
        </div>
      ) : (
        <>
          {/* Most Liked Section */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
              <Heart size={10} className="text-rose-400" />
              <span>Most Liked</span>
            </div>
            <div className="space-y-0.5">
              {mostLiked.slice(0, 3).map((entry, index) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  rank={index + 1}
                  type="liked"
                  onUserClick={onUserClick}
                  onPostClick={onPostClick}
                />
              ))}
              {mostLiked.length === 0 && (
                <p className="text-[10px] text-[var(--color-text-muted)] italic py-2">
                  No posts yet
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--border-default)]" />

          {/* Most Replied Section */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
              <MessageCircle size={10} className="text-[var(--color-accent-cyan)]" />
              <span>Most Replied</span>
            </div>
            <div className="space-y-0.5">
              {mostReplied.slice(0, 3).map((entry, index) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  rank={index + 1}
                  type="replied"
                  onUserClick={onUserClick}
                  onPostClick={onPostClick}
                />
              ))}
              {mostReplied.length === 0 && (
                <p className="text-[10px] text-[var(--color-text-muted)] italic py-2">
                  No posts yet
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Export memoized component
const HallOfFame = memo(HallOfFameComponent);
export default HallOfFame;
