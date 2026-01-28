"use client";

import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { TableVirtuoso } from "react-virtuoso";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { useUser } from "@clerk/nextjs";
import { GlobeStatsSection } from "@/components/leaderboard/GlobeStatsSection";
import {
  TopCountriesSection,
  CountryStat,
  TopCountriesSectionRef,
} from "@/components/leaderboard/TopCountriesSection";
import { getCountryName } from "@/lib/constants/countries";

// Dynamic import for GlobeParticles (stars effect)
const GlobeParticles = dynamic(
  () => import("@/components/ui/globe-particles").then((mod) => mod.GlobeParticles),
  { ssr: false, loading: () => null }
);
import { DateRangeButton } from "@/components/leaderboard/DateRangePicker";
import { PeriodDropdown } from "@/components/leaderboard/PeriodDropdown";
import { TimezoneClock } from "@/components/ui/timezone-clock";
import { LEVELS, getLevelByTokens } from "@/lib/constants/levels";
import { Info, ChevronDown } from "lucide-react";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { format } from "date-fns";
import type { LeaderboardUser, PeriodFilter, ScopeFilter, SortByFilter } from "@/lib/types";
import type { FeedPost } from "@/components/community/FeedCard";
import type { HallOfFameEntry } from "@/components/community/HallOfFame";

// View mode type for tab switching
type ViewMode = "leaderboard" | "community";

// Community tab types - extensible for future tabs
type CommunityTab = "vibes" | "canu" | "showcase" | "questions"; // Add more as needed

// Tab configuration for easy extension
const COMMUNITY_TABS: {
  id: CommunityTab;
  label: string;
  emoji: string;
}[] = [
  {
    id: "vibes",
    label: "Vibes",
    emoji: "✨",
  },
  {
    id: "canu",
    label: "Can U?",
    emoji: "🎯",
  },
  // Future tabs can be added here:
  // { id: "showcase", label: "Showcase", emoji: "✨", activeColor: "#FBBF24", activeBg: "#FBBF24" },
  // { id: "questions", label: "Q&A", emoji: "💬", activeColor: "#10b981", activeBg: "#10b981" },
];

// Dynamic imports for heavy components - reduces initial bundle significantly
const ProfileSidePanel = dynamic(
  () => import("@/components/leaderboard/ProfileSidePanel").then((mod) => mod.ProfileSidePanel),
  { ssr: false }
);

// Community components (lazy loaded for tab switching)
const CommunityFeedSection = dynamic(() => import("@/components/community/CommunityFeedSection"), {
  ssr: false,
});

const HallOfFame = dynamic(() => import("@/components/community/HallOfFame"), { ssr: false });

const MobileGlobePanel = dynamic(
  () => import("@/components/leaderboard/MobileGlobePanel").then((mod) => mod.MobileGlobePanel),
  { ssr: false }
);

const DateRangePicker = dynamic(
  () => import("@/components/leaderboard/DateRangePicker").then((mod) => mod.DateRangePicker),
  { ssr: false }
);

const LoginPromptModal = dynamic(
  () => import("@/components/leaderboard/LoginPromptModal").then((mod) => mod.LoginPromptModal),
  { ssr: false }
);

const CLIModal = dynamic(() => import("@/components/cli/CLIModal").then((mod) => mod.CLIModal), {
  ssr: false,
});

// Format numbers - compact display (K/M/B for 1000+, plain for <1000)
function formatTokens(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

// Country Flag with Popover - Memoized to prevent unnecessary re-renders
const CountryFlag = React.memo(function CountryFlag({
  countryCode,
  size = 16,
}: {
  countryCode: string;
  size?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  // Map pixel size to FlagIcon size
  const flagSize = size <= 16 ? "xs" : size <= 20 ? "sm" : "md";

  return (
    <div
      className="relative inline-block leading-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <FlagIcon countryCode={countryCode} size={flagSize} />
      {isHovered && (
        <div className="absolute right-full mr-1.5 top-1/2 -translate-y-1/2 z-50 px-1.5 py-0.5 bg-[var(--color-bg-secondary)] border border-white/10 rounded shadow-lg whitespace-nowrap">
          <span className="text-[10px] font-medium text-[var(--color-text-primary)]">
            {countryCode}
          </span>
        </div>
      )}
    </div>
  );
});

// Format token range for level display - returns [min, max] for aligned display
function formatLevelRangeParts(min: number, max: number): [string, string] {
  const formatNum = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(0)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
  };
  if (max === Infinity) return [formatNum(min), "+"];
  return [formatNum(min), formatNum(max)];
}

// Level Badge with Popover - Memoized to prevent unnecessary re-renders
const LevelBadge = React.memo(function LevelBadge({ tokens }: { tokens: number }) {
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
});

// Level Info Popover Component (PC hover) - Memoized for performance
const LevelInfoPopover = React.memo(function LevelInfoPopover({ isOpen }: { isOpen: boolean }) {
  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-full mt-2 z-[100] w-56 p-2 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg">
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
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span>{level.icon}</span>
                <span className="truncate">
                  Lv.{level.level} {level.name}
                </span>
              </div>
              {(() => {
                const [min, max] = formatLevelRangeParts(level.minTokens, level.maxTokens);
                return (
                  <span className="text-[8px] opacity-70 tabular-nums flex items-center gap-0.5 ml-2">
                    <span className="text-[7px]">⚡</span>
                    <span className="w-[28px] text-right">{min}</span>
                    <span className="w-[8px] text-center">{max === "+" ? "" : "-"}</span>
                    <span className="w-[28px] text-left">{max}</span>
                  </span>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
});

const ITEMS_PER_PAGE = 50;

// Empty arrays for Community features (API integration pending)
const EMPTY_HALL_OF_FAME: HallOfFameEntry[] = [];

// Static style object (no need for useMemo - defined outside component)
const PARTICLE_CONTAINER_STYLE = {
  top: 220,
  width: "min(1000px, 100vw - 32px)" as const,
  bottom: 0,
} as const;

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
  const pathname = usePathname();
  const highlightUsername = searchParams.get("u");

  // Determine initial view from pathname
  const getInitialView = (): ViewMode => {
    if (pathname === "/community") return "community";
    return "leaderboard";
  };

  // View mode for tab switching (leaderboard | community)
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialView);

  // URL sync: Update URL when viewMode changes (zero-latency, no page reload)
  useEffect(() => {
    const targetUrl = viewMode === "community" ? "/community" : "/leaderboard";
    if (pathname !== targetUrl) {
      window.history.replaceState(null, "", targetUrl);
    }
  }, [viewMode, pathname]);

  // Community tab state (extensible for future tabs)
  const [communityTab, setCommunityTab] = useState<CommunityTab>("vibes");
  // Post modal state (controlled at page level for filter area button)
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  // Submission guide modal state (explains why submission is needed)
  const [isSubmissionGuideOpen, setIsSubmissionGuideOpen] = useState(false);
  // CLI modal state (shows how to use CLI)
  const [isCLIModalOpen, setIsCLIModalOpen] = useState(false);
  // Login modal state (for non-logged-in users)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalType, setLoginModalType] = useState<
    "community_like" | "community_comment" | "community_post"
  >("community_post");
  // Featured post state (for Hall of Fame → Feed highlight)
  const [featuredPostId, setFeaturedPostId] = useState<string | null>(null);
  // Author filter state (for showing only one user's posts in community tab)
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [authorFilterInfo, setAuthorFilterInfo] = useState<{
    username: string;
    displayName?: string | null;
  } | null>(null);
  // Community posts state (API-driven)
  const [communityPosts, setCommunityPosts] = useState<FeedPost[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);

  const [selectedUser, setSelectedUser] = useState<DisplayUser | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isGlobePanelOpen, setIsGlobePanelOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("global");
  const [globePulse, setGlobePulse] = useState(false);
  const [sortBy, setSortBy] = useState<SortByFilter>("tokens");
  const [showLevelInfo, setShowLevelInfo] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(
    null
  );
  const [highlightMyRank, setHighlightMyRank] = useState(false);
  const [highlightedUsername, setHighlightedUsername] = useState<string | null>(null);
  const [pendingMyRankScroll, setPendingMyRankScroll] = useState(false);
  // Initialize with large value to ensure max-width is applied on first render
  const [viewportWidth, setViewportWidth] = useState(1920);
  // Panel width for push layout - 3-tier breakpoint system
  const [panelWidth, setPanelWidth] = useState(0);
  const [, setIsOverlayMode] = useState(true);

  // API state - Bidirectional infinite scroll with sparse page loading
  const [pagesData, setPagesData] = useState<Map<number, DisplayUser[]>>(new Map());
  const [loadedPageRange, setLoadedPageRange] = useState<{ start: number; end: number }>({
    start: 1,
    end: 1,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Derived flat users array from pagesData
  const users = useMemo(() => {
    const result: DisplayUser[] = [];
    for (let page = loadedPageRange.start; page <= loadedPageRange.end; page++) {
      const pageUsers = pagesData.get(page);
      if (pageUsers) {
        result.push(...pageUsers);
      }
    }
    return result;
  }, [pagesData, loadedPageRange]);

  // Community stats derived from real data (must be after users definition)
  const usersCount = users.length;
  const communityStats = useMemo(() => {
    const totalPosts = communityPosts.length;
    const totalLikes = communityPosts.reduce((sum, post) => sum + post.likes_count, 0);
    const uniqueAuthors = new Set(communityPosts.map((post) => post.author.id)).size;
    return {
      members: usersCount, // Real member count from leaderboard
      posts: totalPosts,
      likes: totalLikes,
      contributors: uniqueAuthors,
    };
  }, [communityPosts, usersCount]);

  // Check if there are more pages to load
  const hasMore = loadedPageRange.end < totalPages;
  const hasPrevious = loadedPageRange.start > 1;

  // Ref for table container
  const tableContainerRef = useRef<HTMLDivElement>(null);
  // Track scroll position for prepend restoration
  const scrollHeightBeforePrepend = useRef<number>(0);

  // Globe position tracking for full-screen particles
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const [globePosition, setGlobePosition] = useState<{ x: number; y: number } | null>(null);

  const [currentUserCountry, setCurrentUserCountry] = useState<string>("KR");
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [userInfoLoaded, setUserInfoLoaded] = useState(false);

  // Left column scroll state for Globe fade effect
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const [leftColumnScrollProgress, setLeftColumnScrollProgress] = useState(0);
  // Hybrid sticky: auto-lock when scrolling down, manual unlock via button
  const [stickyLocked, setStickyLocked] = useState(false);
  // Prevent re-lock during expand animation
  const isExpandingRef = useRef(false);
  // Shake expand button when trying to scroll up at top
  const [shakeExpandButton, setShakeExpandButton] = useState(false);

  // User country sticky state
  const [userCountryVisible, setUserCountryVisible] = useState(true);
  const [userCountryRank, setUserCountryRank] = useState(0);
  const [userCountryData, setUserCountryData] = useState<CountryStat | null>(null);
  const [userCountryDirection, setUserCountryDirection] = useState<"above" | "below" | null>(null);

  // Developer leaderboard: My Position sticky state (default false = show sticky initially)
  const [myPositionVisible, setMyPositionVisible] = useState(false);
  // Track whether user's position is above or below the viewport
  const [myPositionDirection, setMyPositionDirection] = useState<"above" | "below" | null>(null);
  const currentUserRowRef = useRef<HTMLTableRowElement>(null);

  // TopCountriesSection ref for programmatic scroll
  const topCountriesSectionRef = useRef<TopCountriesSectionRef>(null);

  // Handle left column scroll for Globe fade effect
  const handleLeftColumnScroll = useCallback(() => {
    if (!leftColumnRef.current) return;
    const { scrollTop } = leftColumnRef.current;
    // Calculate scroll progress (0 to 1) based on first 200px of scroll
    const fadeThreshold = 200;
    const progress = Math.min(scrollTop / fadeThreshold, 1);
    setLeftColumnScrollProgress(progress);

    // Auto-lock sticky when scrolled past threshold (no forced scroll reset)
    if (progress > 0.3 && !stickyLocked && !isExpandingRef.current) {
      setStickyLocked(true);
    }
  }, [stickyLocked]);

  // Expand Globe: unlock sticky and reset scroll
  const handleExpandGlobe = useCallback(() => {
    // Prevent re-lock during expansion
    isExpandingRef.current = true;
    setStickyLocked(false);
    setLeftColumnScrollProgress(0);
    // Instant scroll to top (no animation to avoid scroll events)
    if (leftColumnRef.current) {
      leftColumnRef.current.scrollTop = 0;
    }
    // Keep flag active longer to prevent re-lock from any residual events
    setTimeout(() => {
      isExpandingRef.current = false;
    }, 100);
  }, []);

  // Handle wheel event to shake expand button when trying to scroll up at top
  const handleLeftColumnWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!stickyLocked || !leftColumnRef.current) return;

      const { scrollTop } = leftColumnRef.current;
      // If at top and trying to scroll up (deltaY < 0)
      if (scrollTop === 0 && e.deltaY < 0) {
        setShakeExpandButton(true);
        // Reset shake after animation completes
        setTimeout(() => setShakeExpandButton(false), 500);
      }
    },
    [stickyLocked]
  );

  // Country stats state for Globe and Top Countries
  const [countryStats, setCountryStats] = useState<CountryStat[]>([]);
  const [totalGlobalTokens, setTotalGlobalTokens] = useState(0);
  const [totalGlobalCost, setTotalGlobalCost] = useState(0);

  // Calculate country stats from users data
  useEffect(() => {
    if (users.length === 0) return;

    // Aggregate by country
    const countryMap = new Map<string, { tokens: number; cost: number }>();
    users.forEach((user) => {
      const code = user.country_code || "XX";
      const existing = countryMap.get(code) || { tokens: 0, cost: 0 };
      countryMap.set(code, {
        tokens: existing.tokens + (user.total_tokens || 0),
        cost: existing.cost + (user.total_cost || 0),
      });
    });

    // Convert to array
    const stats: CountryStat[] = Array.from(countryMap.entries()).map(([code, data]) => ({
      code,
      name: getCountryName(code),
      tokens: data.tokens,
      cost: data.cost,
    }));

    const totalTokens = stats.reduce((sum, c) => sum + c.tokens, 0);
    const totalCost = stats.reduce((sum, c) => sum + c.cost, 0);

    setCountryStats(stats);
    setTotalGlobalTokens(totalTokens);
    setTotalGlobalCost(totalCost);
  }, [users]);

  // Handle country stats loaded from GlobeStatsSection (no longer using mock data)
  const handleCountryStatsLoaded = useCallback(
    (_stats: CountryStat[], _tokens: number, _cost: number) => {
      // Country stats are now calculated from users data in useEffect above
    },
    []
  );

  // Handle user country visibility change from TopCountriesSection
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

  // Jump to user's country in the list
  const jumpToUserCountry = useCallback(() => {
    topCountriesSectionRef.current?.scrollToUserCountry();
  }, []);

  // State for pending jump to user position
  const [pendingJumpToUser, setPendingJumpToUser] = useState(false);
  const [userTargetPage, setUserTargetPage] = useState<number | null>(null);

  // Ref to hold latest fetchLeaderboard to avoid dependency issues in effects
  const fetchLeaderboardRef = useRef<
    | ((mode?: "initial" | "append" | "prepend" | "jump", targetPage?: number) => Promise<void>)
    | undefined
  >(undefined);

  // Jump to current user's row in developer leaderboard (with direct page load)
  const jumpToMyPosition = useCallback(async () => {
    // If user row is already loaded, just scroll to it
    if (currentUserRowRef.current) {
      currentUserRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Otherwise, fetch user's position and load that page directly
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

      if (data.found && data.user?.page) {
        // Set target page and trigger load
        setUserTargetPage(data.user.page);
        setPendingJumpToUser(true);
      }
    } catch {
      // Fallback: do nothing
    }
  }, [currentUsername, scopeFilter, currentUserCountry]);

  // Fetch a specific page of leaderboard data
  const fetchPage = useCallback(
    async (
      pageNum: number,
      _mode: "initial" | "append" | "prepend" | "jump"
    ): Promise<DisplayUser[]> => {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("limit", String(ITEMS_PER_PAGE));
      params.set("period", periodFilter);

      try {
        params.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
      } catch {
        params.set("tz", "UTC");
      }

      if (periodFilter === "custom" && customDateRange) {
        params.set("startDate", customDateRange.start);
        params.set("endDate", customDateRange.end);
      }

      if (scopeFilter === "country" && currentUserCountry) {
        params.set("country", currentUserCountry);
      }

      const response = await fetch(`/api/leaderboard?${params}`);
      if (!response.ok) throw new Error("Failed to fetch leaderboard");

      const data = await response.json();
      const startIndex = (pageNum - 1) * ITEMS_PER_PAGE;

      const transformedUsers: DisplayUser[] = (data.users || []).map(
        (user: LeaderboardUser, index: number) => {
          let rank: number;
          if (periodFilter !== "all") {
            rank = user.period_rank || startIndex + index + 1;
          } else {
            rank = startIndex + index + 1;
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

      // Update pagination info
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);

      return transformedUsers;
    },
    [periodFilter, scopeFilter, currentUserCountry, currentUsername, customDateRange]
  );

  // Fetch leaderboard data (supports initial, append, prepend, and jump modes)
  const fetchLeaderboard = useCallback(
    async (mode: "initial" | "append" | "prepend" | "jump" = "initial", targetPage?: number) => {
      // API calls for bidirectional infinite scroll
      if (mode === "initial" || mode === "jump") {
        setLoading(true);
      } else if (mode === "append") {
        setLoadingMore(true);
      } else if (mode === "prepend") {
        setLoadingPrevious(true);
        if (tableContainerRef.current) {
          scrollHeightBeforePrepend.current = tableContainerRef.current.scrollHeight;
        }
      }
      setError(null);

      try {
        const pageNum =
          targetPage ||
          (mode === "append"
            ? loadedPageRange.end + 1
            : mode === "prepend"
              ? loadedPageRange.start - 1
              : 1);
        const pageUsers = await fetchPage(pageNum, mode);

        setPagesData((prev) => {
          const newMap = new Map(prev);
          if (mode === "initial" || mode === "jump") {
            newMap.clear();
          }
          newMap.set(pageNum, pageUsers);
          return newMap;
        });

        if (mode === "initial" || mode === "jump") {
          setLoadedPageRange({ start: pageNum, end: pageNum });
        } else if (mode === "append") {
          setLoadedPageRange((prev) => ({ ...prev, end: pageNum }));
        } else if (mode === "prepend") {
          setLoadedPageRange((prev) => ({ ...prev, start: pageNum }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setLoadingPrevious(false);
      }
    },
    [loadedPageRange, fetchPage]
  );

  // Keep ref updated to avoid stale closure in effects
  fetchLeaderboardRef.current = fetchLeaderboard;

  // Load more data for infinite scroll (downward)
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchLeaderboard("append");
  }, [loadingMore, hasMore, fetchLeaderboard]);

  // Load previous data for infinite scroll (upward)
  const loadPrevious = useCallback(() => {
    if (loadingPrevious || !hasPrevious) return;
    fetchLeaderboard("prepend");
  }, [loadingPrevious, hasPrevious, fetchLeaderboard]);

  // Handle scroll position restoration after prepending data
  // Using useLayoutEffect to prevent visual flash - executes before browser paint
  useLayoutEffect(() => {
    if (scrollHeightBeforePrepend.current > 0 && tableContainerRef.current && !loadingPrevious) {
      const newScrollHeight = tableContainerRef.current.scrollHeight;
      const scrollDiff = newScrollHeight - scrollHeightBeforePrepend.current;
      if (scrollDiff > 0) {
        tableContainerRef.current.scrollTop += scrollDiff;
      }
      scrollHeightBeforePrepend.current = 0;
    }
  }, [loadingPrevious, loadedPageRange.start]);

  // Handle pending jump to user position
  // Using ref pattern to avoid dependency on fetchLeaderboard which changes frequently
  useEffect(() => {
    if (pendingJumpToUser && userTargetPage && !loading) {
      fetchLeaderboardRef.current?.("jump", userTargetPage);
      setPendingJumpToUser(false);
    }
  }, [pendingJumpToUser, userTargetPage, loading]);

  // Scroll to user row after jump load completes
  // Using requestAnimationFrame for reliable DOM update timing
  useEffect(() => {
    if (userTargetPage && !loading && users.length > 0) {
      const currentUser = users.find((u) => u.isCurrentUser);
      if (currentUser) {
        // Use requestAnimationFrame for more reliable DOM timing
        const scrollToUser = () => {
          if (currentUserRowRef.current) {
            currentUserRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
            setUserTargetPage(null);
          } else {
            // DOM not ready yet, try again next frame
            requestAnimationFrame(scrollToUser);
          }
        };
        requestAnimationFrame(scrollToUser);
      }
    }
  }, [userTargetPage, loading, users]);

  // Reset globe pulse after animation completes
  useEffect(() => {
    if (!globePulse) return;
    const timer = setTimeout(() => setGlobePulse(false), 400);
    return () => clearTimeout(timer);
  }, [globePulse]);

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

  // Fetch data on filter/page change
  // Using ref to avoid infinite loop from fetchLeaderboard dependency
  useEffect(() => {
    fetchLeaderboardRef.current?.();
  }, [periodFilter, scopeFilter, customDateRange]);

  // Refetch leaderboard after user info is loaded (to get updated social_links from OAuth)
  useEffect(() => {
    if (userInfoLoaded) {
      fetchLeaderboardRef.current?.();
    }
  }, [userInfoLoaded]);

  // Update selectedUser when users array changes (to reflect updated data including period stats)
  // Use selectedUser.id as dependency to avoid infinite loop
  const selectedUserId = selectedUser?.id;
  useEffect(() => {
    if (selectedUserId && users.length > 0) {
      const updatedUser = users.find((u) => u.id === selectedUserId);
      if (updatedUser) {
        // Only update if data actually changed (compare key fields to avoid infinite loop)
        setSelectedUser((prev) => {
          if (!prev) return updatedUser;
          // Compare key fields that might change
          const hasChanged =
            prev.total_tokens !== updatedUser.total_tokens ||
            prev.total_cost !== updatedUser.total_cost ||
            prev.period_tokens !== updatedUser.period_tokens ||
            prev.period_cost !== updatedUser.period_cost ||
            prev.global_rank !== updatedUser.global_rank ||
            prev.country_rank !== updatedUser.country_rank ||
            JSON.stringify(prev.social_links) !== JSON.stringify(updatedUser.social_links);
          return hasChanged ? updatedUser : prev;
        });
      }
    }
  }, [users, selectedUserId]);

  // Viewport width and panel width tracking for responsive layout
  // Mobile: < 640px | Tablet: 640-1039px | PC: >= 1040px
  useEffect(() => {
    const updateLayout = () => {
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
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
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
          // Navigate to the user's page using jump mode
          setUserTargetPage(data.user.page);
          fetchLeaderboard("jump", data.user.page);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightUsername, users, scopeFilter, currentUserCountry]);

  // Find current user
  const currentUserData = useMemo(() => {
    return users.find((u) => u.isCurrentUser);
  }, [users]);

  // IntersectionObserver for current user row visibility in developer leaderboard
  // Also tracks direction (above/below) when not visible
  useEffect(() => {
    const row = currentUserRowRef.current;
    if (!row || !currentUserData) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setMyPositionVisible(entry.isIntersecting);

          // Determine direction when not visible
          if (!entry.isIntersecting && entry.rootBounds) {
            // If the row's bottom is above the viewport top → user is ABOVE
            // If the row's top is below the viewport bottom → user is BELOW
            if (entry.boundingClientRect.bottom < entry.rootBounds.top) {
              setMyPositionDirection("above");
            } else if (entry.boundingClientRect.top > entry.rootBounds.bottom) {
              setMyPositionDirection("below");
            }
          } else {
            setMyPositionDirection(null);
          }
        }
      },
      {
        root: tableContainerRef.current,
        rootMargin: "0px",
        threshold: 0.1,
      }
    );

    observer.observe(row);
    return () => observer.disconnect();
    // Note: currentUserData is derived from users via useMemo, so only currentUserData is needed
  }, [currentUserData]);

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

  // Reset pagination state on filter change
  useEffect(() => {
    setPagesData(new Map());
    setLoadedPageRange({ start: 1, end: 1 });
    setTotalPages(1);
    setHighlightMyRank(false);
    setUserTargetPage(null);
  }, [scopeFilter, periodFilter, sortBy]);

  // Track Globe position for full-screen particles
  // Only update on resize (not scroll) - particles don't need to follow scroll
  useEffect(() => {
    const updateGlobePosition = () => {
      if (!globeContainerRef.current) return;
      const rect = globeContainerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setGlobePosition({ x: centerX, y: centerY });
    };

    // Initial measurement after layout
    const timer = setTimeout(updateGlobePosition, 100);

    // Update only on resize (removed scroll listener for performance)
    window.addEventListener("resize", updateGlobePosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateGlobePosition);
    };
  }, [loading, stickyLocked, viewportWidth]);

  const handleRowClick = (user: DisplayUser) => {
    setSelectedUser(user);
    setIsPanelOpen(true);
    setHighlightMyRank(false);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
  };

  // Handle posts click from ProfileSidePanel - filter community feed by author
  const handlePostsClick = (userId: string) => {
    // Find author info from community posts
    const post = communityPosts.find((p: FeedPost) => p.author.id === userId);
    if (post) {
      setAuthorFilter(userId);
      setAuthorFilterInfo({
        username: post.author.username,
        displayName: post.author.display_name,
      });
      // Switch to community view if not already
      if (viewMode !== "community") {
        setViewMode("community");
      }
    }
  };

  // Clear author filter
  const handleClearAuthorFilter = () => {
    setAuthorFilter(null);
    setAuthorFilterInfo(null);
  };

  // =====================================================
  // Community API Functions
  // =====================================================

  // Fetch community posts

  const fetchCommunityPosts = useCallback(
    async (tab: string = "all") => {
      setCommunityLoading(true);
      try {
        const params = new URLSearchParams();
        if (tab !== "all") {
          params.set("tab", tab);
        }
        if (authorFilter) {
          params.set("author", authorFilter);
        }
        const res = await fetch(`/api/community/posts?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch posts");
        const data = await res.json();

        // Transform API response to match FeedPost interface
        const transformedPosts: FeedPost[] = (data.posts || []).map(
          (post: {
            id: string;
            author: {
              id: string;
              username: string;
              display_name: string | null;
              avatar_url: string | null;
              current_level: number;
              country_code: string | null;
            };
            content: string;
            tab: string;
            original_language: string;
            is_translated: boolean;
            created_at: string;
            likes_count: number;
            comments_count: number;
            is_liked: boolean;
          }) => ({
            id: post.id,
            author: {
              id: post.author.id,
              username: post.author.username,
              display_name: post.author.display_name,
              avatar_url: post.author.avatar_url,
              level: post.author.current_level || 1,
              country_code: post.author.country_code,
            },
            content: post.content,
            original_language: post.original_language || "en",
            is_translated: post.is_translated || false,
            created_at: post.created_at,
            likes_count: post.likes_count || 0,
            comments_count: post.comments_count || 0,
            is_liked: post.is_liked || false,
            comments: [], // Comments are fetched separately when viewing post
          })
        );

        setCommunityPosts(transformedPosts);
      } catch (err) {
        console.error("Error fetching community posts:", err);
        setCommunityPosts([]);
      } finally {
        setCommunityLoading(false);
      }
    },
    [authorFilter]
  );

  // Handle post creation
  const handleCreatePost = useCallback(
    async (content: string, tab: string) => {
      try {
        const res = await fetch("/api/community/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, tab }),
        });

        if (!res.ok) {
          const data = await res.json();
          console.error("Failed to create post:", data.error);
          return;
        }

        // Refresh posts after creation
        fetchCommunityPosts(communityTab);
      } catch (err) {
        console.error("Error creating post:", err);
      }
    },
    [fetchCommunityPosts, communityTab]
  );

  // Handle like toggle
  const handleLikePost = useCallback(async (postId: string) => {
    try {
      const res = await fetch(`/api/community/posts/${postId}/like`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Failed to toggle like:", data.error);
        return;
      }

      const data = await res.json();

      // Update local state optimistically
      setCommunityPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, is_liked: data.liked, likes_count: data.likes_count }
            : post
        )
      );
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  }, []);

  // Fetch community posts when switching to community mode or tab changes
  useEffect(() => {
    if (viewMode === "community") {
      fetchCommunityPosts(communityTab);
    }
  }, [viewMode, communityTab, fetchCommunityPosts]);

  // Use compact ratio only when: viewport < 1200px AND panel is open
  // Above 1200px: Globe remains visible alongside panel
  const useCompactRatio = isPanelOpen && viewportWidth < 1200;

  // Tablet: 768px <= width < 1040px → use 45:55 ratio
  const isTablet = viewportWidth >= 768 && viewportWidth < 1040;

  // Show level column: always on 860px+, or on narrow when panel is open (table expanded)
  const showLevelColumn = viewportWidth >= 860 || (viewportWidth >= 768 && isPanelOpen);

  // Memoized style objects to prevent unnecessary re-renders
  const containerStyle = useMemo(
    () => ({
      marginRight:
        isPanelOpen && panelWidth > 0 && viewportWidth < 1500 ? `${panelWidth}px` : undefined,
    }),
    [isPanelOpen, panelWidth, viewportWidth]
  );

  const particleInnerStyle = useMemo(() => {
    if (!globePosition) return undefined;
    return {
      left: globePosition.x - (viewportWidth - Math.min(1000, viewportWidth - 32)) / 2,
      top: globePosition.y - 220,
      transform: "translate(-50%, -50%)" as const,
    };
  }, [globePosition, viewportWidth]);

  const leftColumnStyle = useMemo(
    () => ({
      width: useCompactRatio
        ? undefined
        : isPanelOpen && viewportWidth < 1500
          ? "40%"
          : isTablet
            ? "45%"
            : "50%",
    }),
    [useCompactRatio, isPanelOpen, viewportWidth, isTablet]
  );

  const rightColumnStyle = useMemo(
    () => ({
      width:
        viewportWidth < 768
          ? "100%"
          : useCompactRatio
            ? "100%"
            : isPanelOpen && viewportWidth < 1500
              ? "60%"
              : isTablet
                ? "55%"
                : "50%",
    }),
    [viewportWidth, useCompactRatio, isPanelOpen, isTablet]
  );

  const scrollContainerStyle = useMemo(
    () => ({
      height: viewportWidth >= 768 ? "calc(100vh - 64px - 156px)" : undefined,
      minHeight: viewportWidth >= 768 ? "400px" : "200px",
      overscrollBehavior: "none" as const,
    }),
    [viewportWidth]
  );

  return (
    <div className="min-h-screen overflow-x-hidden md:fixed md:top-16 md:left-0 md:right-0 md:bottom-0 md:z-10 md:bg-[var(--color-bg-primary)] md:overflow-hidden">
      {/* Globe Particles - within content area (max-width 1000px), below filter */}
      {/* Only show on tablet/desktop (md+), mobile has separate MobileGlobePanel */}
      {viewportWidth >= 768 && globePosition && particleInnerStyle && (
        <div
          className="hidden md:block fixed pointer-events-none z-0 overflow-hidden left-1/2 -translate-x-1/2"
          style={PARTICLE_CONTAINER_STYLE}
        >
          <div className="absolute" style={particleInnerStyle}>
            <GlobeParticles
              size={isTablet ? 280 : 320}
              speed={viewMode === "community" ? 0.4 : 1}
            />
          </div>
        </div>
      )}
      <div className="transition-[height,overflow] duration-300 ease-out h-[calc(100vh-56px)] md:h-auto overflow-hidden md:overflow-visible">
        <div
          className="px-4 pt-4 pb-2 max-w-[1000px] mx-auto transition-[margin] duration-300 h-full md:h-auto flex flex-col"
          style={containerStyle}
        >
          {/* Header */}
          <header className="mb-4 md:mb-6">
            {/* Context Header with Timezone Clock */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  {viewMode === "leaderboard" ? (
                    scopeFilter === "global" ? (
                      <>🌍 Global Leaderboard</>
                    ) : (
                      <>
                        <FlagIcon countryCode={currentUserCountry} size="sm" />
                        Country Leaderboard
                      </>
                    )
                  ) : (
                    <>💬 Community</>
                  )}
                </h1>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {viewMode === "leaderboard"
                    ? `Top Claude Code developers ranked by ${sortBy === "tokens" ? "token usage" : "spending"}`
                    : "Connect with Claude Code developers worldwide"}
                </p>
              </div>
              {/* Live timezone clock - tablet and desktop only (768px+) */}
              <TimezoneClock className="hidden md:inline-flex" />
            </div>
          </header>

          {/* Mobile timezone clock - centered between title and filters (below 768px) */}
          <div className="flex md:hidden justify-center mb-4">
            <TimezoneClock />
          </div>

          {/* 2-Column Layout: Globe+Countries (left) + Users (right) */}
          {/* Wide viewport (>=1440): always 50%|50%+panel */}
          {/* Narrow viewport (<1440) + panel open: Globe slides out, table expands */}
          <div className="flex flex-col md:flex-row md:justify-start gap-4 overflow-hidden flex-1 min-h-0">
            {/* Left Column: Globe + Top Countries */}
            {/* Tablet (<1040px): 45% width, PC (>=1040px): 50% width */}
            {/* When panel opens: shrink to 35% to give more space to table */}
            {/* When panel opens on narrow viewport (<1200px): slides out */}
            <div
              className={`hidden md:flex md:flex-col transition-[width,opacity,transform] duration-300 relative ${
                useCompactRatio ? "md:w-0 md:opacity-0 md:-translate-x-full md:overflow-hidden" : ""
              }`}
              style={leftColumnStyle}
            >
              {/* Fixed Header: Stats Summary (left) + Scope Filter (right) */}
              <div className="flex items-center justify-between mb-4" style={{ height: 34 }}>
                {/* Stats Summary - always visible at top left */}
                <div
                  className={`flex items-center gap-1.5 text-xs ${isTablet ? "text-[10px]" : ""}`}
                >
                  {viewMode === "community" ? (
                    /* Community Stats: members, posts, likes - 1초에 약 1씩 천천히 롤링 */
                    <>
                      <span className="flex items-center gap-1 text-[var(--color-accent-cyan)]">
                        <span>👥</span>
                        <AnimatedNumber
                          value={communityStats.members}
                          perUnitDuration={800}
                          maxDuration={20000}
                          easing="linear"
                          className="font-semibold"
                          storageKey="community_members"
                        />
                        <span className="text-[var(--color-text-muted)] font-normal">members</span>
                      </span>
                      <span className="text-[var(--color-text-muted)]">·</span>
                      <span className="flex items-center gap-1 text-[var(--color-claude-coral)]">
                        <span>📝</span>
                        <AnimatedNumber
                          value={communityStats.posts}
                          perUnitDuration={800}
                          maxDuration={20000}
                          easing="linear"
                          className="font-semibold"
                          storageKey="community_posts"
                        />
                        <span className="text-[var(--color-text-muted)] font-normal">posts</span>
                      </span>
                      <span className="text-[var(--color-text-muted)]">·</span>
                      <span className="flex items-center gap-1 text-[var(--color-accent-red)]">
                        <span>❤️</span>
                        <AnimatedNumber
                          value={communityStats.likes}
                          perUnitDuration={800}
                          maxDuration={20000}
                          easing="linear"
                          className="font-semibold"
                          storageKey="community_likes"
                        />
                        <span className="text-[var(--color-text-muted)] font-normal">likes</span>
                      </span>
                    </>
                  ) : (
                    /* Leaderboard Stats: cost & tokens - 느린 linear 애니메이션으로 real-time 느낌 */
                    <>
                      <span className="flex items-center gap-1 text-[var(--color-text-primary)]">
                        <span>🌍</span>
                      </span>
                      <span className="text-[var(--color-text-muted)]">·</span>
                      <span
                        className={`flex items-center gap-1 ${
                          sortBy === "tokens"
                            ? "text-[var(--color-text-muted)]"
                            : "text-[var(--color-cost)]"
                        }`}
                      >
                        <span>💰</span>
                        <AnimatedNumber
                          value={Math.round(totalGlobalCost)}
                          duration={1200}
                          easing="easeOut"
                          className="font-semibold"
                          formatter={(n) => `$${n.toLocaleString()}`}
                          storageKey="leaderboard_cost"
                          smartStart={0.97}
                          simulateRealtime={{
                            interval: 5000,
                            minIncrement: 0,
                            maxIncrement: 2,
                          }}
                        />
                      </span>
                      <span className="text-[var(--color-text-muted)]">·</span>
                      <span
                        className={`flex items-center gap-1 ${
                          sortBy === "cost"
                            ? "text-[var(--color-text-muted)]"
                            : "text-[var(--color-claude-coral)]"
                        }`}
                      >
                        <span>⚡</span>
                        <AnimatedNumber
                          value={totalGlobalTokens}
                          duration={1200}
                          easing="easeOut"
                          className="font-semibold"
                          storageKey="leaderboard_tokens"
                          smartStart={0.97}
                          simulateRealtime={{
                            interval: 4000,
                            minIncrement: 1000,
                            maxIncrement: 8000,
                          }}
                        />
                      </span>
                    </>
                  )}
                </div>

                {/* Scope Filter - right aligned (Both Leaderboard and Community) */}
                <div className="flex h-[34px] glass rounded-lg overflow-hidden">
                  <button
                    onClick={() => {
                      setScopeFilter("global");
                      setGlobePulse(true);
                    }}
                    className={`h-[34px] w-[34px] text-[11px] leading-none font-medium transition-colors flex items-center justify-center ${
                      scopeFilter === "global"
                        ? "bg-[var(--color-claude-coral)]/50 text-[var(--color-claude-coral)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                    }`}
                  >
                    🌍
                  </button>
                  <button
                    onClick={() => {
                      setScopeFilter("country");
                      setGlobePulse(true);
                    }}
                    className={`h-[34px] w-[34px] text-[11px] leading-none font-medium transition-colors flex items-center justify-center ${
                      scopeFilter === "country"
                        ? "bg-emerald-500/50 text-emerald-400"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                    }`}
                  >
                    {currentUserCountry && (
                      <FlagIcon
                        countryCode={currentUserCountry}
                        size="xs"
                        className="flex-shrink-0"
                      />
                    )}
                  </button>
                </div>
              </div>

              {/* Scrollable container - flex column to fill height */}
              <div
                ref={leftColumnRef}
                onScroll={handleLeftColumnScroll}
                onWheel={handleLeftColumnWheel}
                className="overflow-y-auto overflow-x-hidden scrollbar-hide relative flex flex-col"
                style={{
                  height: "calc(100vh - 64px - 156px)",
                  maxHeight: "calc(100vh - 64px - 156px)",
                }}
              >
                {/* Globe - Sticky, stays fixed while scrolling, z-10 to cover particles */}
                <div className="sticky top-0 left-0 right-0 h-0 z-10 pointer-events-none flex justify-center">
                  <div
                    className="absolute flex flex-col items-center"
                    style={{
                      top: isTablet ? 8 : 16,
                      width: isTablet ? 280 : 320,
                    }}
                  >
                    {/* GlobeParticles moved to full-screen background layer */}
                    {/* Globe - fades to 10% when sticky locked or on scroll */}
                    {/* pointer-events-none when stickyLocked to allow interaction with Hall of Fame */}
                    <div
                      ref={globeContainerRef}
                      className={`transition-opacity duration-300 ${stickyLocked ? "pointer-events-none" : "pointer-events-auto"} ${globePulse ? "animate-globe-pulse" : ""}`}
                      style={{
                        opacity: stickyLocked
                          ? 0.1
                          : Math.max(0.1, 1 - leftColumnScrollProgress * 1.8),
                      }}
                    >
                      <GlobeStatsSection
                        userCountryCode={currentUserCountry}
                        onStatsLoaded={handleCountryStatsLoaded}
                        size="large"
                        scopeFilter={scopeFilter}
                        sortBy={sortBy}
                        compact={isTablet}
                        hideParticles
                        hideStats
                      />
                    </div>
                  </div>
                </div>

                {/* Spacer for Globe height - collapses when sticky locked */}
                <div
                  className="flex-shrink-0"
                  style={{ height: stickyLocked ? 0 : isTablet ? 380 : 420 }}
                />

                {/* Left Column Content - changes based on viewMode */}
                {viewMode === "leaderboard" ? (
                  /* Top Countries Section with sticky header - z-20 to be above Globe (z-10) */
                  <div
                    className={`glass !border-0 rounded-t-2xl flex-1 flex flex-col pointer-events-auto relative z-20 ${stickyLocked ? "" : isTablet ? "mt-2" : "mt-4"}`}
                  >
                    {/* Sticky Header - extends 2px above to cover rounded corner gap */}
                    <div
                      className={`sticky top-0 z-20 h-[42px] flex items-center gap-2 bg-[var(--glass-bg)] backdrop-blur-md rounded-t-2xl border-b border-[var(--color-text-muted)]/30 px-3`}
                      style={{ marginTop: -2, paddingTop: 2 }}
                    >
                      {/* Trophy - aligned with rank column */}
                      <span className="w-6 text-xs text-center flex-shrink-0">🏆</span>
                      {/* Spacer for flag column */}
                      <span className="w-4 flex-shrink-0"></span>
                      {/* Title - aligned with country name */}
                      <span className="flex-1 text-xs font-medium text-[var(--color-text-secondary)]">
                        Top Countries
                      </span>
                      {/* Right side controls */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          by {sortBy === "tokens" ? "Token Usage" : "Cost"}
                        </span>
                        {stickyLocked && (
                          <button
                            onClick={handleExpandGlobe}
                            className={`w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-all ${
                              shakeExpandButton
                                ? "animate-shake bg-[var(--color-claude-coral)]/30 text-[var(--color-claude-coral)] ring-1 ring-[var(--color-claude-coral)]/50"
                                : ""
                            }`}
                            title="Show Globe"
                          >
                            <ChevronDown size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Country List - flex-1 to fill remaining space */}
                    <div className={`${isTablet ? "p-3 pt-2" : "p-4 pt-3"} flex-1`}>
                      {countryStats.length > 0 && (
                        <TopCountriesSection
                          ref={topCountriesSectionRef}
                          stats={countryStats}
                          totalTokens={totalGlobalTokens}
                          totalCost={totalGlobalCost}
                          sortBy={sortBy}
                          userCountryCode={currentUserCountry}
                          compact={viewportWidth < 860}
                          hideHeader
                          onUserCountryVisibilityChange={handleUserCountryVisibilityChange}
                          scrollContainerRef={leftColumnRef}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  /* Community Stats Section - z-20 to be above Globe (z-10), pointer-events-auto to block Globe interaction */
                  /* Always maintain sufficient height to allow scrolling */
                  <div
                    className={`glass !border-0 rounded-t-2xl flex flex-col pointer-events-auto relative z-20 ${stickyLocked ? "" : isTablet ? "mt-2" : "mt-4"}`}
                    style={{
                      minHeight: "calc(100vh - 64px - 156px)",
                    }}
                  >
                    {/* Sticky Header */}
                    <div
                      className={`sticky top-0 z-20 h-[42px] flex items-center gap-2 bg-[var(--glass-bg)] backdrop-blur-md rounded-t-2xl border-b border-[var(--color-text-muted)]/30 px-3`}
                      style={{ marginTop: -2, paddingTop: 2 }}
                    >
                      <span className="w-6 text-xs text-center flex-shrink-0">🌐</span>
                      <span className="flex-1 text-xs font-medium text-[var(--color-text-secondary)]">
                        Community Stats
                      </span>
                      {stickyLocked && (
                        <button
                          onClick={handleExpandGlobe}
                          className={`w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-all ${
                            shakeExpandButton
                              ? "animate-shake bg-[var(--color-claude-coral)]/30 text-[var(--color-claude-coral)] ring-1 ring-[var(--color-claude-coral)]/50"
                              : ""
                          }`}
                          title="Show Globe"
                        >
                          <ChevronDown size={16} />
                        </button>
                      )}
                    </div>
                    {/* Hall of Fame Content */}
                    <div className={`${isTablet ? "p-3 pt-2" : "p-4 pt-3"} flex-1`}>
                      <HallOfFame
                        mostLiked={EMPTY_HALL_OF_FAME}
                        mostReplied={EMPTY_HALL_OF_FAME}
                        onUserClick={(userId) => {
                          // Find author from community posts
                          const post = communityPosts.find((p: FeedPost) => p.author.id === userId);
                          if (post) {
                            const postUser: DisplayUser = {
                              id: userId,
                              username: post.author.username,
                              display_name: post.author.display_name || null,
                              avatar_url: post.author.avatar_url || null,
                              country_code: post.author.country_code || null,
                              total_tokens: 0,
                              total_cost: 0,
                              rank: 0,
                              current_level: post.author.level,
                              global_rank: null,
                              country_rank: null,
                            };
                            setSelectedUser(postUser);
                            setIsPanelOpen(true);
                          }
                        }}
                        onPostClick={(postId) => {
                          setFeaturedPostId(postId);
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 📍 Your Country - Sticky Top (when scrolled below user's country) - Only in leaderboard mode */}
                {viewMode === "leaderboard" &&
                  !userCountryVisible &&
                  userCountryData &&
                  userCountryDirection === "above" && (
                    <div
                      onClick={jumpToUserCountry}
                      className="sticky top-[42px] z-30 bg-[var(--glass-bg)] backdrop-blur-md cursor-pointer hover:bg-[var(--glass-bg-hover)] active:bg-[var(--glass-bg-hover)] transition-colors"
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
                                ? userCountryData.tokens / totalGlobalTokens
                                : userCountryData.cost / totalGlobalCost) * 100
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                        <div
                          className={`flex items-center font-mono flex-shrink-0 ${viewportWidth < 860 ? "gap-2 text-[10px]" : "gap-3 text-xs"}`}
                        >
                          {viewportWidth < 860 ? (
                            sortBy === "tokens" ? (
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
                            )
                          ) : (
                            <>
                              <span
                                className={`min-w-[40px] text-right ${sortBy === "tokens" ? "text-[var(--color-text-muted)]" : "text-[var(--color-cost)]"}`}
                              >
                                $
                                {userCountryData.cost >= 1000
                                  ? `${(userCountryData.cost / 1000).toFixed(1)}K`
                                  : userCountryData.cost.toFixed(0)}
                              </span>
                              <span
                                className={`min-w-[45px] text-right ${sortBy === "cost" ? "text-[var(--color-text-muted)]" : "text-[var(--color-claude-coral)]"}`}
                              >
                                {formatTokens(userCountryData.tokens)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                {/* 📍 Your Country - Sticky Bottom (when scrolled above user's country) - Only in leaderboard mode */}
                {viewMode === "leaderboard" &&
                  !userCountryVisible &&
                  userCountryData &&
                  userCountryDirection === "below" && (
                    <div
                      onClick={jumpToUserCountry}
                      className="sticky bottom-0 z-30 bg-[var(--glass-bg)] backdrop-blur-md border-t border-[var(--color-text-muted)]/30 rounded-b-2xl cursor-pointer hover:bg-[var(--glass-bg-hover)] active:bg-[var(--glass-bg-hover)] transition-colors pb-4"
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
                                ? userCountryData.tokens / totalGlobalTokens
                                : userCountryData.cost / totalGlobalCost) * 100
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                        <div
                          className={`flex items-center font-mono flex-shrink-0 ${viewportWidth < 860 ? "gap-2 text-[10px]" : "gap-3 text-xs"}`}
                        >
                          {viewportWidth < 860 ? (
                            sortBy === "tokens" ? (
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
                            )
                          ) : (
                            <>
                              <span
                                className={`min-w-[40px] text-right ${sortBy === "tokens" ? "text-[var(--color-text-muted)]" : "text-[var(--color-cost)]"}`}
                              >
                                $
                                {userCountryData.cost >= 1000
                                  ? `${(userCountryData.cost / 1000).toFixed(1)}K`
                                  : userCountryData.cost.toFixed(0)}
                              </span>
                              <span
                                className={`min-w-[45px] text-right ${sortBy === "cost" ? "text-[var(--color-text-muted)]" : "text-[var(--color-claude-coral)]"}`}
                              >
                                {formatTokens(userCountryData.tokens)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Safe area padding for mobile */}
                      <div className="h-[env(safe-area-inset-bottom,0px)]" />
                    </div>
                  )}
              </div>
            </div>

            {/* Right Column: User Table or Community Feed */}
            {/* Mobile (<768px): 100% width */}
            {/* Tablet (768-1039px): 55% width, PC (>=1040px): 50% width */}
            {/* When panel opens: expand to 65% (Globe shrinks to 35%) */}
            {/* When panel opens on narrow viewport (<1200px): expands to full width */}
            <div
              className="w-full md:w-auto transition-[width] duration-300 flex-1 md:flex-none flex flex-col min-h-0"
              style={rightColumnStyle}
            >
              {/* Filters - Above Table (height: 34px + mb-4 to match left column header) */}
              {/* Community mode: Feed/Help tabs + Post button */}
              {viewMode === "community" && (
                <div
                  className="flex items-center justify-between gap-2 mb-4"
                  style={{ height: 34 }}
                >
                  {/* Left side: Community Stats + Tab Buttons */}
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                    {/* Community Stats Button - Mobile only */}
                    <button
                      onClick={() => setIsGlobePanelOpen(true)}
                      className="md:hidden rounded-lg glass text-[11px] leading-none font-medium transition-colors flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 flex-shrink-0"
                      style={{ width: 34, height: 34 }}
                      title="View Hall of Fame"
                    >
                      🔥
                    </button>
                    {/* Tab Buttons - Outline style, each independent */}
                    {COMMUNITY_TABS.map((tab) => {
                      const isActive = communityTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setCommunityTab(tab.id)}
                          className={`h-[34px] px-3.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap flex-shrink-0 border ${
                            isActive
                              ? "border-[var(--color-text-muted)]/40 text-[var(--color-text-primary)]"
                              : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {tab.emoji} {tab.label}
                        </button>
                      );
                    })}
                  </div>
                  {/* +Post Button - Outline style */}
                  <button
                    onClick={() => {
                      if (!currentUsername) {
                        // Not logged in - show login modal
                        setLoginModalType("community_post");
                        setIsLoginModalOpen(true);
                        return;
                      }
                      if ((currentUserData?.total_tokens || 0) === 0) {
                        // No submission history - show guide modal first
                        setIsSubmissionGuideOpen(true);
                        return;
                      }
                      // Has submission history - open post modal
                      setIsPostModalOpen(true);
                    }}
                    className="h-[34px] px-3.5 flex items-center gap-1 text-xs font-medium rounded-lg transition-all border border-[var(--color-text-muted)]/40 text-[var(--color-text-muted)] hover:border-[var(--color-text-primary)]/50 hover:text-[var(--color-text-primary)] flex-shrink-0"
                  >
                    <span className="text-sm">+</span>
                    Post
                  </button>
                </div>
              )}
              {/* Leaderboard mode: Period filters */}
              <div
                className={`flex items-center justify-between gap-2 mb-4 ${viewMode === "community" ? "hidden" : ""}`}
                style={{ height: 34 }}
              >
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Mini Globe Button - Mobile or when Globe is hidden */}
                  <button
                    onClick={() => setIsGlobePanelOpen(true)}
                    className={`rounded-lg glass text-[11px] leading-none font-medium transition-colors items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 flex-shrink-0 ${
                      useCompactRatio ? "flex" : "flex md:hidden"
                    }`}
                    style={{ width: 34, height: 34 }}
                    title="View Global Stats"
                  >
                    🌐
                  </button>

                  {/* Scope Filter - Mobile or when Globe is hidden */}
                  <div
                    className={`glass rounded-lg overflow-hidden flex-shrink-0 ${
                      useCompactRatio ? "flex" : "flex md:hidden"
                    }`}
                    style={{ height: 34 }}
                  >
                    <button
                      onClick={() => setScopeFilter("global")}
                      className={`text-[11px] leading-none font-medium transition-colors flex items-center justify-center ${
                        scopeFilter === "global"
                          ? "bg-[var(--color-claude-coral)]/50 text-[var(--color-claude-coral)]"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                      }`}
                      style={{ width: 34, height: 34 }}
                    >
                      🌍
                    </button>
                    <button
                      onClick={() => setScopeFilter("country")}
                      className={`text-[11px] leading-none font-medium transition-colors flex items-center justify-center ${
                        scopeFilter === "country"
                          ? "bg-emerald-500/50 text-emerald-400"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                      }`}
                      style={{ width: 34, height: 34 }}
                    >
                      <FlagIcon
                        countryCode={currentUserCountry}
                        size="xs"
                        className="flex-shrink-0"
                      />
                    </button>
                  </div>

                  {/* Period Filter - Desktop: buttons, Tablet/Mobile: dropdown */}
                  <div className="hidden lg:flex items-center h-[34px] glass rounded-lg overflow-hidden">
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
                        className={`h-[34px] px-2.5 text-xs font-medium transition-colors ${
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

                {/* Right side - Level Info, My Rank & Sort */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Level Info Hover - Hide on mobile/tablet when custom date is selected */}
                  <div
                    className={`relative ${customDateRange ? "hidden lg:block" : ""}`}
                    onMouseEnter={() => setShowLevelInfo(true)}
                    onMouseLeave={() => setShowLevelInfo(false)}
                  >
                    <div className="h-[34px] w-[34px] rounded-md text-[11px] font-medium transition-colors flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-help">
                      <Info className="w-3.5 h-3.5" />
                    </div>
                    <LevelInfoPopover isOpen={showLevelInfo} />
                  </div>

                  <div className="flex items-center h-[34px] glass rounded-lg overflow-hidden flex-shrink-0">
                    <button
                      onClick={() => setSortBy("cost")}
                      title="Sort by Cost"
                      className={`h-[34px] w-[34px] text-[11px] leading-none font-medium transition-colors flex items-center justify-center ${
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
                      className={`h-[34px] w-[34px] text-[11px] leading-none font-medium transition-colors flex items-center justify-center ${
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

              {/* Error State */}
              {error && !loading && (
                <div className="flex items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="text-4xl">⚠️</span>
                    <p className="text-sm text-[var(--color-text-muted)]">{error}</p>
                    <button
                      onClick={() => fetchLeaderboard()}
                      className="px-4 py-2 text-sm bg-[var(--color-claude-coral)] text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Leaderboard Table - Only in leaderboard mode */}
              {viewMode === "leaderboard" && !error && (
                <div className="flex-1 min-h-0 flex flex-col relative">
                  {/* Subtle loading indicator - thin progress bar at top */}
                  {loading && users.length > 0 && (
                    <div className="absolute top-0 left-0 right-0 z-30 h-0.5 bg-[var(--color-bg-secondary)] rounded-t-2xl overflow-hidden">
                      <div className="h-full w-1/3 bg-[var(--color-claude-coral)] animate-[loading-slide_1s_ease-in-out_infinite]" />
                    </div>
                  )}
                  <div
                    className={`glass !border-0 rounded-t-2xl overflow-hidden flex-1 min-h-0 flex flex-col transition-opacity duration-500 ease-out ${loading && users.length > 0 ? "opacity-70" : "opacity-100"}`}
                  >
                    {/* Scrollable table container - flex-1 on mobile, fixed height on tablet/PC */}
                    <div
                      ref={tableContainerRef}
                      className="overflow-y-auto overflow-x-hidden scrollbar-hide flex-1 md:flex-none"
                      style={scrollContainerStyle}
                    >
                      {/* Load previous indicator */}
                      <div className="py-1">
                        {loadingPrevious && (
                          <div className="flex items-center justify-center gap-2 py-2">
                            <div className="w-4 h-4 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-[var(--color-text-muted)]">
                              Loading previous...
                            </span>
                          </div>
                        )}
                        {hasPrevious && !loadingPrevious && (
                          <div className="flex flex-col items-center gap-1 py-2">
                            <span className="text-[10px] text-[var(--color-text-muted)]/50">
                              ↑ Page {loadedPageRange.start - 1} available
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 📍 My Position - Sticky Top (when user's position is above viewport) */}
                      {!myPositionVisible &&
                        currentUserData &&
                        myPositionDirection === "above" &&
                        (() => {
                          const user = currentUserData;
                          const userCost = user.period_cost || user.total_cost;
                          const userTokens = user.period_tokens || user.total_tokens;
                          const costDisplay =
                            userCost >= 1000
                              ? `$${(userCost / 1000).toFixed(1)}K`
                              : `$${userCost.toFixed(0)}`;
                          const tokenDisplay = formatTokens(userTokens);

                          return (
                            <div
                              onClick={jumpToMyPosition}
                              className="sticky top-0 z-20 bg-[var(--color-bg-primary)] backdrop-blur-xl cursor-pointer hover:bg-[var(--color-bg-secondary)] active:bg-[var(--color-bg-secondary)] transition-colors"
                            >
                              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide px-3 pt-2 pb-1 flex items-center gap-1">
                                <span>📍 My Position</span>
                                <span className="text-[var(--color-text-muted)]/50">↑</span>
                              </div>
                              <div className="flex items-center h-10 bg-[var(--user-country-bg)] border-b border-[var(--color-text-muted)]/30">
                                <div className="w-[36px] md:w-[44px] text-center">
                                  <span className="text-xs font-mono text-[var(--color-text-muted)]">
                                    #{user.rank}
                                  </span>
                                </div>
                                <div className="w-[36px] md:w-[44px] text-center">
                                  {user.country_code && (
                                    <FlagIcon countryCode={user.country_code} size="xs" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-[100px] flex items-center gap-1.5 px-1 md:px-2">
                                  <div className="w-6 lg:w-8 flex items-center justify-center flex-shrink-0">
                                    {user.avatar_url ? (
                                      <Image
                                        src={user.avatar_url}
                                        alt={user.username}
                                        width={24}
                                        height={24}
                                        className="w-6 h-6 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-[#F7931E] flex items-center justify-center text-white text-xs font-semibold">
                                        {user.username.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs font-medium text-[var(--user-country-text)] truncate">
                                    {user.display_name || user.username}
                                    <span className="ml-1 text-[10px]">🟢</span>
                                  </span>
                                </div>
                                {showLevelColumn && (
                                  <div className="w-[70px] text-center">
                                    <LevelBadge tokens={user.total_tokens} />
                                  </div>
                                )}
                                <div className="w-[55px] md:w-[65px] text-right px-0.5 md:px-1">
                                  <span
                                    className={`font-mono text-xs ${sortBy === "tokens" ? "text-[var(--color-text-muted)]" : "text-[var(--color-cost)]"}`}
                                  >
                                    {costDisplay}
                                  </span>
                                </div>
                                <div className="w-[55px] md:w-[65px] text-right pl-0.5 pr-2 md:pr-3">
                                  <span
                                    className={`font-mono text-xs ${sortBy === "cost" ? "text-[var(--color-text-muted)]" : "text-[var(--color-claude-coral)]"}`}
                                  >
                                    {tokenDisplay}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                      {/* Loading State - Table Skeleton */}
                      {loading && users.length === 0 && (
                        <div className="w-full">
                          {/* Skeleton Header */}
                          <div className="h-10 flex items-center border-b border-[var(--border-default)]/30 bg-[var(--color-bg-primary)]">
                            <div className="w-[36px] md:w-[44px] flex justify-center">
                              <div className="w-5 h-5 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />
                            </div>
                            <div className="w-[36px] md:w-[44px] flex justify-center">
                              <div className="w-5 h-5 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />
                            </div>
                            <div className="flex-1 px-2">
                              <div className="w-8 h-5 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />
                            </div>
                            <div className="w-[55px] md:w-[65px] flex justify-end px-1">
                              <div className="w-5 h-5 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />
                            </div>
                            <div className="w-[55px] md:w-[65px] flex justify-end px-2">
                              <div className="w-5 h-5 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />
                            </div>
                          </div>
                          {/* Skeleton Rows */}
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className="h-10 flex items-center border-b border-[var(--border-default)]/30"
                              style={{ opacity: 1 - i * 0.08 }}
                            >
                              <div className="w-[36px] md:w-[44px] flex justify-center">
                                <div className="w-6 h-4 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />
                              </div>
                              <div className="w-[36px] md:w-[44px] flex justify-center">
                                <div className="w-5 h-4 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />
                              </div>
                              <div className="flex-1 flex items-center gap-2 px-2">
                                <div className="w-6 h-6 rounded-full bg-[var(--color-bg-tertiary)] animate-pulse flex-shrink-0" />
                                <div className="w-20 md:w-28 h-4 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />
                              </div>
                              <div className="w-[55px] md:w-[65px] flex justify-end px-1">
                                <div className="w-10 h-4 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />
                              </div>
                              <div className="w-[55px] md:w-[65px] flex justify-end px-2">
                                <div className="w-12 h-4 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Empty State */}
                      {!loading && users.length === 0 && (
                        <div className="flex flex-col items-center gap-3 py-20 text-center">
                          <span className="text-4xl">📭</span>
                          <p className="text-sm text-[var(--color-text-muted)]">No users found</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            Be the first to join the leaderboard!
                          </p>
                        </div>
                      )}

                      {/* Virtualized Table */}
                      {users.length > 0 && (
                        <TableVirtuoso
                          style={{ height: "100%" }}
                          data={users}
                          overscan={200}
                          className="scrollbar-hide"
                          components={{
                            Table: ({ style, ...props }) => (
                              <table
                                {...props}
                                className="w-full table-fixed"
                                style={{ ...style, tableLayout: "fixed" }}
                              />
                            ),
                            TableHead: React.forwardRef(function TableHead(props, ref) {
                              return (
                                <thead
                                  {...props}
                                  ref={ref}
                                  className="sticky top-0 z-10 bg-[var(--glass-bg)] backdrop-blur-md"
                                  style={{ boxShadow: "inset 0 -1px 0 0 rgba(113, 113, 122, 0.3)" }}
                                />
                              );
                            }),
                            TableRow: ({ item: user, ...props }) => {
                              const index = users.findIndex((u) => u.id === user.id);
                              return (
                                <tr
                                  {...props}
                                  ref={user.isCurrentUser ? currentUserRowRef : undefined}
                                  data-user-id={user.id}
                                  onClick={() => handleRowClick(user)}
                                  className={`h-10 transition-colors cursor-pointer hover:!bg-[var(--color-table-row-hover)] border-b border-[var(--border-default)]/30 ${
                                    user.isCurrentUser ? "bg-[var(--user-country-bg)]" : ""
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
                                  }}
                                />
                              );
                            },
                          }}
                          fixedHeaderContent={() => (
                            <tr className="h-10">
                              <th
                                className="w-[36px] md:w-[44px] text-center align-middle text-text-secondary font-medium text-xs px-0.5 md:px-1"
                                title="Rank"
                              >
                                🏆
                              </th>
                              <th
                                className="w-[36px] md:w-[44px] text-center align-middle text-text-secondary font-medium text-xs px-0.5 md:px-1"
                                title="Country"
                              >
                                🌍
                              </th>
                              <th
                                className="min-w-[100px] align-middle text-text-secondary font-medium text-xs px-1 md:px-2"
                                title="User"
                              >
                                <div className="flex items-center">
                                  <div className="w-6 lg:w-8 flex justify-center">👤</div>
                                </div>
                              </th>
                              <th
                                className="text-center align-middle text-text-secondary font-medium text-xs"
                                style={{
                                  width: showLevelColumn ? 70 : 0,
                                  padding: showLevelColumn ? undefined : 0,
                                  visibility: showLevelColumn ? "visible" : "hidden",
                                }}
                                title="Level"
                              >
                                ⭐
                              </th>
                              <th
                                className="w-[55px] md:w-[65px] text-right align-middle text-text-secondary font-medium text-xs px-0.5 md:px-1"
                                title="Cost"
                              >
                                💰
                              </th>
                              <th
                                className="w-[55px] md:w-[65px] text-right align-middle text-text-secondary font-medium text-xs pl-0.5 pr-2 md:pr-4"
                                title="Tokens"
                              >
                                ⚡
                              </th>
                            </tr>
                          )}
                          itemContent={(_index, user) => {
                            const periodTokens = user.period_tokens ?? user.total_tokens;
                            const periodCost = user.period_cost ?? user.total_cost;

                            return (
                              <>
                                <td className="w-[36px] md:w-[44px] px-1 md:px-2 text-center align-middle">
                                  <span className="text-[var(--color-text-muted)] font-mono text-xs leading-none">
                                    #{user.rank}
                                  </span>
                                </td>
                                <td className="w-[36px] md:w-[44px] px-1 text-center align-middle">
                                  {user.country_code && (
                                    <span className="inline-block translate-y-[3px] dark:brightness-[0.85]">
                                      <CountryFlag countryCode={user.country_code} size={16} />
                                    </span>
                                  )}
                                </td>
                                <td className="min-w-[100px] px-1 md:px-2">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-6 lg:w-8 flex items-center justify-center flex-shrink-0">
                                      {user.avatar_url ? (
                                        <Image
                                          src={user.avatar_url}
                                          alt={user.username}
                                          width={32}
                                          height={32}
                                          className="w-6 h-6 rounded-full object-cover dark:brightness-90"
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-[#F7931E] flex items-center justify-center text-white text-xs font-semibold">
                                          {user.username.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                    <span className="text-xs font-medium text-text-primary dark:text-text-primary/90 truncate">
                                      {user.display_name || user.username}
                                    </span>
                                  </div>
                                </td>
                                <td
                                  className="text-center"
                                  style={{
                                    width: showLevelColumn ? 70 : 0,
                                    padding: showLevelColumn ? undefined : 0,
                                    visibility: showLevelColumn ? "visible" : "hidden",
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <LevelBadge tokens={user.total_tokens} />
                                </td>
                                <td className="w-[55px] md:w-[65px] px-0.5 md:px-1 text-right">
                                  <span
                                    className={`font-mono text-xs ${sortBy === "tokens" ? "text-[var(--color-text-muted)]" : "text-[var(--color-cost)]"}`}
                                  >
                                    $
                                    {periodCost >= 1_000_000
                                      ? `${(periodCost / 1_000_000).toFixed(1)}M`
                                      : periodCost >= 1_000
                                        ? `${(periodCost / 1_000).toFixed(1)}K`
                                        : periodCost.toFixed(0)}
                                  </span>
                                </td>
                                <td className="w-[55px] md:w-[65px] pl-0.5 pr-2 md:pr-3 text-right">
                                  <span
                                    className={`font-mono text-xs ${sortBy === "cost" ? "text-[var(--color-text-muted)]" : "text-[var(--color-claude-coral)]"}`}
                                  >
                                    {formatTokens(periodTokens)}
                                  </span>
                                </td>
                              </>
                            );
                          }}
                          endReached={() => {
                            if (hasMore && !loadingMore && !loading) {
                              loadMore();
                            }
                          }}
                          startReached={() => {
                            if (hasPrevious && !loadingPrevious && !loading) {
                              loadPrevious();
                            }
                          }}
                        />
                      )}

                      {/* Load More Indicator */}
                      {loadingMore && (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <div className="w-4 h-4 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-[var(--color-text-muted)]">
                            Loading more...
                          </span>
                        </div>
                      )}

                      {/* End of List Indicator */}
                      {!hasMore && users.length > 0 && !loadingMore && (
                        <div className="flex flex-col items-center gap-2 py-2">
                          <div className="w-16 h-px bg-gradient-to-r from-transparent via-[var(--color-text-muted)]/30 to-transparent" />
                          <span className="text-[10px] text-[var(--color-text-muted)]/50">
                            End of list ({total} users)
                          </span>
                        </div>
                      )}

                      {/* 📍 My Position - Sticky (position based on scroll direction) */}
                      {!myPositionVisible &&
                        currentUserData &&
                        myPositionDirection === "below" &&
                        (() => {
                          const user = currentUserData;
                          const userCost = user.period_cost || user.total_cost;
                          const userTokens = user.period_tokens || user.total_tokens;
                          const costDisplay =
                            userCost >= 1000
                              ? `$${(userCost / 1000).toFixed(1)}K`
                              : `$${userCost.toFixed(0)}`;
                          const tokenDisplay = formatTokens(userTokens);

                          return (
                            <div
                              onClick={jumpToMyPosition}
                              className="sticky bottom-0 z-30 bg-[var(--color-bg-primary)] backdrop-blur-xl border-t border-[var(--color-text-muted)]/30 cursor-pointer hover:bg-[var(--color-bg-secondary)] active:bg-[var(--color-bg-secondary)] transition-colors pb-4"
                            >
                              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide px-3 pt-2 pb-1 flex items-center gap-1">
                                <span>📍 My Position</span>
                                <span className="text-[var(--color-text-muted)]/50">↓</span>
                              </div>
                              <div className="flex items-center h-10 bg-[var(--user-country-bg)]">
                                <div className="w-[36px] md:w-[44px] text-center">
                                  <span className="text-xs font-mono text-[var(--color-text-muted)]">
                                    #{user.rank}
                                  </span>
                                </div>
                                <div className="w-[36px] md:w-[44px] text-center">
                                  {user.country_code && (
                                    <FlagIcon countryCode={user.country_code} size="xs" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-[100px] flex items-center gap-1.5 px-1 md:px-2">
                                  <div className="w-6 lg:w-8 flex items-center justify-center flex-shrink-0">
                                    {user.avatar_url ? (
                                      <Image
                                        src={user.avatar_url}
                                        alt={user.username}
                                        width={24}
                                        height={24}
                                        className="w-6 h-6 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-[#F7931E] flex items-center justify-center text-white text-xs font-semibold">
                                        {user.username.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs font-medium text-[var(--user-country-text)] truncate">
                                    {user.display_name || user.username}
                                    <span className="ml-1 text-[10px]">🟢</span>
                                  </span>
                                </div>
                                {showLevelColumn && (
                                  <div className="w-[70px] text-center">
                                    <LevelBadge tokens={user.total_tokens} />
                                  </div>
                                )}
                                <div className="w-[55px] md:w-[65px] text-right px-0.5 md:px-1">
                                  <span
                                    className={`font-mono text-xs ${sortBy === "tokens" ? "text-[var(--color-text-muted)]" : "text-[var(--color-cost)]"}`}
                                  >
                                    {costDisplay}
                                  </span>
                                </div>
                                <div className="w-[55px] md:w-[65px] text-right pl-0.5 pr-2 md:pr-3">
                                  <span
                                    className={`font-mono text-xs ${sortBy === "cost" ? "text-[var(--color-text-muted)]" : "text-[var(--color-claude-coral)]"}`}
                                  >
                                    {tokenDisplay}
                                  </span>
                                </div>
                              </div>
                              {/* Safe area padding for mobile */}
                              <div className="h-[env(safe-area-inset-bottom,0px)]" />
                            </div>
                          );
                        })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Community Feed - Only in community mode */}
              {viewMode === "community" && !error && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <CommunityFeedSection
                    posts={communityPosts}
                    currentTab={communityTab}
                    onAuthorClick={(authorId) => {
                      // Find user from posts and open profile panel
                      const post = communityPosts.find((p) => p.author.id === authorId);
                      const postUser: DisplayUser = {
                        id: authorId,
                        username: post?.author.username || authorId,
                        display_name: post?.author.display_name || null,
                        avatar_url: post?.author.avatar_url || null,
                        country_code: post?.author.country_code || null,
                        total_tokens: 0,
                        total_cost: 0,
                        rank: 0,
                        current_level: post?.author.level || 1,
                        global_rank: null,
                        country_rank: null,
                      };
                      setSelectedUser(postUser);
                      setIsPanelOpen(true);
                    }}
                    isSignedIn={!!currentUsername}
                    hasSubmissionHistory={(currentUserData?.total_tokens || 0) > 0}
                    canPost={!!currentUsername && (currentUserData?.total_tokens || 0) > 0}
                    userAvatar={currentUserData?.avatar_url}
                    userName={currentUserData?.display_name || currentUserData?.username}
                    userLevel={
                      currentUserData ? Math.floor(currentUserData.total_tokens / 1000000) + 1 : 1
                    }
                    isLoading={communityLoading}
                    isPostModalOpen={isPostModalOpen}
                    onPostModalClose={() => setIsPostModalOpen(false)}
                    onPost={(content, tab) => {
                      handleCreatePost(content, tab);
                      setIsPostModalOpen(false);
                    }}
                    onLike={handleLikePost}
                    onLoginRequired={(action) => {
                      setLoginModalType(action === "like" ? "community_like" : "community_comment");
                      setIsLoginModalOpen(true);
                    }}
                    onSubmissionRequired={() => {
                      setIsSubmissionGuideOpen(true);
                    }}
                    variant="plain"
                    featuredPostId={featuredPostId}
                    onClearFeatured={() => setFeaturedPostId(null)}
                    authorFilter={authorFilter}
                    authorFilterInfo={authorFilterInfo}
                    onClearAuthorFilter={handleClearAuthorFilter}
                    countryFilter={scopeFilter}
                    userCountryCode={currentUserCountry}
                  />
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
        onPostsClick={handlePostsClick}
      />

      {/* Mobile Globe Panel - Left Slide (also used for Community Stats in mobile) */}
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
        viewMode={viewMode}
        communityStats={communityStats}
        hallOfFameData={{
          mostLiked: EMPTY_HALL_OF_FAME,
          mostReplied: EMPTY_HALL_OF_FAME,
        }}
        onHallOfFameUserClick={(userId) => {
          // Find author from community posts
          const post = communityPosts.find((p: FeedPost) => p.author.id === userId);
          if (post) {
            const postUser: DisplayUser = {
              id: userId,
              username: post.author.username,
              display_name: post.author.display_name || null,
              avatar_url: post.author.avatar_url || null,
              country_code: post.author.country_code || null,
              total_tokens: 0,
              total_cost: 0,
              rank: 0,
              current_level: post.author.level,
              global_rank: null,
              country_rank: null,
            };
            setSelectedUser(postUser);
            setIsPanelOpen(true);
            // Also apply author filter to show their posts
            setAuthorFilter(userId);
            setAuthorFilterInfo({
              username: post.author.username,
              displayName: post.author.display_name,
            });
          }
          // Close the mobile panel after opening profile
          setIsGlobePanelOpen(false);
        }}
        onHallOfFamePostClick={(postId) => {
          setFeaturedPostId(postId);
          // Close the mobile panel after selecting featured post
          setIsGlobePanelOpen(false);
        }}
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

      {/* Submission Guide Modal - Explains why submission is needed */}
      {isSubmissionGuideOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsSubmissionGuideOpen(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
            <div
              className="relative w-full max-w-sm bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setIsSubmissionGuideOpen(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <span className="sr-only">Close</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              {/* Content */}
              <div className="p-6 pt-8 text-center">
                <div className="text-4xl mb-3">🚀</div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                  Join the conversation!
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                  Submit your Claude Code usage data to unlock posting and connect with fellow
                  developers.
                </p>

                {/* CTA Button - Opens CLI Modal */}
                <button
                  onClick={() => {
                    setIsSubmissionGuideOpen(false);
                    setIsCLIModalOpen(true);
                  }}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-[var(--color-claude-coral)] to-[var(--color-claude-rust)] hover:opacity-90 text-white rounded-lg font-medium transition-opacity"
                >
                  Get Started with CLI
                </button>

                <button
                  onClick={() => setIsSubmissionGuideOpen(false)}
                  className="mt-4 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  Maybe later
                </button>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-[var(--border-default)] bg-white/[0.02] rounded-b-2xl">
                <p className="text-[10px] text-[var(--color-text-muted)] text-center">
                  Track your AI coding journey and earn community privileges
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* CLI Modal - Shows how to use CLI */}
      <CLIModal isOpen={isCLIModalOpen} onClose={() => setIsCLIModalOpen(false)} />

      {/* Login Modal - For non-logged-in users */}
      <LoginPromptModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        type={loginModalType}
      />
    </div>
  );
}
