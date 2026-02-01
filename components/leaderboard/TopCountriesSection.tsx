"use client";

import {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useCallback,
} from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { formatNumber, formatCost } from "@/lib/utils/format";
import { GetStartedButton } from "@/components/auth/GetStartedButton";

export interface TopCountriesSectionRef {
  scrollToUserCountry: () => void;
}

export interface CountryStat {
  code: string;
  name: string;
  tokens: number;
  cost: number;
}

interface TopCountriesSectionProps {
  stats: CountryStat[];
  totalTokens: number;
  totalCost: number;
  sortBy?: "tokens" | "cost";
  userCountryCode?: string;
  maxItems?: number;
  className?: string;
  compact?: boolean; // Compact layout for narrow viewports
  hideHeader?: boolean; // Hide header (when rendered externally as sticky)
  hasSubmission?: boolean; // Hide Get Started CTA if user has CLI submission history
  onUserCountryVisibilityChange?: (
    visible: boolean,
    rank: number,
    stat: CountryStat | null,
    direction: "above" | "below" | null
  ) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>; // For IntersectionObserver root
}

// Type for combined visibility state
interface VisibilityState {
  isVisible: boolean;
  direction: "above" | "below" | null;
}

export const TopCountriesSection = forwardRef<TopCountriesSectionRef, TopCountriesSectionProps>(
  function TopCountriesSection(
    {
      stats,
      totalTokens,
      totalCost,
      sortBy = "tokens",
      userCountryCode,
      maxItems,
      className = "",
      compact = false,
      hideHeader = false,
      hasSubmission = false,
      onUserCountryVisibilityChange,
      scrollContainerRef,
    },
    ref
  ) {
    // Combined visibility state to prevent double updates
    const [visibilityState, setVisibilityState] = useState<VisibilityState>({
      isVisible: false,
      direction: null,
    });
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const userCountryRowRef = useRef<HTMLDivElement>(null);

    // Sort stats based on selected criteria (memoized to prevent infinite loops)
    const sortedStats = useMemo(
      () =>
        [...stats]
          .sort((a, b) => (sortBy === "tokens" ? b.tokens - a.tokens : b.cost - a.cost))
          .slice(0, maxItems ?? stats.length),
      [stats, sortBy, maxItems]
    );

    // Calculate max values for progress bars (memoized)
    const maxTokens = useMemo(() => Math.max(...stats.map((s) => s.tokens), 1), [stats]);
    const maxCost = useMemo(() => Math.max(...stats.map((s) => s.cost), 1), [stats]);

    // Find user's country data and rank (memoized to prevent infinite loops)
    const userCountryIndex = useMemo(
      () =>
        sortedStats.findIndex(
          (s) => userCountryCode && s.code.toUpperCase() === userCountryCode.toUpperCase()
        ),
      [sortedStats, userCountryCode]
    );
    const userCountryStat = useMemo(
      () => (userCountryIndex >= 0 ? sortedStats[userCountryIndex] : null),
      [sortedStats, userCountryIndex]
    );

    // Expose scrollToUserCountry method via ref (using Virtuoso scrollToIndex)
    useImperativeHandle(
      ref,
      () => ({
        scrollToUserCountry: () => {
          if (userCountryIndex < 0) return;
          virtuosoRef.current?.scrollToIndex({
            index: userCountryIndex,
            align: "center",
            behavior: "smooth",
          });
        },
      }),
      [userCountryIndex]
    );

    // Refs for tracking previous values to prevent unnecessary updates
    const lastVisibilityRef = useRef<VisibilityState>({ isVisible: false, direction: null });
    const lastNotifiedRef = useRef<{
      visible: boolean;
      rank: number;
      direction: "above" | "below" | null;
    } | null>(null);
    const callbackRef = useRef(onUserCountryVisibilityChange);
    callbackRef.current = onUserCountryVisibilityChange;

    // Store scroll container ref value to avoid issues with ref object in dependencies
    const scrollRootRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
      scrollRootRef.current = scrollContainerRef?.current || null;
    }, [scrollContainerRef]);

    // IntersectionObserver for user's country row visibility and direction
    useEffect(() => {
      const row = userCountryRowRef.current;
      if (!row || userCountryIndex < 0) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;

          const newVisible = entry.isIntersecting;
          let newDirection: "above" | "below" | null = null;

          // Determine direction when not visible
          if (!newVisible && entry.rootBounds) {
            if (entry.boundingClientRect.bottom < entry.rootBounds.top) {
              newDirection = "above";
            } else if (entry.boundingClientRect.top > entry.rootBounds.bottom) {
              newDirection = "below";
            }
          }

          // Only update if values actually changed
          const last = lastVisibilityRef.current;
          if (last.isVisible !== newVisible || last.direction !== newDirection) {
            lastVisibilityRef.current = { isVisible: newVisible, direction: newDirection };
            setVisibilityState({ isVisible: newVisible, direction: newDirection });
          }
        },
        {
          root: scrollRootRef.current,
          rootMargin: "0px",
          threshold: 0.1,
        }
      );

      observer.observe(row);
      return () => observer.disconnect();
    }, [userCountryIndex]); // Only re-create observer when user country index changes

    // Notify parent when user country visibility changes
    const notifyParent = useCallback(() => {
      const callback = callbackRef.current;
      if (!callback) return;

      const actuallyVisible = visibilityState.isVisible;
      const newRank = userCountryIndex + 1;
      const direction = visibilityState.direction;

      // Only call callback if values actually changed
      const last = lastNotifiedRef.current;
      if (
        last &&
        last.visible === actuallyVisible &&
        last.rank === newRank &&
        last.direction === direction
      ) {
        return;
      }

      lastNotifiedRef.current = { visible: actuallyVisible, rank: newRank, direction };
      callback(actuallyVisible, newRank, userCountryStat ?? null, direction);
    }, [visibilityState, userCountryIndex, userCountryStat]);

    // Call notifyParent when relevant values change
    useEffect(() => {
      notifyParent();
    }, [notifyParent]);

    if (sortedStats.length === 0) {
      return null;
    }

    // Render a single country row
    const renderCountryRow = (
      stat: CountryStat,
      index: number,
      isUserCountry: boolean,
      showRank?: number
    ) => {
      const percentage =
        sortBy === "tokens" ? (stat.tokens / totalTokens) * 100 : (stat.cost / totalCost) * 100;
      const barWidth =
        sortBy === "tokens" ? (stat.tokens / maxTokens) * 100 : (stat.cost / maxCost) * 100;
      const barColor = sortBy === "tokens" ? "var(--color-claude-coral)" : "#f59e0b";
      const displayRank = showRank !== undefined ? showRank : index + 1;

      return (
        <div
          key={`${stat.code}-${displayRank}`}
          ref={isUserCountry ? userCountryRowRef : undefined}
          data-country-code={stat.code}
          className={`group relative flex items-center gap-2 px-3 h-10 transition-all duration-300 animate-fadeIn ${
            isUserCountry ? "bg-[var(--user-country-bg)]" : "hover:bg-[var(--glass-bg)]"
          }`}
          style={{
            animationDelay: `${Math.min(index * 30, 300)}ms`,
            animationFillMode: "backwards",
          }}
        >
          {/* Rank */}
          <span className="w-6 text-xs font-mono text-[var(--color-text-muted)] flex-shrink-0">
            #{displayRank}
          </span>

          {/* Flag */}
          <FlagIcon countryCode={stat.code} size="sm" className="flex-shrink-0" />

          {/* Country name + Percentage (right aligned) */}
          <div className="flex-1 min-w-0 flex items-center gap-1">
            <span
              className={`text-xs font-medium truncate leading-tight ${
                isUserCountry
                  ? "text-[var(--user-country-text)]"
                  : "text-[var(--color-text-primary)]"
              }`}
            >
              {stat.name}
              {isUserCountry && <span className="ml-1 text-[10px]">🟢</span>}
            </span>
            <span className="text-[10px] font-mono text-[var(--color-text-muted)] ml-auto flex-shrink-0">
              {percentage.toFixed(1)}%
            </span>
          </div>

          {/* Cost & Tokens */}
          <div
            className={`flex items-center font-mono flex-shrink-0 ${compact ? "gap-2 text-[10px]" : "gap-3 text-xs"}`}
          >
            {compact ? (
              sortBy === "tokens" ? (
                <span className="min-w-[40px] text-right text-[var(--color-cost)]">
                  {formatCost(stat.cost)}
                </span>
              ) : (
                <span className="min-w-[45px] text-right text-[var(--color-claude-coral)]">
                  {formatNumber(stat.tokens)}
                </span>
              )
            ) : (
              <>
                <span
                  className={`min-w-[40px] text-right ${
                    sortBy === "tokens"
                      ? "text-[var(--color-text-muted)]"
                      : "text-[var(--color-cost)]"
                  }`}
                >
                  {formatCost(stat.cost)}
                </span>
                <span
                  className={`min-w-[45px] text-right ${
                    sortBy === "cost"
                      ? "text-[var(--color-text-muted)]"
                      : "text-[var(--color-claude-coral)]"
                  }`}
                >
                  {formatNumber(stat.tokens)}
                </span>
              </>
            )}
          </div>

          {/* Gauge bar - absolute bottom, from flag to end */}
          <div className="absolute bottom-1 left-[44px] right-3 h-[3px] bg-[var(--color-filter-bg)] rounded-sm overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{ background: barColor, width: `${barWidth}%` }}
            />
          </div>
        </div>
      );
    };

    return (
      <div className={`${className}`}>
        {/* Header - conditionally rendered */}
        {!hideHeader && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
              🏆 Top Countries
            </h3>
            <span className="text-xs text-[var(--color-text-muted)]">
              by {sortBy === "tokens" ? "Token Usage" : "Cost"}
            </span>
          </div>
        )}

        {/* Virtualized Country List */}
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: Math.min(sortedStats.length * 40, 300) }}
          data={sortedStats}
          overscan={100}
          className="scrollbar-hide"
          itemContent={(index, stat) => {
            const isUserCountry =
              userCountryCode && stat.code.toUpperCase() === userCountryCode.toUpperCase();
            return renderCountryRow(stat, index, !!isUserCountry);
          }}
        />

        {/* Onboarding Copy - Only show for users without CLI submission */}
        {!hasSubmission && (
          <>
            <p className="text-center text-[11px] text-[var(--color-text-muted)]/60 mt-4">
              More developers = stronger country ranking
            </p>
            <div className="flex justify-center mt-2">
              <GetStartedButton className="text-[11px] text-[var(--color-claude-coral)] hover:underline" />
            </div>
          </>
        )}
      </div>
    );
  }
);
