"use client";

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
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
  onUserCountryVisibilityChange?: (
    visible: boolean,
    rank: number,
    stat: CountryStat | null,
    direction: "above" | "below" | null
  ) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>; // For IntersectionObserver root
}

// Initial visible count and increment
const INITIAL_VISIBLE_COUNT = 5;
const LOAD_INCREMENT = 10;

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
      onUserCountryVisibilityChange,
      scrollContainerRef,
    },
    ref
  ) {
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
    const [isUserCountryActuallyVisible, setIsUserCountryActuallyVisible] = useState(false);
    const [userCountryDirection, setUserCountryDirection] = useState<"above" | "below" | null>(
      null
    );
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const userCountryRowRef = useRef<HTMLDivElement>(null);
    const pendingScrollRef = useRef(false);

    // Sort stats based on selected criteria
    const sortedStats = [...stats]
      .sort((a, b) => (sortBy === "tokens" ? b.tokens - a.tokens : b.cost - a.cost))
      .slice(0, maxItems ?? stats.length);

    // Calculate max values for progress bars
    const maxTokens = Math.max(...stats.map((s) => s.tokens), 1);
    const maxCost = Math.max(...stats.map((s) => s.cost), 1);

    // Find user's country data and rank
    const userCountryIndex = sortedStats.findIndex(
      (s) => userCountryCode && s.code.toUpperCase() === userCountryCode.toUpperCase()
    );
    const userCountryStat = userCountryIndex >= 0 ? sortedStats[userCountryIndex] : null;
    const isUserInTopVisible = userCountryIndex >= 0 && userCountryIndex < visibleCount;

    // Determine which items to show
    const visibleStats = sortedStats.slice(0, visibleCount);
    const hasMoreItems = visibleCount < sortedStats.length;

    // Expose scrollToUserCountry method via ref
    useImperativeHandle(
      ref,
      () => ({
        scrollToUserCountry: () => {
          if (userCountryIndex < 0) return;

          // If user's country is not yet visible, expand to show it first
          if (userCountryIndex >= visibleCount) {
            setVisibleCount(userCountryIndex + 1);
            pendingScrollRef.current = true;
          } else {
            // Already visible, scroll directly
            userCountryRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        },
      }),
      [userCountryIndex, visibleCount]
    );

    // Handle pending scroll after visibleCount expansion
    useEffect(() => {
      if (pendingScrollRef.current && userCountryRowRef.current) {
        // Small delay to ensure DOM is updated
        requestAnimationFrame(() => {
          userCountryRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          pendingScrollRef.current = false;
        });
      }
    }, [visibleCount]);

    // IntersectionObserver for auto-load on scroll
    useEffect(() => {
      const trigger = loadMoreRef.current;
      if (!trigger || !hasMoreItems) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setVisibleCount((prev) => Math.min(prev + LOAD_INCREMENT, sortedStats.length));
          }
        },
        { rootMargin: "100px", threshold: 0 }
      );

      observer.observe(trigger);
      return () => observer.disconnect();
    }, [hasMoreItems, sortedStats.length]);

    // IntersectionObserver for user's country row actual visibility and direction
    useEffect(() => {
      const row = userCountryRowRef.current;
      if (!row || !userCountryStat) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry) {
            setIsUserCountryActuallyVisible(entry.isIntersecting);

            // Determine direction when not visible
            if (!entry.isIntersecting && entry.rootBounds) {
              // If the row's bottom is above the viewport top → user country is ABOVE
              // If the row's top is below the viewport bottom → user country is BELOW
              if (entry.boundingClientRect.bottom < entry.rootBounds.top) {
                setUserCountryDirection("above");
              } else if (entry.boundingClientRect.top > entry.rootBounds.bottom) {
                setUserCountryDirection("below");
              }
            } else {
              setUserCountryDirection(null);
            }
          }
        },
        {
          root: scrollContainerRef?.current || null,
          rootMargin: "0px",
          threshold: 0.1,
        }
      );

      observer.observe(row);
      return () => observer.disconnect();
    }, [visibleCount, userCountryStat, scrollContainerRef]);

    // Notify parent when user country visibility changes
    useEffect(() => {
      if (onUserCountryVisibilityChange) {
        // Use actual visibility (IntersectionObserver) instead of just "loaded" state
        const actuallyVisible = isUserInTopVisible && isUserCountryActuallyVisible;
        onUserCountryVisibilityChange(
          actuallyVisible,
          userCountryIndex + 1,
          userCountryStat ?? null,
          userCountryDirection
        );
      }
    }, [
      isUserInTopVisible,
      isUserCountryActuallyVisible,
      userCountryIndex,
      userCountryStat,
      onUserCountryVisibilityChange,
      userCountryDirection,
    ]);

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
          className={`group flex items-center gap-2 px-3 py-1.5 transition-all duration-300 animate-fadeIn ${
            isUserCountry ? "bg-[var(--user-country-bg)]" : "hover:bg-[var(--glass-bg)]"
          }`}
          style={{
            animationDelay: `${Math.min(index * 30, 300)}ms`,
            animationFillMode: "backwards",
          }}
        >
          {/* Rank - vertically centered */}
          <span className="w-6 text-xs font-mono text-[var(--color-text-muted)] flex-shrink-0 self-center">
            #{displayRank}
          </span>

          {/* Flag */}
          <FlagIcon countryCode={stat.code} size="sm" className="flex-shrink-0 self-center" />

          {/* Country name + Gauge (stacked) */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            {/* Top row: Country name + percentage */}
            <div className="flex items-center gap-1.5">
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
              <span className="text-[10px] font-mono text-[var(--color-text-muted)] flex-shrink-0">
                {percentage.toFixed(1)}%
              </span>
            </div>
            {/* Gauge bar below country name */}
            <div className="w-full h-[3px] bg-[var(--color-filter-bg)] rounded-sm overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{ background: barColor, width: `${barWidth}%` }}
              />
            </div>
          </div>

          {/* Cost & Tokens - responsive based on compact prop */}
          <div
            className={`flex items-center font-mono flex-shrink-0 self-center ${compact ? "gap-2 text-[10px]" : "gap-3 text-xs"}`}
          >
            {compact ? (
              /* Compact: show only the non-selected value with its color */
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
              /* Default: both values */
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

        {/* Country List */}
        <div className="flex flex-col">
          {visibleStats.map((stat, index) => {
            const isUserCountry =
              userCountryCode && stat.code.toUpperCase() === userCountryCode.toUpperCase();
            return renderCountryRow(stat, index, !!isUserCountry);
          })}
        </div>

        {/* Scroll trigger for auto-load */}
        {hasMoreItems && (
          <div ref={loadMoreRef} className="h-4 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-[var(--color-claude-coral)]/30 border-t-[var(--color-claude-coral)] rounded-full animate-spin" />
          </div>
        )}

        {/* Onboarding Copy */}
        <p className="text-center text-[11px] text-[var(--color-text-muted)]/60 mt-4">
          More developers = stronger country ranking
        </p>
        <div className="flex justify-center mt-2">
          <GetStartedButton className="text-[11px] text-[var(--color-claude-coral)] hover:underline" />
        </div>
      </div>
    );
  }
);
