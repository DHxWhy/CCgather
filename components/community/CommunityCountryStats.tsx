"use client";

import { memo, useState, useEffect, useCallback, useMemo } from "react";
import { Globe, Heart, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { FlagIcon } from "@/components/ui/FlagIcon";

// ===========================================
// Types
// ===========================================

export interface CommunityCountryStat {
  code: string;
  name: string;
  posts: number;
  likes: number;
  contributors: number;
}

type SortBy = "posts" | "likes";

interface CommunityCountryStatsProps {
  className?: string;
  userCountryCode?: string;
  compact?: boolean;
  maxItems?: number;
}

// ===========================================
// Country Row Component
// ===========================================

function CountryRow({
  stat,
  rank,
  maxValue,
  sortBy,
  isUserCountry,
  compact,
}: {
  stat: CommunityCountryStat;
  rank: number;
  maxValue: number;
  sortBy: SortBy;
  isUserCountry: boolean;
  compact: boolean;
}) {
  const currentValue = sortBy === "posts" ? stat.posts : stat.likes;
  const barWidth = maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
  const barColor = sortBy === "posts" ? "var(--color-accent-cyan)" : "var(--color-claude-coral)";

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 px-2 py-2 rounded-lg transition-colors",
        isUserCountry ? "bg-[var(--user-country-bg)]" : "hover:bg-white/5"
      )}
    >
      {/* Rank */}
      <span
        className={cn(
          "w-5 text-[10px] font-mono flex-shrink-0",
          rank === 1
            ? "text-amber-400 font-semibold"
            : rank === 2
              ? "text-slate-300"
              : rank === 3
                ? "text-amber-600"
                : "text-[var(--color-text-muted)]"
        )}
      >
        #{rank}
      </span>

      {/* Flag */}
      <FlagIcon countryCode={stat.code} size="xs" className="flex-shrink-0" />

      {/* Country Name */}
      <span
        className={cn(
          "flex-1 text-xs font-medium truncate",
          isUserCountry ? "text-[var(--user-country-text)]" : "text-[var(--color-text-primary)]"
        )}
      >
        {stat.name}
        {isUserCountry && <span className="ml-1 text-[10px]">🟢</span>}
      </span>

      {/* Stats */}
      <div
        className={cn("flex items-center gap-2 text-[10px] flex-shrink-0", compact && "gap-1.5")}
      >
        <span
          className={cn(
            "flex items-center gap-0.5",
            sortBy === "posts"
              ? "text-[var(--color-accent-cyan)]"
              : "text-[var(--color-text-muted)]"
          )}
        >
          <MessageSquare size={10} />
          <span className="tabular-nums">{stat.posts}</span>
        </span>
        <span
          className={cn(
            "flex items-center gap-0.5",
            sortBy === "likes" ? "text-rose-400" : "text-[var(--color-text-muted)]"
          )}
        >
          <Heart size={10} />
          <span className="tabular-nums">{stat.likes}</span>
        </span>
      </div>

      {/* Gauge Bar - absolute bottom */}
      <div className="absolute bottom-0.5 left-8 right-2 h-[2px] bg-[var(--color-filter-bg)] rounded-sm overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${barWidth}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

// ===========================================
// Loading Skeleton
// ===========================================

function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-2 animate-pulse">
          <div className="w-5 h-3 rounded bg-[var(--color-bg-card)]" />
          <div className="w-4 h-3 rounded bg-[var(--color-bg-card)]" />
          <div className="flex-1 h-3 rounded bg-[var(--color-bg-card)]" />
          <div className="w-12 h-3 rounded bg-[var(--color-bg-card)]" />
        </div>
      ))}
    </div>
  );
}

// ===========================================
// Empty State
// ===========================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <Globe size={20} className="text-[var(--color-text-muted)]" />
      <p className="text-[10px] text-[var(--color-text-muted)]">No country data yet</p>
      <p className="text-[10px] text-[var(--color-text-muted)]/70">Be the first to post!</p>
    </div>
  );
}

// ===========================================
// CommunityCountryStats Component
// ===========================================

function CommunityCountryStatsComponent({
  className,
  userCountryCode,
  compact = false,
  maxItems = 5,
}: CommunityCountryStatsProps) {
  const [stats, setStats] = useState<CommunityCountryStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("likes");

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/community/country-stats");
      if (!response.ok) {
        throw new Error("Failed to fetch");
      }
      const data = await response.json();
      setStats(data.stats || []);
    } catch (err) {
      console.error("Failed to fetch community country stats:", err);
      setError("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sort stats based on selected criteria
  const sortedStats = useMemo(() => {
    return [...stats].sort((a, b) => {
      if (sortBy === "posts") {
        return b.posts - a.posts || b.likes - a.likes;
      }
      return b.likes - a.likes || b.posts - a.posts;
    });
  }, [stats, sortBy]);

  // Calculate max value for gauge bar based on sort
  const maxValue = useMemo(() => {
    if (sortedStats.length === 0) return 1;
    return sortBy === "posts"
      ? Math.max(...sortedStats.map((s) => s.posts), 1)
      : Math.max(...sortedStats.map((s) => s.likes), 1);
  }, [sortedStats, sortBy]);

  // Find user's country rank (in sorted order)
  const userCountryIndex = userCountryCode
    ? sortedStats.findIndex((s) => s.code.toUpperCase() === userCountryCode.toUpperCase())
    : -1;
  const userCountryStat = userCountryIndex >= 0 ? sortedStats[userCountryIndex] : null;
  const userCountryRank = userCountryIndex >= 0 ? userCountryIndex + 1 : null;

  // Display stats (limited)
  const displayStats = sortedStats.slice(0, maxItems);

  // Check if user's country is visible in the list
  const isUserCountryVisible = userCountryIndex >= 0 && userCountryIndex < maxItems;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with Sort Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-[var(--color-accent-cyan)]" />
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">
            Top Countries
          </span>
        </div>

        {/* Sort Toggle */}
        <div className="flex h-6 rounded-md overflow-hidden bg-[var(--color-bg-card)] border border-[var(--border-default)]">
          <button
            onClick={() => setSortBy("posts")}
            className={cn(
              "flex items-center gap-1 px-2 text-[10px] transition-colors",
              sortBy === "posts"
                ? "bg-[var(--color-accent-cyan)]/20 text-[var(--color-accent-cyan)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
            title="Sort by Posts"
          >
            <MessageSquare size={10} />
          </button>
          <button
            onClick={() => setSortBy("likes")}
            className={cn(
              "flex items-center gap-1 px-2 text-[10px] transition-colors",
              sortBy === "likes"
                ? "bg-rose-400/20 text-rose-400"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
            title="Sort by Likes"
          >
            <Heart size={10} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton count={Math.min(maxItems, 3)} />
      ) : error ? (
        <div className="flex items-center justify-center py-4">
          <button
            onClick={fetchData}
            className="text-[10px] text-[var(--color-claude-coral)] hover:underline"
          >
            Retry
          </button>
        </div>
      ) : stats.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Country List */}
          <div className="space-y-0.5">
            {displayStats.map((stat, index) => (
              <CountryRow
                key={stat.code}
                stat={stat}
                rank={index + 1}
                maxValue={maxValue}
                sortBy={sortBy}
                isUserCountry={
                  !!userCountryCode && stat.code.toUpperCase() === userCountryCode.toUpperCase()
                }
                compact={compact}
              />
            ))}
          </div>

          {/* Your Country (if not visible in list) */}
          {userCountryStat && !isUserCountryVisible && (
            <>
              <div className="border-t border-dashed border-[var(--border-default)]" />
              <div className="flex items-center gap-2 px-2 text-[10px]">
                <span className="text-[var(--color-text-muted)]">📍 Your country:</span>
                <FlagIcon countryCode={userCountryStat.code} size="xs" />
                <span className="font-medium text-[var(--color-text-primary)]">
                  {userCountryStat.name}
                </span>
                <span className="text-[var(--color-claude-coral)] font-semibold">
                  #{userCountryRank}
                </span>
              </div>
            </>
          )}

          {/* Your Country indicator (if visible in list) */}
          {userCountryStat && isUserCountryVisible && (
            <div className="flex items-center gap-1.5 px-2 text-[10px] text-[var(--color-text-muted)]">
              <span>📍</span>
              <span>
                Your country is{" "}
                <span className="text-[var(--color-claude-coral)] font-semibold">
                  #{userCountryRank}
                </span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Export memoized component
const CommunityCountryStats = memo(CommunityCountryStatsComponent);
export default CommunityCountryStats;
