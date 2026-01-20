"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import ReactCountryFlag from "react-country-flag";
import { useUser } from "@clerk/nextjs";
import { GlobeStatsSection } from "@/components/leaderboard/GlobeStatsSection";
import { TopCountriesSection } from "@/components/leaderboard/TopCountriesSection";
import { DateRangeButton } from "@/components/leaderboard/DateRangePicker";
import { PeriodDropdown } from "@/components/leaderboard/PeriodDropdown";
import { TimezoneClock } from "@/components/ui/timezone-clock";
import { LEVELS, getLevelByTokens } from "@/lib/constants/levels";
import { Info } from "lucide-react";
import { format } from "date-fns";
import type { LeaderboardUser, PeriodFilter, ScopeFilter, SortByFilter } from "@/lib/types";

// Dynamic imports for heavy components - reduces initial bundle significantly
const ProfileSidePanel = dynamic(
  () => import("@/components/leaderboard/ProfileSidePanel").then((mod) => mod.ProfileSidePanel),
  { ssr: false }
);

const MobileGlobePanel = dynamic(
  () => import("@/components/leaderboard/MobileGlobePanel").then((mod) => mod.MobileGlobePanel),
  { ssr: false }
);

const DateRangePicker = dynamic(
  () => import("@/components/leaderboard/DateRangePicker").then((mod) => mod.DateRangePicker),
  { ssr: false }
);

const GlobeParticles = dynamic(
  () => import("@/components/ui/globe-particles").then((mod) => mod.GlobeParticles),
  { ssr: false }
);

interface CountryStat {
  code: string;
  name: string;
  tokens: number;
  cost: number;
}

// Format numbers - compact display (K/M/B for 1000+, plain for <1000)
function formatTokens(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

// Country Flag with Popover
function CountryFlag({ countryCode, size = 16 }: { countryCode: string; size?: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative inline-block leading-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ReactCountryFlag
        countryCode={countryCode}
        svg
        style={{ width: `${size}px`, height: `${size}px`, display: "block" }}
      />
      {isHovered && (
        <div className="absolute right-full mr-1.5 top-1/2 -translate-y-1/2 z-50 px-1.5 py-0.5 bg-[var(--color-bg-secondary)] border border-white/10 rounded shadow-lg whitespace-nowrap">
          <span className="text-[10px] font-medium text-[var(--color-text-primary)]">
            {countryCode}
          </span>
        </div>
      )}
    </div>
  );
}

// Format token range for level display
function formatLevelRange(min: number, max: number): string {
  const formatNum = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(0)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
  };
  if (max === Infinity) return `${formatNum(min)}+`;
  return `${formatNum(min)} - ${formatNum(max)}`;
}

// Level Badge with Popover
function LevelBadge({ tokens }: { tokens: number }) {
  const currentLevel = getLevelByTokens(tokens);
  const useCssClass = currentLevel.level === 5 || currentLevel.level === 6;

  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
        useCssClass ? `level-badge-${currentLevel.level}` : ""
      }`}
      style={
        useCssClass
          ? undefined
          : { backgroundColor: `${currentLevel.color}20`, color: currentLevel.color }
      }
    >
      {currentLevel.icon} Lv.{currentLevel.level}
    </span>
  );
}

// Level Info Popover Component (PC hover)
function LevelInfoPopover({ isOpen }: { isOpen: boolean }) {
  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-full mt-2 z-[100] w-56 p-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg">
      <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
        Level System
      </div>
      <div className="space-y-0.5">
        {LEVELS.map((level) => {
          const useCssClass = level.level === 5 || level.level === 6;
          return (
            <div
              key={level.level}
              className={`flex items-center justify-between px-1.5 py-1 rounded text-[10px] ${
                useCssClass ? `level-badge-${level.level}` : ""
              }`}
              style={
                useCssClass
                  ? undefined
                  : { backgroundColor: `${level.color}20`, color: level.color }
              }
            >
              <div className="flex items-center gap-1.5">
                <span>{level.icon}</span>
                <span>
                  Lv.{level.level} {level.name}
                </span>
              </div>
              <span className="text-[8px] opacity-70">
                ⚡ {formatLevelRange(level.minTokens, level.maxTokens)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ITEMS_PER_PAGE = 50;

// Extended user type for UI
interface DisplayUser extends LeaderboardUser {
  rank: number;
  isCurrentUser?: boolean;
  periodTokens?: number;
  periodCost?: number;
}

export default function LeaderboardPage() {
  const { user: clerkUser } = useUser();
  const searchParams = useSearchParams();
  const highlightUsername = searchParams.get("u");
  const [selectedUser, setSelectedUser] = useState<DisplayUser | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isGlobePanelOpen, setIsGlobePanelOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("global");
  const [sortBy, setSortBy] = useState<SortByFilter>("tokens");
  const [showLevelInfo, setShowLevelInfo] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(
    null
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [panelWidth, setPanelWidth] = useState(0);
  const [, setIsOverlayMode] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightMyRank, setHighlightMyRank] = useState(false);
  const [highlightedUsername, setHighlightedUsername] = useState<string | null>(null);
  const [myRankInfo, setMyRankInfo] = useState<{ rank: number; page: number } | null>(null);
  const [pendingMyRankScroll, setPendingMyRankScroll] = useState(false);
  // Initialize with large value to ensure max-width is applied on first render
  const [viewportWidth, setViewportWidth] = useState(1920);

  // API state
  const [users, setUsers] = useState<DisplayUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentUserCountry, setCurrentUserCountry] = useState<string>("KR");
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [userInfoLoaded, setUserInfoLoaded] = useState(false);

  // Country stats state for Globe and Top Countries
  const [countryStats, setCountryStats] = useState<CountryStat[]>([]);
  const [totalGlobalTokens, setTotalGlobalTokens] = useState(0);
  const [totalGlobalCost, setTotalGlobalCost] = useState(0);

  // Handle country stats loaded from GlobeStatsSection
  const handleCountryStatsLoaded = useCallback(
    (stats: CountryStat[], tokens: number, cost: number) => {
      setCountryStats(stats);
      setTotalGlobalTokens(tokens);
      setTotalGlobalCost(cost);
    },
    []
  );

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(ITEMS_PER_PAGE));
      params.set("period", periodFilter);

      // Send user's timezone for accurate period filtering (handles DST)
      try {
        params.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
      } catch {
        params.set("tz", "UTC");
      }
      // Add custom date range parameters
      if (periodFilter === "custom" && customDateRange) {
        params.set("startDate", customDateRange.start);
        params.set("endDate", customDateRange.end);
      }

      if (scopeFilter === "country" && currentUserCountry) {
        params.set("country", currentUserCountry);
      }

      const response = await fetch(`/api/leaderboard?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch leaderboard");
      }

      const data = await response.json();

      // Transform API response to display format
      const transformedUsers: DisplayUser[] = (data.users || []).map(
        (user: LeaderboardUser, index: number) => {
          // All filters now use total_tokens sorting from API
          // Use pagination-based rank for consistent real-time ranking
          let rank: number;
          if (periodFilter !== "all") {
            // Period queries return period_rank from server-side calculation
            rank = user.period_rank || (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
          } else {
            // Global, Country, CCplan all use total_tokens sorting
            rank = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
          }

          return {
            ...user,
            rank,
            periodTokens: user.period_tokens ?? user.total_tokens,
            periodCost: user.period_cost ?? user.total_cost,
            isCurrentUser: currentUsername?.toLowerCase() === user.username?.toLowerCase(),
          };
        }
      );

      // Sort by selected metric if needed
      if (sortBy === "cost") {
        transformedUsers.sort((a, b) => (b.periodCost ?? 0) - (a.periodCost ?? 0));
        transformedUsers.forEach((u, i) => {
          u.rank = (currentPage - 1) * ITEMS_PER_PAGE + i + 1;
        });
      }

      setUsers(transformedUsers);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    periodFilter,
    scopeFilter,
    sortBy,
    currentUserCountry,
    currentUsername,
    customDateRange,
  ]);

  // Fetch current user's country and username
  useEffect(() => {
    async function fetchUserInfo() {
      if (!clerkUser?.id) return;
      try {
        const response = await fetch("/api/me");
        if (response.ok) {
          const data = await response.json();
          if (data.user?.country_code) {
            setCurrentUserCountry(data.user.country_code);
          }
          if (data.user?.username) {
            setCurrentUsername(data.user.username);
          }
          // Mark user info as loaded to trigger leaderboard refresh
          // This ensures social_links (auto-populated from OAuth) are fetched
          setUserInfoLoaded(true);
        }
      } catch {
        // Keep defaults
        setUserInfoLoaded(true);
      }
    }
    fetchUserInfo();
  }, [clerkUser?.id]);

  // Fetch current user's rank for "My Rank" button
  useEffect(() => {
    async function fetchMyRank() {
      if (!currentUsername) return;

      try {
        const params = new URLSearchParams();
        params.set("findUser", currentUsername);
        params.set("limit", String(ITEMS_PER_PAGE));
        if (scopeFilter === "country" && currentUserCountry) {
          params.set("country", currentUserCountry);
        }

        const response = await fetch(`/api/leaderboard?${params}`);
        const data = await response.json();

        if (data.found && data.user) {
          setMyRankInfo({ rank: data.user.rank, page: data.user.page });
        } else {
          setMyRankInfo(null);
        }
      } catch {
        setMyRankInfo(null);
      }
    }

    fetchMyRank();
  }, [currentUsername, scopeFilter, currentUserCountry]);

  // Fetch data on filter/page change
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Refetch leaderboard after user info is loaded (to get updated social_links from OAuth)
  useEffect(() => {
    if (userInfoLoaded) {
      fetchLeaderboard();
    }
  }, [userInfoLoaded, fetchLeaderboard]);

  // Update selectedUser when users array changes (to reflect updated social_links)
  useEffect(() => {
    if (selectedUser && users.length > 0) {
      const updatedUser = users.find((u) => u.id === selectedUser.id);
      if (
        updatedUser &&
        JSON.stringify(updatedUser.social_links) !== JSON.stringify(selectedUser.social_links)
      ) {
        setSelectedUser(updatedUser);
      }
    }
  }, [users, selectedUser]);

  // Panel width handling - 3-tier breakpoint system
  // Mobile: < 640px | Tablet: 640-1039px | PC: >= 1040px
  useEffect(() => {
    const updatePanelWidth = () => {
      const width = window.innerWidth;
      setViewportWidth(width);
      if (width >= 1040) {
        // PC: push 440px
        setPanelWidth(440);
        setIsOverlayMode(false);
      } else if (width >= 640) {
        // Tablet: push 320px (ensures 320px+ content area)
        setPanelWidth(320);
        setIsOverlayMode(false);
      } else {
        // Mobile: overlay mode (full screen panel)
        setPanelWidth(0);
        setIsOverlayMode(true);
      }
    };
    updatePanelWidth();
    window.addEventListener("resize", updatePanelWidth);
    return () => window.removeEventListener("resize", updatePanelWidth);
  }, []);

  // Set mounted state
  useEffect(() => {
    setIsMounted(true);
    setIsAnimating(true);
  }, []);

  // Handle ?u=username query parameter for highlighting
  useEffect(() => {
    if (!highlightUsername) return;

    // First, try to find user in current page
    const targetUser = users.find(
      (u) => u.username.toLowerCase() === highlightUsername.toLowerCase()
    );

    if (targetUser) {
      setHighlightedUsername(highlightUsername.toLowerCase());
      // Clear highlight after 5 seconds
      const timer = setTimeout(() => {
        setHighlightedUsername(null);
      }, 5000);
      return () => clearTimeout(timer);
    }

    // If not found on current page, search for user's page
    async function findUserPage() {
      if (!highlightUsername) return;

      try {
        const params = new URLSearchParams();
        params.set("findUser", highlightUsername);
        params.set("limit", String(ITEMS_PER_PAGE));
        if (scopeFilter === "country" && currentUserCountry) {
          params.set("country", currentUserCountry);
        }

        const response = await fetch(`/api/leaderboard?${params}`);
        const data = await response.json();

        if (data.found && data.user?.page) {
          // Navigate to the user's page
          setCurrentPage(data.user.page);
          setHighlightedUsername(highlightUsername.toLowerCase());
        }
      } catch {
        // User not found, ignore
      }
    }

    if (users.length > 0 && !targetUser) {
      findUserPage();
    }

    return undefined;
  }, [highlightUsername, users, scopeFilter, currentUserCountry]);

  // Pagination
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Find current user
  const currentUserData = useMemo(() => {
    return users.find((u) => u.isCurrentUser);
  }, [users]);

  // Go to my rank
  const goToMyRank = useCallback(() => {
    if (myRankInfo) {
      setCurrentPage(myRankInfo.page);
      setHighlightMyRank(true);
      setPendingMyRankScroll(true);
    } else if (currentUserData) {
      const myPage = Math.ceil(currentUserData.rank / ITEMS_PER_PAGE);
      setCurrentPage(myPage);
      setHighlightMyRank(true);
      setPendingMyRankScroll(true);
    }
  }, [myRankInfo, currentUserData]);

  // Scroll to current user and open panel when My Rank is clicked
  useEffect(() => {
    if (pendingMyRankScroll && !loading && users.length > 0) {
      const currentUser = users.find((u) => u.isCurrentUser);
      if (currentUser) {
        // Open the detail panel
        setSelectedUser(currentUser);
        setIsPanelOpen(true);

        // Scroll to the row
        setTimeout(() => {
          const row = document.querySelector(`[data-user-id="${currentUser.id}"]`);
          if (row) {
            row.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }
      setPendingMyRankScroll(false);
    }
  }, [pendingMyRankScroll, loading, users]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
    setHighlightMyRank(false);
  }, [scopeFilter, periodFilter, sortBy]);

  // Animation trigger
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 600);
    return () => clearTimeout(timer);
  }, [scopeFilter, periodFilter, sortBy, currentPage]);

  const handleRowClick = (user: DisplayUser) => {
    setSelectedUser(user);
    setIsPanelOpen(true);
    setHighlightMyRank(false);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setHighlightMyRank(false);
  };

  // Use 3:5 ratio only when: viewport < 1440px AND panel is open
  const useCompactRatio = isPanelOpen && viewportWidth < 1440;

  // Tablet: 768px <= width < 1040px → use 45:55 ratio
  const isTablet = viewportWidth >= 768 && viewportWidth < 1040;

  // Show level column: always on 860px+, or on narrow when panel is open (table expanded)
  const showLevelColumn = viewportWidth >= 860 || (viewportWidth >= 768 && isPanelOpen);

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Persistent Globe Particles - fades in when Globe slides out */}
      {viewportWidth >= 768 && (
        <div
          className="fixed top-32 left-4 pointer-events-none z-0 transition-opacity duration-500"
          style={{
            width: "320px",
            height: "320px",
            opacity: useCompactRatio ? 1 : 0,
          }}
        >
          <GlobeParticles size={320} />
        </div>
      )}
      <div className="transition-all duration-300 ease-out">
        <div
          className="px-4 py-8 transition-all duration-300 max-w-[1000px] mx-auto"
          style={{
            marginRight: isPanelOpen && panelWidth > 0 ? `${panelWidth}px` : undefined,
          }}
        >
          {/* Header */}
          <header className="mb-4 md:mb-8">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                {scopeFilter === "global" ? (
                  <>🌍 Global Leaderboard</>
                ) : (
                  <>
                    <ReactCountryFlag
                      countryCode={currentUserCountry}
                      svg
                      style={{ width: "20px", height: "20px" }}
                    />
                    Country Leaderboard
                  </>
                )}
              </h1>
              {/* Live timezone clock - tablet and desktop only (768px+) */}
              <TimezoneClock className="hidden md:inline-flex" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Top Claude Code developers ranked by{" "}
              {sortBy === "tokens" ? "token usage" : "spending"}
            </p>
          </header>

          {/* Mobile timezone clock - centered between title and filters (below 768px) */}
          <div className="flex md:hidden justify-center mb-4">
            <TimezoneClock />
          </div>

          {/* 2-Column Layout: Globe+Countries (left) + Users (right) */}
          {/* Wide viewport (>=1440): always 50%|50%+panel */}
          {/* Narrow viewport (<1440) + panel open: Globe slides out, table expands */}
          <div className="flex flex-col md:flex-row gap-4 overflow-hidden">
            {/* Left Column: Globe + Top Countries */}
            {/* Tablet (<1040px): 45% width, PC (>=1040px): 50% width */}
            {/* When panel opens on narrow viewport: slides out */}
            <div
              className={`hidden md:block transition-all duration-300 ${
                useCompactRatio ? "md:w-0 md:opacity-0 md:-translate-x-full md:overflow-hidden" : ""
              }`}
              style={{
                width: useCompactRatio ? undefined : isTablet ? "45%" : "50%",
              }}
            >
              <div className={`sticky top-24 ${isTablet ? "space-y-2" : "space-y-4"}`}>
                {/* Globe Section - Large, centered in left column */}
                <div className={`relative ${isTablet ? "p-2" : "p-4"}`}>
                  {/* Scope Filter - Top Right of Globe Area */}
                  <div className="absolute top-0 right-0 flex h-7 glass rounded-lg overflow-hidden z-10">
                    <button
                      onClick={() => setScopeFilter("global")}
                      className={`h-7 w-7 text-[10px] leading-none font-medium transition-colors flex items-center justify-center ${
                        scopeFilter === "global"
                          ? "bg-[var(--color-claude-coral)]/50 text-[var(--color-claude-coral)]"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                      }`}
                    >
                      🌍
                    </button>
                    <button
                      onClick={() => setScopeFilter("country")}
                      className={`h-7 w-7 text-[10px] leading-none font-medium transition-colors flex items-center justify-center ${
                        scopeFilter === "country"
                          ? "bg-emerald-500/50 text-emerald-400"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                      }`}
                    >
                      {currentUserCountry && (
                        <ReactCountryFlag
                          countryCode={currentUserCountry}
                          svg
                          style={{ width: "12px", height: "12px" }}
                          className="flex-shrink-0"
                        />
                      )}
                    </button>
                  </div>

                  <GlobeStatsSection
                    userCountryCode={currentUserCountry}
                    onStatsLoaded={handleCountryStatsLoaded}
                    size="large"
                    scopeFilter={scopeFilter}
                    sortBy={sortBy}
                    compact={isTablet}
                  />
                </div>

                {/* Top Countries - Scrollable */}
                {countryStats.length > 0 && (
                  <div
                    className={`glass rounded-2xl border border-[var(--border-default)] max-h-[400px] overflow-y-auto ${isTablet ? "p-3" : "p-4"}`}
                  >
                    <TopCountriesSection
                      stats={countryStats}
                      totalTokens={totalGlobalTokens}
                      totalCost={totalGlobalCost}
                      sortBy={sortBy}
                      userCountryCode={currentUserCountry}
                      maxItems={15}
                      compact={viewportWidth < 860}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: User Table */}
            {/* Mobile (<768px): 100% width */}
            {/* Tablet (768-1039px): 55% width, PC (>=1040px): 50% width */}
            {/* When panel opens on narrow viewport: expands to full width */}
            <div
              className="w-full md:w-auto transition-all duration-300"
              style={{
                width:
                  viewportWidth < 768
                    ? "100%"
                    : useCompactRatio
                      ? "100%"
                      : isTablet
                        ? "55%"
                        : "50%",
              }}
            >
              {/* Filters - Above Table */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Mini Globe Button - Mobile or when Globe is hidden */}
                  <button
                    onClick={() => setIsGlobePanelOpen(true)}
                    className={`rounded-lg glass text-[10px] leading-none font-medium transition-colors items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 flex-shrink-0 ${
                      useCompactRatio ? "flex" : "flex md:hidden"
                    }`}
                    style={{ width: 28, height: 28 }}
                    title="View Global Stats"
                  >
                    🌐
                  </button>

                  {/* Scope Filter - Mobile or when Globe is hidden */}
                  <div
                    className={`glass rounded-lg overflow-hidden flex-shrink-0 ${
                      useCompactRatio ? "flex" : "flex md:hidden"
                    }`}
                    style={{ height: 28 }}
                  >
                    <button
                      onClick={() => setScopeFilter("global")}
                      className={`text-[10px] leading-none font-medium transition-colors flex items-center justify-center ${
                        scopeFilter === "global"
                          ? "bg-[var(--color-claude-coral)]/50 text-[var(--color-claude-coral)]"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                      }`}
                      style={{ width: 28, height: 28 }}
                    >
                      🌍
                    </button>
                    <button
                      onClick={() => setScopeFilter("country")}
                      className={`text-[10px] leading-none font-medium transition-colors flex items-center justify-center ${
                        scopeFilter === "country"
                          ? "bg-emerald-500/50 text-emerald-400"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                      }`}
                      style={{ width: 28, height: 28 }}
                    >
                      <ReactCountryFlag
                        countryCode={currentUserCountry}
                        svg
                        style={{ width: "12px", height: "12px" }}
                        className="flex-shrink-0"
                      />
                    </button>
                  </div>

                  {/* Period Filter - Desktop: buttons, Tablet/Mobile: dropdown */}
                  <div className="hidden lg:flex items-center h-7 glass rounded-lg overflow-hidden">
                    {[
                      { value: "all", label: "All D" },
                      { value: "today", label: "1D" },
                      { value: "7d", label: "7D" },
                      { value: "30d", label: "30D" },
                    ].map((period) => (
                      <button
                        key={period.value}
                        onClick={() => {
                          setPeriodFilter(period.value as PeriodFilter);
                          if (period.value !== "custom") {
                            setCustomDateRange(null);
                          }
                        }}
                        className={`h-7 px-2 text-xs font-medium transition-colors ${
                          periodFilter === period.value
                            ? "bg-[var(--color-claude-coral)]/50 text-[var(--color-claude-coral)]"
                            : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                        }`}
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>
                  {/* Custom Date Range Button - Desktop */}
                  <div className="hidden lg:block">
                    <DateRangeButton
                      onClick={() => setShowDatePicker(true)}
                      isActive={periodFilter === "custom"}
                      dateLabel={
                        customDateRange
                          ? `${format(new Date(customDateRange.start), "MM.dd")}~${format(new Date(customDateRange.end), "MM.dd")}`
                          : undefined
                      }
                    />
                  </div>
                  {/* Tablet/Mobile: Dropdown + Calendar */}
                  <div className="flex items-center gap-1 lg:hidden">
                    <PeriodDropdown
                      value={periodFilter}
                      onChange={(value) => {
                        if (value === "custom") {
                          setShowDatePicker(true);
                        } else {
                          setPeriodFilter(value as PeriodFilter);
                          setCustomDateRange(null);
                        }
                      }}
                      options={[
                        { value: "all", label: "All D" },
                        { value: "today", label: "1D" },
                        { value: "7d", label: "7D" },
                        { value: "30d", label: "30D" },
                      ]}
                      customLabel={
                        customDateRange
                          ? `${format(new Date(customDateRange.start), "MM.dd")}~${format(new Date(customDateRange.end), "MM.dd")}`
                          : undefined
                      }
                    />
                    {/* Calendar button for mobile */}
                    <DateRangeButton
                      onClick={() => setShowDatePicker(true)}
                      isActive={periodFilter === "custom"}
                    />
                  </div>
                </div>

                {/* Right side - My Rank, Level Info & Sort */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {(myRankInfo || currentUserData) && (
                    <button
                      onClick={goToMyRank}
                      className="flex items-center h-7 gap-0.5 px-1.5 glass hover:bg-white/15 rounded-lg text-[10px] leading-none font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors flex-shrink-0"
                    >
                      <span>📍</span>
                      <span className="hidden sm:inline">My</span>
                      <span className="text-[var(--color-claude-coral)] font-semibold">
                        #{myRankInfo?.rank || currentUserData?.rank}
                      </span>
                    </button>
                  )}

                  {/* Level Info Hover */}
                  <div
                    className="relative"
                    onMouseEnter={() => setShowLevelInfo(true)}
                    onMouseLeave={() => setShowLevelInfo(false)}
                  >
                    <div className="h-7 w-7 rounded-md text-[10px] font-medium transition-colors flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-help">
                      <Info className="w-3 h-3" />
                    </div>
                    <LevelInfoPopover isOpen={showLevelInfo} />
                  </div>

                  <div className="flex items-center h-7 glass rounded-lg overflow-hidden flex-shrink-0">
                    <button
                      onClick={() => setSortBy("cost")}
                      title="Sort by Cost"
                      className={`h-7 w-7 text-[10px] leading-none font-medium transition-colors flex items-center justify-center ${
                        sortBy === "cost"
                          ? "bg-[var(--color-cost)]/50 text-[var(--color-cost)]"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                      }`}
                    >
                      💰
                    </button>
                    <button
                      onClick={() => setSortBy("tokens")}
                      title="Sort by Tokens"
                      className={`h-7 w-7 text-[10px] leading-none font-medium transition-colors flex items-center justify-center ${
                        sortBy === "tokens"
                          ? "bg-[var(--color-claude-coral)]/50 text-[var(--color-claude-coral)]"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                      }`}
                    >
                      ⚡
                    </button>
                  </div>
                </div>
              </div>

              {/* Loading State - Only show on initial load (no data yet) */}
              {loading && users.length === 0 && (
                <div className="flex items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-[var(--color-text-muted)]">Loading leaderboard...</p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <div className="flex items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="text-4xl">⚠️</span>
                    <p className="text-sm text-[var(--color-text-muted)]">{error}</p>
                    <button
                      onClick={fetchLeaderboard}
                      className="px-4 py-2 text-sm bg-[var(--color-claude-coral)] text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!loading && !error && users.length === 0 && (
                <div className="flex items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="text-4xl">📭</span>
                    <p className="text-sm text-[var(--color-text-muted)]">No users found</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Be the first to join the leaderboard!
                    </p>
                  </div>
                </div>
              )}

              {/* Leaderboard Table - Keep showing while loading new data */}
              {users.length > 0 && (
                <div
                  key={`${scopeFilter}-${periodFilter}-${sortBy}-${currentPage}`}
                  className={`transition-opacity duration-200 ease-out ${loading ? "opacity-50" : "opacity-100"}`}
                >
                  <div className="glass rounded-2xl overflow-visible border border-[var(--border-default)]">
                    <div className="overflow-x-auto rounded-2xl">
                      <table className="w-full table-fixed">
                        <colgroup>
                          <col className="w-[36px] md:w-[44px]" />
                          <col className="w-[36px] md:w-[44px]" />
                          <col />
                          <col style={{ width: showLevelColumn ? 70 : 0 }} />
                          <col className="w-[60px] md:w-[70px]" />
                          <col className="w-[60px] md:w-[70px]" />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-[var(--border-default)]">
                            <th
                              className="text-center align-middle text-text-secondary font-medium text-xs py-2.5 px-0.5 md:px-1"
                              title="Rank"
                            >
                              🏆
                            </th>
                            <th
                              className="text-center align-middle text-text-secondary font-medium text-xs py-2.5 px-0.5 md:px-1"
                              title="Country"
                            >
                              🌍
                            </th>
                            <th
                              className="align-middle text-text-secondary font-medium text-xs py-2.5 px-1 md:px-2"
                              title="User"
                            >
                              <div className="flex items-center">
                                <div className="w-6 lg:w-8 flex justify-center">👤</div>
                              </div>
                            </th>
                            <th
                              className="text-center align-middle text-text-secondary font-medium text-xs py-2.5"
                              style={{
                                width: showLevelColumn ? 70 : 0,
                                padding: showLevelColumn ? undefined : 0,
                                visibility: showLevelColumn ? "visible" : "hidden",
                              }}
                              title="Level"
                            >
                              ⭐
                            </th>
                            {/* Cost column */}
                            <th
                              className="text-right align-middle text-text-secondary font-medium text-xs py-2.5 px-0.5 md:px-1"
                              title="Cost"
                            >
                              💰
                            </th>
                            {/* Tokens column */}
                            <th
                              className="text-right align-middle text-text-secondary font-medium text-xs py-2.5 pl-0.5 pr-2 md:pr-4"
                              title="Tokens"
                            >
                              ⚡
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user, index) => {
                            const isFirst = user.rank === 1;
                            const isTopThree = user.rank <= 3;
                            const rowPadding = isFirst
                              ? "py-2 lg:py-3"
                              : isTopThree
                                ? "py-2 lg:py-2.5"
                                : "py-2";
                            const avatarSize = "w-6 h-6";
                            const avatarText = "text-xs";
                            const nameSize = "text-xs";
                            const rankSize = "text-xs";
                            const flagSize = 16;
                            const valueSize = "text-xs";

                            const periodTokens = user.period_tokens ?? user.total_tokens;
                            const periodCost = user.period_cost ?? user.total_cost;

                            return (
                              <tr
                                key={`${scopeFilter}-${periodFilter}-${sortBy}-${user.id}`}
                                data-user-id={user.id}
                                onClick={() => handleRowClick(user)}
                                className={`border-b border-[var(--border-default)] transition-all cursor-pointer hover:!bg-[var(--color-table-row-hover)] ${
                                  user.isCurrentUser ? "bg-primary/5" : ""
                                } ${selectedUser?.id === user.id && isPanelOpen ? "!bg-[var(--color-table-row-hover)]" : ""} ${
                                  user.isCurrentUser && highlightMyRank
                                    ? "!bg-[var(--color-claude-coral)]/50 ring-2 ring-[var(--color-claude-coral)]"
                                    : ""
                                } ${
                                  highlightedUsername &&
                                  user.username.toLowerCase() === highlightedUsername
                                    ? "!bg-[var(--color-claude-coral)]/50 ring-2 ring-[var(--color-claude-coral)] animate-pulse"
                                    : ""
                                }`}
                                style={{
                                  backgroundColor:
                                    !user.isCurrentUser &&
                                    !(selectedUser?.id === user.id && isPanelOpen) &&
                                    !highlightMyRank &&
                                    !(
                                      highlightedUsername &&
                                      user.username.toLowerCase() === highlightedUsername
                                    ) &&
                                    index % 2 === 1
                                      ? "var(--color-table-row-even)"
                                      : undefined,
                                  animation:
                                    isMounted && isAnimating
                                      ? `fadeSlideIn 0.2s ease-out ${Math.pow(index, 0.35) * 0.225}s both`
                                      : "none",
                                }}
                              >
                                <td
                                  className={`${rowPadding} px-1 md:px-2 text-center align-middle`}
                                >
                                  <span
                                    className={`text-text-primary font-mono ${rankSize} leading-none`}
                                  >
                                    {user.rank <= 3
                                      ? ["🥇", "🥈", "🥉"][user.rank - 1]
                                      : `#${user.rank}`}
                                  </span>
                                </td>
                                <td className={`${rowPadding} px-1 text-center align-middle`}>
                                  {user.country_code && (
                                    <span className="inline-block translate-y-[3px]">
                                      <CountryFlag
                                        countryCode={user.country_code}
                                        size={flagSize}
                                      />
                                    </span>
                                  )}
                                </td>
                                <td className={`${rowPadding} px-1 md:px-2`}>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-6 lg:w-8 flex items-center justify-center flex-shrink-0">
                                      {user.avatar_url ? (
                                        <Image
                                          src={user.avatar_url}
                                          alt={user.username}
                                          width={32}
                                          height={32}
                                          className={`${avatarSize} rounded-full object-cover`}
                                        />
                                      ) : (
                                        <div
                                          className={`${avatarSize} rounded-full bg-gradient-to-br from-primary to-[#F7931E] flex items-center justify-center text-white ${avatarText} font-semibold`}
                                        >
                                          {user.username.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                    <span
                                      className={`${nameSize} font-medium text-text-primary truncate`}
                                    >
                                      {user.display_name || user.username}
                                    </span>
                                  </div>
                                </td>
                                <td
                                  className={`${rowPadding} text-center`}
                                  style={{
                                    width: showLevelColumn ? 70 : 0,
                                    padding: showLevelColumn ? undefined : 0,
                                    visibility: showLevelColumn ? "visible" : "hidden",
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <LevelBadge tokens={user.total_tokens} />
                                </td>
                                {/* Cost cell */}
                                <td className={`${rowPadding} px-0.5 md:px-1 text-right`}>
                                  <span
                                    className={`font-mono ${valueSize} ${
                                      sortBy === "tokens"
                                        ? "text-[var(--color-text-muted)]"
                                        : "text-[var(--color-cost)]"
                                    }`}
                                  >
                                    $
                                    {periodCost >= 1_000_000
                                      ? `${(periodCost / 1_000_000).toFixed(1)}M`
                                      : periodCost >= 1_000
                                        ? `${(periodCost / 1_000).toFixed(1)}K`
                                        : periodCost.toFixed(0)}
                                  </span>
                                </td>
                                {/* Tokens cell */}
                                <td className={`${rowPadding} pl-0.5 pr-2 md:pr-3 text-right`}>
                                  <span
                                    className={`font-mono ${valueSize} ${
                                      sortBy === "cost"
                                        ? "text-[var(--color-text-muted)]"
                                        : "text-[var(--color-claude-coral)]"
                                    }`}
                                  >
                                    {formatTokens(periodTokens)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center mt-8 gap-2">
                      <button
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="w-10 h-10 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ‹
                      </button>

                      {(() => {
                        const pages: (number | string)[] = [];
                        const showEllipsisStart = currentPage > 3;
                        const showEllipsisEnd = currentPage < totalPages - 2;

                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          pages.push(1);
                          if (showEllipsisStart) pages.push("...");
                          const start = Math.max(2, currentPage - 1);
                          const end = Math.min(totalPages - 1, currentPage + 1);
                          for (let i = start; i <= end; i++) pages.push(i);
                          if (showEllipsisEnd) pages.push("...");
                          pages.push(totalPages);
                        }

                        return pages.map((page, i) => (
                          <button
                            key={i}
                            onClick={() => typeof page === "number" && handlePageChange(page)}
                            disabled={page === "..."}
                            className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                              page === currentPage
                                ? "bg-[var(--color-claude-coral)] text-white"
                                : page === "..."
                                  ? "text-text-muted cursor-default"
                                  : "text-text-secondary hover:text-text-primary hover:bg-white/10"
                            }`}
                          >
                            {page}
                          </button>
                        ));
                      })()}

                      <button
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="w-10 h-10 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ›
                      </button>

                      <span className="ml-4 text-xs text-text-muted">{total} users</span>
                    </div>
                  )}

                  {/* Onboarding Copy */}
                  <p className="text-center text-[11px] text-[var(--color-text-muted)]/60 mt-6">
                    Sync your Claude Code usage to climb the leaderboard →{" "}
                    <a
                      href="https://github.com/anthropics/claude-code"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-[var(--color-text-muted)]"
                    >
                      Get Started
                    </a>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Top Countries Section moved to MobileGlobePanel for mobile */}
        </div>
      </div>

      {/* Profile Side Panel */}
      <ProfileSidePanel
        user={selectedUser}
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
        periodFilter={periodFilter}
        scopeFilter={scopeFilter}
      />

      {/* Mobile Globe Panel - Left Slide */}
      <MobileGlobePanel
        isOpen={isGlobePanelOpen}
        onClose={() => setIsGlobePanelOpen(false)}
        countryStats={countryStats}
        totalTokens={totalGlobalTokens}
        totalCost={totalGlobalCost}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        userCountryCode={currentUserCountry}
        scopeFilter={scopeFilter}
      />

      {/* Date Range Picker Modal */}
      <DateRangePicker
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onApply={(startDate, endDate) => {
          setCustomDateRange({ start: startDate, end: endDate });
          setPeriodFilter("custom");
        }}
        initialRange={customDateRange}
      />
    </div>
  );
}
