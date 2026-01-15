"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import ReactCountryFlag from "react-country-flag";
import { useUser } from "@clerk/nextjs";
import { ProfileSidePanel } from "@/components/leaderboard/ProfileSidePanel";
import { CCplanTabs } from "@/components/leaderboard/CCplanTabs";
import { LiveStatsTicker } from "@/components/stats/LiveStatsTicker";
import { LEVELS, getLevelByTokens } from "@/lib/constants/levels";
import type {
  LeaderboardUser,
  PeriodFilter,
  ScopeFilter,
  SortByFilter,
  CCPlanFilter,
} from "@/lib/types";

// Format numbers properly
function formatTokens(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
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
  const [isHovered, setIsHovered] = useState(false);
  const currentLevel = getLevelByTokens(tokens);
  const useCssClass = currentLevel.level === 5 || currentLevel.level === 6;

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-default ${
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
      {isHovered && (
        <div className="absolute left-0 bottom-full mb-1 z-50 w-56 p-2 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-xl">
          <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
            Level System
          </div>
          <div className="space-y-0.5">
            {LEVELS.map((level) => {
              const isCurrentLevel = level.level === currentLevel.level;
              const levelUseCssClass = level.level === 5 || level.level === 6;
              return (
                <div
                  key={level.level}
                  className={`flex items-center justify-between px-1.5 py-1 rounded text-[10px] ${
                    isCurrentLevel ? "font-medium" : ""
                  } ${isCurrentLevel && levelUseCssClass ? `level-badge-${level.level}` : ""}`}
                  style={
                    isCurrentLevel
                      ? levelUseCssClass
                        ? undefined
                        : { backgroundColor: `${level.color}20`, color: level.color }
                      : { color: "#9CA3AF" }
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <span>{level.icon}</span>
                    <span>
                      Lv.{level.level} {level.name}
                    </span>
                  </div>
                  <span className="text-[8px] opacity-70">
                    {formatLevelRange(level.minTokens, level.maxTokens)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const ITEMS_PER_PAGE = 20;

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
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("global");
  const [sortBy, setSortBy] = useState<SortByFilter>("tokens");
  const [ccplanFilter, setCcplanFilter] = useState<CCPlanFilter>("all");
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [panelWidth, setPanelWidth] = useState(0);
  const [, setIsOverlayMode] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightMyRank, setHighlightMyRank] = useState(false);
  const [highlightedUsername, setHighlightedUsername] = useState<string | null>(null);
  const [myRankInfo, setMyRankInfo] = useState<{ rank: number; page: number } | null>(null);
  const [pendingMyRankScroll, setPendingMyRankScroll] = useState(false);

  // API state
  const [users, setUsers] = useState<DisplayUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentUserCountry, setCurrentUserCountry] = useState<string>("KR");
  const [userInfoLoaded, setUserInfoLoaded] = useState(false);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(ITEMS_PER_PAGE));
      params.set("period", periodFilter);

      if (scopeFilter === "country" && currentUserCountry) {
        params.set("country", currentUserCountry);
      }

      if (ccplanFilter !== "all") {
        params.set("ccplan", ccplanFilter);
      }

      const response = await fetch(`/api/leaderboard?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch leaderboard");
      }

      const data = await response.json();

      // Transform API response to display format
      const transformedUsers: DisplayUser[] = (data.users || []).map(
        (user: LeaderboardUser, index: number) => {
          // For period queries, use period_rank; for ccplan filter, use ccplan_rank; otherwise use global/country rank
          let rank: number;
          if (periodFilter !== "all") {
            rank = user.period_rank || (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
          } else if (ccplanFilter !== "all") {
            rank = user.ccplan_rank || (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
          } else if (scopeFilter === "country") {
            rank = user.country_rank || (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
          } else {
            rank = user.global_rank || (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
          }

          return {
            ...user,
            rank,
            periodTokens: user.period_tokens ?? user.total_tokens,
            periodCost: user.period_cost ?? user.total_cost,
            isCurrentUser: clerkUser?.id === user.id,
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
    ccplanFilter,
    currentUserCountry,
    clerkUser?.id,
  ]);

  // Fetch current user's country and username
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
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
        if (ccplanFilter !== "all") {
          params.set("ccplan", ccplanFilter);
        }
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
  }, [currentUsername, ccplanFilter, scopeFilter, currentUserCountry]);

  // Fetch data on filter/page change
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Refetch leaderboard after user info is loaded (to get updated social_links from OAuth)
  useEffect(() => {
    if (userInfoLoaded) {
      fetchLeaderboard();
    }
  }, [userInfoLoaded]);

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
        if (ccplanFilter !== "all") {
          params.set("ccplan", ccplanFilter);
        }
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
  }, [highlightUsername, users, ccplanFilter, scopeFilter, currentUserCountry]);

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
  }, [scopeFilter, periodFilter, sortBy, ccplanFilter]);

  // Animation trigger
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 600);
    return () => clearTimeout(timer);
  }, [scopeFilter, periodFilter, sortBy, ccplanFilter, currentPage]);

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

  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="transition-all duration-300 ease-out">
        <div
          className="max-w-[1000px] px-4 py-8 transition-all duration-300"
          style={{
            marginLeft: "max(calc((100vw - 1000px) / 2), 16px)",
            marginRight: isPanelOpen && panelWidth > 0 ? `${panelWidth}px` : "auto",
          }}
        >
          {/* Header */}
          <div className="mb-6">
            {/* Top row: Rankings label + Stats ticker */}
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-[var(--color-claude-coral)] font-medium tracking-wide uppercase pt-1">
                Rankings
              </p>
              {/* Live Stats Ticker - always top-right */}
              <LiveStatsTicker
                variant="compact"
                className="px-3 py-2 rounded-lg bg-[var(--color-filter-bg)] border border-[var(--border-default)] min-w-[120px]"
                userCountryCode={currentUserCountry}
              />
            </div>
            {/* Title and description */}
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
                {scopeFilter === "global" ? (
                  "Global"
                ) : (
                  <>
                    <ReactCountryFlag
                      countryCode={currentUserCountry}
                      svg
                      style={{ width: "24px", height: "24px" }}
                    />
                    Country
                  </>
                )}{" "}
                Leaderboard
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                Top Claude Code developers ranked by{" "}
                {sortBy === "tokens" ? "token usage" : "spending"}
              </p>
            </div>
          </div>

          {/* CCplan League Tabs */}
          <div className="mb-4">
            <CCplanTabs value={ccplanFilter} onChange={setCcplanFilter} />
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 md:gap-3 mb-6">
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
              {/* Scope Filter */}
              <div className="flex p-0.5 sm:p-1 bg-[var(--color-filter-bg)] border border-[var(--border-default)] rounded-lg gap-0.5 sm:gap-1 flex-shrink-0">
                <button
                  onClick={() => setScopeFilter("global")}
                  className={`min-w-[32px] px-2 sm:px-2.5 py-1.5 rounded-md text-sm md:text-xs font-medium transition-colors flex items-center justify-center ${
                    scopeFilter === "global"
                      ? "bg-[var(--color-claude-coral)] text-white"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                  }`}
                >
                  🌍
                </button>
                <button
                  onClick={() => setScopeFilter("country")}
                  className={`min-w-[32px] px-2 sm:px-2.5 py-1.5 rounded-md text-sm md:text-xs font-medium transition-colors flex items-center justify-center ${
                    scopeFilter === "country"
                      ? "bg-[var(--color-claude-coral)] text-white"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                  }`}
                >
                  <ReactCountryFlag
                    countryCode={currentUserCountry}
                    svg
                    style={{ width: "16px", height: "16px" }}
                    className="flex-shrink-0"
                  />
                </button>
              </div>

              {/* Divider - hidden on smallest screens */}
              <div className="hidden sm:block h-6 w-px bg-[var(--border-default)]" />

              {/* Period Filter - Desktop/Tablet: buttons, Mobile: dropdown */}
              {/* Desktop & Tablet: Button Group */}
              <div className="hidden sm:flex p-0.5 sm:p-1 bg-[var(--color-filter-bg)] border border-[var(--border-default)] rounded-lg gap-0.5 sm:gap-1">
                {[
                  { value: "all", label: "∞", labelFull: "All Time" },
                  { value: "today", label: "1D", labelFull: "Today" },
                  { value: "7d", label: "7D" },
                  { value: "30d", label: "30D" },
                ].map((period) => (
                  <button
                    key={period.value}
                    onClick={() => setPeriodFilter(period.value as PeriodFilter)}
                    className={`px-2 lg:px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      periodFilter === period.value
                        ? "bg-[var(--color-filter-active)] text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                    }`}
                  >
                    {/* Tablet: icon only, PC: full text */}
                    <span className="lg:hidden">{period.label}</span>
                    <span className="hidden lg:inline">{period.labelFull || period.label}</span>
                  </button>
                ))}
              </div>
              {/* Mobile: Dropdown */}
              <div className="relative sm:hidden">
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
                  className="appearance-none px-3 py-1.5 pr-7 bg-[var(--color-filter-bg)] border border-[var(--border-default)] rounded-lg text-xs font-medium text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-claude-coral)]"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="7d">7D</option>
                  <option value="30d">30D</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)] text-[10px]">
                  ▼
                </span>
              </div>
            </div>

            {/* Right side - My Rank & Sort */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {(myRankInfo || currentUserData) && (
                <button
                  onClick={goToMyRank}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 lg:px-3 py-1.5 bg-[var(--color-filter-bg)] border border-[var(--border-default)] hover:bg-[var(--color-filter-hover)] rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors flex-shrink-0"
                >
                  <span>📍</span>
                  <span className="hidden lg:inline">My Rank</span>
                  <span className="text-[var(--color-claude-coral)] font-semibold">
                    #{myRankInfo?.rank || currentUserData?.rank}
                  </span>
                </button>
              )}

              <div className="flex p-0.5 sm:p-1 bg-[var(--color-filter-bg)] border border-[var(--border-default)] rounded-lg gap-0.5 sm:gap-1 flex-shrink-0">
                <button
                  onClick={() => setSortBy("cost")}
                  className={`min-w-[32px] px-2 sm:px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center ${
                    sortBy === "cost"
                      ? "bg-[var(--color-cost)] text-white"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                  }`}
                >
                  💵
                </button>
                <button
                  onClick={() => setSortBy("tokens")}
                  className={`min-w-[32px] px-2 sm:px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center ${
                    sortBy === "tokens"
                      ? "bg-[var(--color-claude-coral)] text-white"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                  }`}
                >
                  🪙
                </button>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
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

          {/* Leaderboard Table */}
          {!loading && !error && users.length > 0 && (
            <>
              <div className="glass rounded-2xl overflow-visible border border-[var(--border-default)]">
                <div className="overflow-x-auto rounded-2xl">
                  <table className="w-full table-fixed">
                    <colgroup>
                      <col className="w-[40px] md:w-[60px]" />
                      <col className="w-[28px] md:w-[44px]" />
                      <col />
                      <col className="hidden md:table-column w-[70px]" />
                      <col className="w-[50px] md:w-[90px]" />
                      <col className="w-[52px] md:w-[70px]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-[var(--border-default)]">
                        <th className="text-center text-text-secondary font-medium text-xs py-2.5 px-0.5 md:px-1">
                          Rank
                        </th>
                        <th className="text-center text-text-secondary font-medium text-xs py-2.5 px-0.5 md:px-1">
                          C
                        </th>
                        <th className="text-left text-text-secondary font-medium text-xs py-2.5 px-1">
                          User
                        </th>
                        <th className="hidden md:table-cell text-center text-text-secondary font-medium text-xs py-2.5 px-1">
                          Level
                        </th>
                        <th className="text-center text-text-secondary font-medium text-xs py-2.5 px-0.5 md:px-1">
                          <span className="md:hidden">$</span>
                          <span className="hidden md:inline">Cost</span>
                        </th>
                        <th className="text-right text-text-secondary font-medium text-xs py-2.5 pl-0.5 pr-2 md:pr-4">
                          <span className="md:hidden">🪙</span>
                          <span className="hidden md:inline">Tokens</span>
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
                        const avatarSize = isFirst
                          ? "w-6 h-6 lg:w-8 lg:h-8"
                          : isTopThree
                            ? "w-6 h-6 lg:w-7 lg:h-7"
                            : "w-6 h-6";
                        const avatarText = isFirst ? "text-xs lg:text-sm" : "text-xs";
                        const nameSize = isFirst ? "text-xs lg:text-sm" : "text-xs";
                        const rankSize = isFirst
                          ? "text-base lg:text-lg"
                          : isTopThree
                            ? "text-base"
                            : "text-xs";
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
                                ? "!bg-[var(--color-claude-coral)]/20 ring-2 ring-[var(--color-claude-coral)]"
                                : ""
                            } ${
                              highlightedUsername &&
                              user.username.toLowerCase() === highlightedUsername
                                ? "!bg-[var(--color-claude-coral)]/20 ring-2 ring-[var(--color-claude-coral)] animate-pulse"
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
                            <td className={`${rowPadding} px-1 md:px-2 text-center align-middle`}>
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
                                  <CountryFlag countryCode={user.country_code} size={flagSize} />
                                </span>
                              )}
                            </td>
                            <td className={`${rowPadding} px-1 md:px-2`}>
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 lg:w-8 flex items-center justify-center flex-shrink-0">
                                  {user.avatar_url ? (
                                    <img
                                      src={user.avatar_url}
                                      alt={user.username}
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
                              className={`hidden md:table-cell ${rowPadding} px-1 text-center`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <LevelBadge tokens={user.total_tokens} />
                            </td>
                            <td className={`${rowPadding} px-0.5 md:px-2 text-center`}>
                              <span className={`text-[var(--color-cost)] font-mono ${valueSize}`}>
                                <span className="md:hidden">
                                  ${(periodCost / 1000).toFixed(0)}k
                                </span>
                                <span className="hidden md:inline">
                                  $
                                  {periodCost.toLocaleString(undefined, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  })}
                                </span>
                              </span>
                            </td>
                            <td className={`${rowPadding} pl-0.5 pr-2 md:pr-4 text-right`}>
                              <span
                                className={`text-[var(--color-claude-coral)] font-mono ${valueSize}`}
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
            </>
          )}
        </div>
      </div>

      {/* Profile Side Panel */}
      <ProfileSidePanel
        user={selectedUser}
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
        periodFilter={periodFilter}
        scopeFilter={scopeFilter}
        ccplanFilter={ccplanFilter}
      />
    </div>
  );
}
