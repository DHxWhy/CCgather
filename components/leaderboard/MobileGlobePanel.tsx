"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { TopCountriesSection, TopCountriesSectionRef } from "./TopCountriesSection";
import type { CountryStat } from "./TopCountriesSection";
import HallOfFame, { type HallOfFamePeriod } from "@/components/community/HallOfFame";
import CommunityCountryStats from "@/components/community/CommunityCountryStats";
import AnimatedNumber from "@/components/ui/AnimatedNumber";

// Format tokens for display
function formatTokens(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

// Lazy load Globe
const Globe = dynamic(
  () => import("@/components/globe/Globe").then((mod) => ({ default: mod.Globe })),
  { ssr: false }
);

// Lazy load GlobeParticles
const GlobeParticles = dynamic(
  () => import("@/components/ui/globe-particles").then((mod) => ({ default: mod.GlobeParticles })),
  { ssr: false }
);

interface CommunityStats {
  members: number;
  posts: number;
  likes: number;
  contributors: number;
}

interface TotalCommunityStats {
  totalCountries: number;
  totalPosts: number;
  totalLikes: number;
}

interface MobileGlobePanelProps {
  isOpen: boolean;
  onClose: () => void;
  countryStats: CountryStat[];
  totalTokens: number;
  totalCost: number;
  sortBy: "tokens" | "cost";
  onSortByChange?: (sortBy: "tokens" | "cost") => void;
  userCountryCode?: string;
  scopeFilter: "global" | "country";
  // Community mode support
  viewMode?: "leaderboard" | "community";
  communityStats?: CommunityStats;
  totalCommunityStats?: TotalCommunityStats;
  onHallOfFameUserClick?: (userId: string) => void;
  onHallOfFamePostClick?: (postId: string) => void;
}

export function MobileGlobePanel({
  isOpen,
  onClose,
  countryStats,
  totalTokens,
  totalCost,
  sortBy,
  onSortByChange,
  userCountryCode,
  scopeFilter,
  viewMode = "leaderboard",
  communityStats: _communityStats, // Legacy prop, kept for backwards compatibility
  totalCommunityStats,
  onHallOfFameUserClick,
  onHallOfFamePostClick,
}: MobileGlobePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const countryListRef = useRef<HTMLDivElement>(null);
  const topCountriesSectionRef = useRef<TopCountriesSectionRef>(null);

  // User country sticky state
  const [userCountryVisible, setUserCountryVisible] = useState(true);
  const [userCountryRank, setUserCountryRank] = useState(0);
  const [userCountryData, setUserCountryData] = useState<CountryStat | null>(null);
  const [userCountryDirection, setUserCountryDirection] = useState<"above" | "below" | null>(null);

  // Dynamic sizing based on screen dimensions (matching ProfileSidePanel behavior)
  const [globeSize, setGlobeSize] = useState(240);

  // Community Stats period filter
  const [communityStatsPeriod, setCommunityStatsPeriod] = useState<HallOfFamePeriod>("today");

  // Handle user country visibility change
  const handleUserCountryVisibilityChange = useCallback(
    (
      visible: boolean,
      rank: number,
      stat: CountryStat | null,
      direction: "above" | "below" | null
    ) => {
      setUserCountryVisible(visible);
      setUserCountryRank(rank);
      setUserCountryData(stat);
      setUserCountryDirection(direction);
    },
    []
  );

  // Jump to user's country
  const jumpToUserCountry = useCallback(() => {
    topCountriesSectionRef.current?.scrollToUserCountry();
  }, []);

  // Update globe size based on screen dimensions
  useEffect(() => {
    const updateGlobeSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isLandscape = width > height;
      const panelAvailableWidth = width - 56; // Match ProfileSidePanel's calc(100% - 56px)

      if (isLandscape) {
        // Landscape: constrain by height
        setGlobeSize(Math.min(280, Math.floor(height * 0.4), panelAvailableWidth - 48));
      } else {
        // Portrait: constrain by panel width
        setGlobeSize(Math.min(260, panelAvailableWidth - 48));
      }
    };

    updateGlobeSize();

    window.addEventListener("resize", updateGlobeSize);
    window.addEventListener("orientationchange", updateGlobeSize);
    return () => {
      window.removeEventListener("resize", updateGlobeSize);
      window.removeEventListener("orientationchange", updateGlobeSize);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open (iOS compatible)
  useEffect(() => {
    if (isOpen) {
      // Store current scroll position
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0") * -1);
      }
    }
    return () => {
      const scrollY = document.body.style.top;
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0") * -1);
      }
    };
  }, [isOpen]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel - matches ProfileSidePanel width behavior, starts below GNB */}
      <div
        ref={panelRef}
        className={`fixed top-12 left-0 z-50 bg-[var(--color-bg-primary)] border-r border-[var(--border-default)] shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: "calc(100% - 56px)",
          maxWidth: "calc(100% - 56px)",
          height: "calc(100% - 48px)",
        }}
      >
        {/* Content - flex column to fill height */}
        <div className="h-full flex flex-col p-4 gap-4">
          {/* Title Section */}
          <div className="text-center pt-2 flex-shrink-0">
            <div className="flex items-center justify-center gap-3">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <span>{viewMode === "community" ? "🏆" : "🌍"}</span>
                {viewMode === "community" ? "Community Stats" : "Global Usage"}
              </h2>
              {/* Period Filter for Community Mode */}
              {viewMode === "community" && (
                <div className="flex items-center h-[30px] glass rounded-lg overflow-hidden">
                  {(["today", "weekly", "monthly"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setCommunityStatsPeriod(p)}
                      className={`h-[30px] px-2.5 text-[11px] font-medium transition-colors ${
                        communityStatsPeriod === p
                          ? "bg-[var(--color-claude-coral)]/50 text-[var(--color-claude-coral)]"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                      }`}
                    >
                      {p === "today" ? "1D" : p === "weekly" ? "7D" : "30D"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {viewMode === "community"
                ? "Top contributors this period"
                : "Unite at the country level!"}
            </p>
          </div>

          {/* Conditional Content based on viewMode */}
          {viewMode === "community" ? (
            /* Community Mode: Stats + Hall of Fame */
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
              {/* Community Stats Bar - Total cumulative stats */}
              {totalCommunityStats && (
                <div className="glass rounded-xl border border-[var(--border-default)] p-4 flex-shrink-0">
                  <div className="flex items-center justify-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5 text-[var(--color-accent-cyan)]">
                      <span>🌍</span>
                      <AnimatedNumber
                        value={totalCommunityStats.totalCountries}
                        perUnitDuration={800}
                        maxDuration={20000}
                        easing="linear"
                        className="font-semibold"
                        storageKey="community_countries"
                      />
                      <span className="text-[var(--color-text-muted)] text-xs">countries</span>
                    </span>
                    <span className="text-[var(--color-text-muted)]">·</span>
                    <span className="flex items-center gap-1.5 text-[var(--color-claude-coral)]">
                      <span>📝</span>
                      <AnimatedNumber
                        value={totalCommunityStats.totalPosts}
                        perUnitDuration={800}
                        maxDuration={20000}
                        easing="linear"
                        className="font-semibold"
                        storageKey="community_total_posts"
                      />
                      <span className="text-[var(--color-text-muted)] text-xs">posts</span>
                    </span>
                    <span className="text-[var(--color-text-muted)]">·</span>
                    <span className="flex items-center gap-1.5 text-[var(--color-accent-red)]">
                      <span>❤️</span>
                      <AnimatedNumber
                        value={totalCommunityStats.totalLikes}
                        perUnitDuration={800}
                        maxDuration={20000}
                        easing="linear"
                        className="font-semibold"
                        storageKey="community_total_likes"
                      />
                      <span className="text-[var(--color-text-muted)] text-xs">likes</span>
                    </span>
                  </div>
                </div>
              )}
              {/* Hall of Fame */}
              <div className="glass rounded-xl border border-[var(--border-default)] p-4">
                <HallOfFame
                  period={communityStatsPeriod}
                  hideHeader
                  onUserClick={onHallOfFameUserClick}
                  onPostClick={onHallOfFamePostClick}
                />
              </div>

              {/* Top Countries by Community Activity */}
              <div className="glass rounded-xl border border-[var(--border-default)] p-4 flex-1">
                <CommunityCountryStats
                  userCountryCode={userCountryCode}
                  compact={true}
                  maxItems={5}
                />
              </div>
            </div>
          ) : (
            /* Leaderboard Mode: Globe and Countries */
            <>
              {/* Globe with Filter Buttons */}
              <div className="relative flex justify-center flex-shrink-0">
                {/* Filter Buttons - Top Right of Globe */}
                {onSortByChange && (
                  <div className="absolute top-0 right-0 z-10 flex h-[34px] glass rounded-lg overflow-hidden">
                    <button
                      onClick={() => onSortByChange("cost")}
                      className={`h-[34px] w-[34px] text-sm font-medium transition-colors flex items-center justify-center ${
                        sortBy === "cost"
                          ? "bg-[var(--color-cost)]/30 text-[var(--color-cost)]"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                      }`}
                      title="Sort by Cost"
                    >
                      💰
                    </button>
                    <button
                      onClick={() => onSortByChange("tokens")}
                      className={`h-[34px] w-[34px] text-sm font-medium transition-colors flex items-center justify-center ${
                        sortBy === "tokens"
                          ? "bg-[var(--color-claude-coral)]/30 text-[var(--color-claude-coral)]"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                      }`}
                      title="Sort by Tokens"
                    >
                      ⚡
                    </button>
                  </div>
                )}
                <div
                  className="relative overflow-visible"
                  style={{ width: globeSize, height: globeSize }}
                >
                  <GlobeParticles size={globeSize} className="z-0" />
                  <Globe
                    size={globeSize}
                    userCountryCode={userCountryCode}
                    scopeFilter={scopeFilter}
                    className="relative z-10"
                  />
                </div>
              </div>

              {/* Global Stats - Total Cost & Tokens */}
              <div className="flex items-center justify-center gap-3 py-2 flex-shrink-0">
                <span className="text-base">🌍</span>
                <span className="text-[var(--color-text-muted)]">·</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-base">💰</span>
                  <span className="text-sm font-semibold text-[var(--color-cost)]">
                    $
                    {totalCost >= 1000 ? `${(totalCost / 1000).toFixed(1)}K` : totalCost.toFixed(0)}
                  </span>
                </div>
                <span className="text-[var(--color-text-muted)]">·</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-base">⚡</span>
                  <span className="text-sm font-semibold text-[var(--color-claude-coral)]">
                    {totalTokens >= 1_000_000_000
                      ? `${(totalTokens / 1_000_000_000).toFixed(2)}B`
                      : totalTokens >= 1_000_000
                        ? `${(totalTokens / 1_000_000).toFixed(1)}M`
                        : totalTokens.toLocaleString()}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Top Countries - fills remaining space to bottom (only in leaderboard mode) */}
          {viewMode === "leaderboard" && (
            <div className="glass rounded-xl border border-[var(--border-default)] flex-1 min-h-0 relative flex flex-col">
              {/* 📍 Your Country - Top (when scrolled below user's country) */}
              {!userCountryVisible && userCountryData && userCountryDirection === "above" && (
                <div
                  onClick={jumpToUserCountry}
                  className="absolute top-0 left-0 right-0 z-30 bg-[var(--glass-bg)] backdrop-blur-md rounded-t-xl cursor-pointer active:bg-[var(--glass-bg-hover)] transition-colors"
                >
                  <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide px-3 pt-2 pb-1 flex items-center gap-1">
                    <span>📍 Your Country</span>
                    <span className="text-[var(--color-text-muted)]/50">↑</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 h-10 bg-[var(--user-country-bg)] border-b border-[var(--color-text-muted)]/30">
                    <span className="w-6 text-xs font-mono text-[var(--color-text-muted)] flex-shrink-0">
                      #{userCountryRank}
                    </span>
                    <div className="w-4 flex-shrink-0">
                      <FlagIcon countryCode={userCountryData.code} size="xs" />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[var(--user-country-text)] truncate">
                        {userCountryData.name}
                        <span className="ml-1 text-[10px]">🟢</span>
                      </span>
                      <span className="text-[10px] font-mono text-[var(--color-text-muted)] flex-shrink-0">
                        {(
                          (sortBy === "tokens"
                            ? userCountryData.tokens / totalTokens
                            : userCountryData.cost / totalCost) * 100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="flex items-center font-mono flex-shrink-0 gap-2 text-[10px]">
                      {sortBy === "tokens" ? (
                        <span className="min-w-[40px] text-right text-[var(--color-cost)]">
                          $
                          {userCountryData.cost >= 1000
                            ? `${(userCountryData.cost / 1000).toFixed(1)}K`
                            : userCountryData.cost.toFixed(0)}
                        </span>
                      ) : (
                        <span className="min-w-[45px] text-right text-[var(--color-claude-coral)]">
                          {formatTokens(userCountryData.tokens)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div
                ref={countryListRef}
                className="p-3 pb-0 flex-1 min-h-0 overflow-y-auto"
                style={{
                  overscrollBehavior: "contain",
                  paddingTop:
                    !userCountryVisible && userCountryData && userCountryDirection === "above"
                      ? "68px"
                      : undefined,
                }}
              >
                {countryStats.length > 0 ? (
                  <TopCountriesSection
                    ref={topCountriesSectionRef}
                    stats={countryStats}
                    totalTokens={totalTokens}
                    totalCost={totalCost}
                    sortBy={sortBy}
                    userCountryCode={userCountryCode}
                    compact={true}
                    onUserCountryVisibilityChange={handleUserCountryVisibilityChange}
                    scrollContainerRef={countryListRef}
                  />
                ) : (
                  <div className="h-full" />
                )}
                {/* Spacer for sticky section */}
                {!userCountryVisible && userCountryData && userCountryDirection === "below" && (
                  <div className="h-16" />
                )}
              </div>

              {/* 📍 Your Country - Bottom (when scrolled above user's country) */}
              {!userCountryVisible && userCountryData && userCountryDirection === "below" && (
                <div
                  onClick={jumpToUserCountry}
                  className="absolute bottom-0 left-0 right-0 z-30 bg-[var(--glass-bg)] backdrop-blur-md border-t border-[var(--color-text-muted)]/30 rounded-b-xl cursor-pointer active:bg-[var(--glass-bg-hover)] transition-colors pb-4"
                >
                  <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide px-3 pt-2 pb-1 flex items-center gap-1">
                    <span>📍 Your Country</span>
                    <span className="text-[var(--color-text-muted)]/50">↓</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 h-10 bg-[var(--user-country-bg)]">
                    <span className="w-6 text-xs font-mono text-[var(--color-text-muted)] flex-shrink-0">
                      #{userCountryRank}
                    </span>
                    <div className="w-4 flex-shrink-0">
                      <FlagIcon countryCode={userCountryData.code} size="xs" />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[var(--user-country-text)] truncate">
                        {userCountryData.name}
                        <span className="ml-1 text-[10px]">🟢</span>
                      </span>
                      <span className="text-[10px] font-mono text-[var(--color-text-muted)] flex-shrink-0">
                        {(
                          (sortBy === "tokens"
                            ? userCountryData.tokens / totalTokens
                            : userCountryData.cost / totalCost) * 100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="flex items-center font-mono flex-shrink-0 gap-2 text-[10px]">
                      {sortBy === "tokens" ? (
                        <span className="min-w-[40px] text-right text-[var(--color-cost)]">
                          $
                          {userCountryData.cost >= 1000
                            ? `${(userCountryData.cost / 1000).toFixed(1)}K`
                            : userCountryData.cost.toFixed(0)}
                        </span>
                      ) : (
                        <span className="min-w-[45px] text-right text-[var(--color-claude-coral)]">
                          {formatTokens(userCountryData.tokens)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Safe area padding for mobile */}
                  <div className="h-[env(safe-area-inset-bottom,0px)]" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
