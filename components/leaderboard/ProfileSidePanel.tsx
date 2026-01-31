"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Github, Linkedin, Globe, Newspaper } from "lucide-react";
import { useRouter } from "next/navigation";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { useUser } from "@clerk/nextjs";
import { LoginPromptModal } from "./LoginPromptModal";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { LEVELS, getLevelByTokens } from "@/lib/constants/levels";
import { BADGES, type Badge } from "@/lib/constants/badges";
import { ActivityHeatmap } from "@/components/profile/ActivityHeatmap";
import { CCplanBadge } from "@/components/leaderboard/CCplanBadge";
import { useUserProfilePanel } from "@/hooks/use-user-profile";
import type {
  LeaderboardUser,
  UsageHistoryPoint,
  PeriodFilter,
  ScopeFilter,
  SocialLinks,
} from "@/lib/types";
import type { CCPlanFilter } from "@/lib/types/leaderboard";

// Extended user type for panel display
interface DisplayUser extends LeaderboardUser {
  rank: number;
  isCurrentUser?: boolean;
}

function formatTokens(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatShortTokens(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(0)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toString();
}

// Custom tooltip for the chart
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (active && payload && payload.length > 0 && payload[0]) {
    return (
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg px-2 py-1.5 shadow-lg">
        <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
        <p className="text-xs font-medium text-[var(--color-text-primary)]">
          {formatTokens(payload[0].value)} tokens
        </p>
      </div>
    );
  }
  return null;
}

// Aggregate data by month
function aggregateByMonth(data: UsageHistoryPoint[]): { date: string; tokens: number }[] {
  const monthMap = new Map<string, number>();

  data.forEach((day) => {
    const monthKey = day.date.slice(0, 7);
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + day.tokens);
  });

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, tokens]) => ({
      date: month.slice(2),
      tokens,
    }));
}

// Line chart for usage history
function UsageChart({
  history,
  periodFilter,
}: {
  history: UsageHistoryPoint[];
  periodFilter: PeriodFilter;
}) {
  const days =
    periodFilter === "1d"
      ? 1
      : periodFilter === "7d"
        ? 7
        : periodFilter === "30d"
          ? 30
          : history.length;
  const filteredData = history.slice(-days);
  const useMonthly = filteredData.length > 60;

  const chartData = useMonthly
    ? aggregateByMonth(filteredData)
    : filteredData.map((day) => ({
        date: day.date.slice(5),
        tokens: day.tokens,
      }));

  // Don't render chart if no data
  if (chartData.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-[var(--color-text-muted)] text-xs">
        No data for this period
      </div>
    );
  }

  return (
    <div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%" minHeight={128}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#71717A", fontSize: 9 }}
              interval={
                periodFilter === "1d"
                  ? 0
                  : periodFilter === "7d"
                    ? 0
                    : periodFilter === "30d"
                      ? 6
                      : useMonthly
                        ? Math.max(0, Math.floor(chartData.length / 6) - 1)
                        : chartData.length <= 14
                          ? 0
                          : Math.floor(chartData.length / 5)
              }
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#71717A", fontSize: 9 }}
              tickFormatter={formatShortTokens}
              width={35}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="tokens"
              stroke="#DA7756"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#DA7756", stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Format level range for display
function formatLevelRange(min: number, max: number): string {
  const formatNum = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(0)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
  };

  if (max === Infinity) return `${formatNum(min)}+`;
  return `${formatNum(min)} ~ ${formatNum(max)}`;
}

// Level progress bar with hover tooltips and animation
type Level = (typeof LEVELS)[number];

function LevelProgressBar({
  currentTokens,
  level,
  nextLevel,
  progressToNext,
  userId,
}: {
  currentTokens: number;
  level: Level;
  nextLevel: Level | undefined;
  progressToNext: number;
  userId: string;
}) {
  const [hoveredPart, setHoveredPart] = useState<"filled" | "empty" | null>(null);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  const tokensInCurrentLevel = currentTokens - level.minTokens;
  const tokensToNextLevel = nextLevel ? nextLevel.minTokens - currentTokens : 0;

  useEffect(() => {
    setAnimatedProgress(0);

    const duration = 400;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic: smoother deceleration at the end
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setAnimatedProgress(easedProgress * progressToNext);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [userId, progressToNext]);

  return (
    <div className="mb-4 p-3 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)]">
      <div className="flex items-center justify-between text-[10px] mb-1.5">
        <span className="text-[var(--color-text-secondary)]">
          {level.icon} {level.name} (Lv.{level.level})
        </span>
        {nextLevel && (
          <span className="text-[var(--color-text-muted)]">
            → {nextLevel.icon} {nextLevel.name}
          </span>
        )}
      </div>

      <div className="relative h-2.5 bg-white/10 rounded-full overflow-visible border border-[var(--border-default)]">
        <div
          className="absolute top-0 left-0 h-full bg-[var(--color-claude-coral)] rounded-l-full cursor-pointer"
          style={{ width: `${Math.min(animatedProgress, 100)}%` }}
          onMouseEnter={() => setHoveredPart("filled")}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {nextLevel && (
          <div
            className="absolute top-0 right-0 h-full cursor-pointer"
            style={{ width: `${100 - Math.min(animatedProgress, 100)}%` }}
            onMouseEnter={() => setHoveredPart("empty")}
            onMouseLeave={() => setHoveredPart(null)}
          />
        )}

        {hoveredPart === "filled" && (
          <div className="absolute bottom-full left-1/4 -translate-x-1/2 mb-2 z-50 px-2 py-1 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg whitespace-nowrap">
            <div className="text-[10px] text-[var(--color-text-muted)]">Current Level Progress</div>
            <div className="text-xs font-medium text-[var(--color-claude-coral)]">
              {formatTokens(tokensInCurrentLevel)} tokens
            </div>
          </div>
        )}

        {hoveredPart === "empty" && nextLevel && (
          <div className="absolute bottom-full right-1/4 translate-x-1/2 mb-2 z-50 px-2 py-1 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg whitespace-nowrap">
            <div className="text-[10px] text-[var(--color-text-muted)]">To Next Level</div>
            <div className="text-xs font-medium text-[var(--color-text-primary)]">
              {formatTokens(tokensToNextLevel)} tokens
            </div>
          </div>
        )}
      </div>

      <div className="text-[9px] text-[var(--color-text-muted)] mt-1.5">
        Current Range:{" "}
        <span className="text-[var(--color-text-secondary)]">
          {formatLevelRange(level.minTokens, level.maxTokens)}
        </span>{" "}
        ({level.name})
      </div>
    </div>
  );
}

// Convert country code to flag emoji
function countryCodeToFlag(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

// Single badge with hover popover
function BadgeItem({
  badge,
  isEarned,
  columnIndex,
  totalInCategory: _totalInCategory,
  userCountry,
  isMobile,
}: {
  badge: Badge;
  isEarned: boolean;
  columnIndex: number;
  totalInCategory: number;
  userCountry?: string;
  isMobile?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });

  const RARITY_TEXT_COLOR = "text-[var(--color-text-primary)]";

  const RARITY_BG_COLORS: Record<Badge["rarity"], string> = {
    common: "bg-gray-500/20",
    rare: "bg-blue-500/20",
    epic: "bg-purple-500/20",
    legendary: "bg-[var(--color-claude-coral)]/30",
  };

  // Mobile: 1-2열 우측, 3열 위, 4-5열 좌측 / Desktop: 항상 좌측
  const popoverDirection = isMobile
    ? columnIndex <= 1
      ? "right"
      : columnIndex === 2
        ? "top"
        : "left"
    : "left";

  // Ensure portal renders only on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const showPopover = () => {
    if (!badgeRef.current) return;

    const rect = badgeRef.current.getBoundingClientRect();
    const popoverWidth = 192;
    const popoverHeight = 140;
    const gap = 8;

    let top = 0;
    let left = 0;

    if (popoverDirection === "left") {
      top = rect.top + rect.height / 2 - popoverHeight / 2;
      left = rect.left - popoverWidth - gap;
    } else if (popoverDirection === "right") {
      top = rect.top + rect.height / 2 - popoverHeight / 2;
      left = rect.right + gap;
    } else {
      top = rect.top - popoverHeight - gap;
      left = rect.left + rect.width / 2 - popoverWidth / 2;
    }

    // Ensure popover stays within viewport bounds
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 8) left = 8;
    if (left + popoverWidth > viewportWidth - 8) left = viewportWidth - popoverWidth - 8;
    if (top < 8) top = 8;
    if (top + popoverHeight > viewportHeight - 8) top = viewportHeight - popoverHeight - 8;

    setPopoverPosition({ top, left });
    setIsHovered(true);
  };

  const hidePopover = () => {
    setIsHovered(false);
  };

  const popoverContent = isHovered && isMounted && (
    <div
      className="fixed w-48 p-2.5 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-xl"
      style={{
        top: popoverPosition.top,
        left: popoverPosition.left,
        zIndex: 99999,
      }}
    >
      {/* Arrow pointing to badge */}
      <div
        className={`absolute ${
          popoverDirection === "left"
            ? "top-1/2 -translate-y-1/2 -right-[15px]"
            : popoverDirection === "right"
              ? "top-1/2 -translate-y-1/2 -left-[15px]"
              : "-bottom-[15px] left-1/2 -translate-x-1/2"
        }`}
      >
        <div
          className={`border-8 border-transparent ${
            popoverDirection === "left"
              ? "border-l-[var(--color-bg-secondary)]"
              : popoverDirection === "right"
                ? "border-r-[var(--color-bg-secondary)]"
                : "border-t-[var(--color-bg-secondary)]"
          }`}
        />
      </div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-lg">
          {badge.id === "country_first" && userCountry
            ? countryCodeToFlag(userCountry)
            : badge.icon}
        </span>
        <div>
          <div className="text-xs font-medium text-[var(--color-text-primary)]">{badge.name}</div>
          <span
            className={`inline-block text-[9px] font-medium capitalize px-1.5 py-0.5 rounded ${RARITY_BG_COLORS[badge.rarity]} ${RARITY_TEXT_COLOR}`}
          >
            {badge.rarity}
          </span>
        </div>
      </div>
      <div className="text-[10px] text-[var(--color-text-secondary)] mb-1.5 bg-black/20 px-1.5 py-1 rounded">
        {badge.description}
      </div>
      <div
        className={`text-[10px] ${isEarned ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"}`}
      >
        {isEarned ? `${badge.praise}` : "Not yet unlocked"}
      </div>
    </div>
  );

  return (
    <div
      ref={badgeRef}
      className="relative"
      onMouseEnter={() => !isMobile && showPopover()}
      onMouseLeave={() => !isMobile && hidePopover()}
      onTouchStart={() => isMobile && showPopover()}
      onTouchEnd={() => isMobile && hidePopover()}
    >
      <div
        className={`w-full aspect-square flex items-center justify-center rounded text-center transition-colors cursor-default ${
          isEarned
            ? `bg-[var(--color-section-bg)] hover:bg-[var(--color-section-bg-hover)]`
            : "bg-[var(--color-badge-locked)]"
        }`}
      >
        <div className={`text-lg ${!isEarned ? "grayscale opacity-40" : ""}`}>
          {isEarned
            ? badge.id === "country_first" && userCountry
              ? countryCodeToFlag(userCountry)
              : badge.icon
            : "🔒"}
        </div>
      </div>

      {/* Render popover in portal to escape overflow constraints */}
      {isMounted && popoverContent && createPortal(popoverContent, document.body)}
    </div>
  );
}

// X (formerly Twitter) icon component
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Social Links Quick Access (Header Icons) - Brand Colors Applied
function SocialLinksQuickAccess({
  socialLinks,
  isSignedIn,
  onLoginRequired,
  userId,
  onPostsClick,
  postCount = 0,
}: {
  socialLinks: SocialLinks | null | undefined;
  isSignedIn: boolean;
  onLoginRequired: (url: string) => void;
  userId?: string;
  onPostsClick?: (userId: string) => void;
  postCount?: number;
}) {
  const links = [
    {
      key: "github",
      icon: Github,
      prefix: "https://github.com/",
      color: "text-[#a855f7]", // GitHub purple accent
      hoverColor: "hover:bg-[#a855f7]/20",
    },
    {
      key: "twitter",
      icon: XIcon,
      prefix: "https://x.com/",
      color: "text-[#1DA1F2]", // Twitter classic blue
      hoverColor: "hover:bg-[#1DA1F2]/20",
    },
    {
      key: "linkedin",
      icon: Linkedin,
      prefix: "https://linkedin.com/in/",
      color: "text-[#0A66C2]", // LinkedIn brand blue
      hoverColor: "hover:bg-[#0A66C2]/20",
    },
    {
      key: "website",
      icon: Globe,
      prefix: "",
      color: "text-emerald-400", // Custom website color
      hoverColor: "hover:bg-emerald-400/20",
    },
  ] as const;

  const activeLinks = socialLinks
    ? links.filter((link) => {
        const value = socialLinks[link.key as keyof SocialLinks];
        return value && value.trim() !== "";
      })
    : [];

  const getFullUrl = (link: (typeof links)[number], value: string): string => {
    if (link.key === "website") {
      return value.startsWith("http") ? value : `https://${value}`;
    }
    // For github, twitter, linkedin - just prepend the prefix
    return `${link.prefix}${value.replace(/^@/, "")}`;
  };

  const handleClick = (e: React.MouseEvent, url: string) => {
    if (!isSignedIn) {
      e.preventDefault();
      onLoginRequired(url);
    }
  };

  const handlePostsClick = () => {
    if (userId && onPostsClick) {
      onPostsClick(userId);
    }
  };

  // Show nothing if no social links AND no posts button
  if (activeLinks.length === 0 && !userId) return null;

  return (
    <div className="flex items-center gap-0.5">
      {activeLinks.map((link) => {
        const value = socialLinks?.[link.key as keyof SocialLinks] || "";
        const Icon = link.icon;
        const url = getFullUrl(link, value);

        return (
          <a
            key={link.key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`p-1.5 rounded-md transition-all ${link.color} ${link.hoverColor}`}
            title={link.key === "website" ? new URL(url).hostname : value}
            onClick={(e) => handleClick(e, url)}
          >
            <Icon className="w-3.5 h-3.5" />
          </a>
        );
      })}
      {/* Posts link - only visible when user has posts */}
      {userId && onPostsClick && postCount > 0 && (
        <button
          onClick={handlePostsClick}
          className="p-1.5 rounded-md transition-all text-[var(--color-claude-coral)] hover:bg-[var(--color-claude-coral)]/20"
          title={`View posts (${postCount})`}
        >
          <Newspaper className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// Category labels with icons
const CATEGORY_LABELS: Record<Badge["category"], { icon: string; label: string; bgTint: string }> =
  {
    streak: { icon: "🔥", label: "Streak", bgTint: "bg-orange-500/5" },
    tokens: { icon: "💎", label: "Tokens", bgTint: "bg-blue-500/5" },
    rank: { icon: "🏆", label: "Rank", bgTint: "bg-yellow-500/5" },
    model: { icon: "🎭", label: "Model", bgTint: "bg-purple-500/5" },
    social: { icon: "🤝", label: "Social", bgTint: "bg-emerald-500/5" },
  };

// Rarity order for sorting
const RARITY_ORDER: Record<Badge["rarity"], number> = {
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

// Badge categories (defined outside component for stable reference)
const BADGE_CATEGORIES: Badge["category"][] = ["streak", "tokens", "rank", "model", "social"];

// Badge display component
function BadgeGrid({
  badgeIds,
  userCountry,
  isMobile,
}: {
  badgeIds: string[];
  userCountry: string;
  isMobile?: boolean;
}) {
  const badgesByCategory = useMemo(() => {
    return BADGE_CATEGORIES.map((category) => ({
      category,
      badges: BADGES.filter((b) => b.category === category).sort(
        (a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]
      ),
    }));
  }, []);

  const maxBadges = Math.max(...badgesByCategory.map((c) => c.badges.length));

  return (
    <div className="flex gap-1">
      {badgesByCategory.map(({ category, badges }, colIndex) => {
        const { icon, bgTint } = CATEGORY_LABELS[category];

        return (
          <div key={category} className={`flex-1 flex flex-col gap-1 p-1 rounded-lg ${bgTint}`}>
            <div className="text-center text-[10px] pb-0.5">{icon}</div>
            {badges.map((badge) => (
              <BadgeItem
                key={badge.id}
                badge={badge}
                isEarned={badgeIds.includes(badge.id)}
                columnIndex={colIndex}
                totalInCategory={5}
                userCountry={userCountry}
                isMobile={isMobile}
              />
            ))}
            {Array.from({ length: maxBadges - badges.length }).map((_, i) => (
              <div key={`empty-${i}`} className="w-full aspect-square" />
            ))}
          </div>
        );
      })}
    </div>
  );
}

interface ProfileSidePanelProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  periodFilter: PeriodFilter;
  scopeFilter: ScopeFilter;
  onPostsClick?: (userId: string) => void;
}

// Profile view tracking for non-logged-in users
const PROFILE_VIEW_LIMIT = 3;
const STORAGE_KEY = "ccgather_profile_views";

function getProfileViewCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return 0;
    const parsed = JSON.parse(data);
    // Reset if it's been more than 24 hours
    if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return 0;
    }
    return parsed.count || 0;
  } catch {
    return 0;
  }
}

function incrementProfileViewCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const current = getProfileViewCount();
    const newCount = current + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: newCount, timestamp: Date.now() }));
    return newCount;
  } catch {
    return 0;
  }
}

export function ProfileSidePanel({
  userId,
  isOpen,
  onClose,
  periodFilter,
  scopeFilter,
  onPostsClick: externalPostsClick,
}: ProfileSidePanelProps) {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isTabletPortrait, setIsTabletPortrait] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [showCompactStats, setShowCompactStats] = useState(false);
  const [chartFadeIn, setChartFadeIn] = useState(true);

  // Login prompt modal state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalType, setLoginModalType] = useState<"social_link" | "profile_limit">(
    "social_link"
  );
  const [pendingSocialUrl, setPendingSocialUrl] = useState<string | null>(null);

  // React Query: Fetch all user data with caching
  const {
    profile,
    usageHistory,
    badges: userBadges,
    isProfileLoading,
  } = useUserProfilePanel(userId, { enabled: isOpen });

  // Convert profile to DisplayUser format
  const displayedUser: DisplayUser | null = useMemo(() => {
    if (!profile) return null;
    return {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      country_code: profile.country_code,
      total_tokens: profile.total_tokens || 0,
      total_cost: profile.total_cost || 0,
      total_sessions: profile.total_sessions || 0,
      rank: profile.global_rank || 0,
      current_level: profile.current_level || 1,
      global_rank: profile.global_rank,
      country_rank: profile.country_rank,
      social_links: profile.social_links,
      ccplan: profile.ccplan,
      has_opus_usage: profile.has_opus_usage || false,
      post_count: profile.post_count || 0,
    };
  }, [profile]);

  // Fresh social links from profile
  const freshSocialLinks = profile?.social_links ?? null;

  // Handle social link click for non-logged-in users
  const handleSocialLinkLoginRequired = useCallback((url: string) => {
    setPendingSocialUrl(url);
    setLoginModalType("social_link");
    setShowLoginModal(true);
  }, []);

  // Handle "continue as guest" - open the social link
  const handleContinueAsGuest = useCallback(() => {
    if (pendingSocialUrl) {
      window.open(pendingSocialUrl, "_blank", "noopener,noreferrer");
    }
    setShowLoginModal(false);
    setPendingSocialUrl(null);
  }, [pendingSocialUrl]);

  // Handle posts click - use external handler if provided, otherwise navigate
  const handlePostsClick = useCallback(
    (userId: string) => {
      onClose(); // Close panel first for smooth transition
      if (externalPostsClick) {
        externalPostsClick(userId);
      } else {
        router.push(`/community?author=${userId}`);
      }
    },
    [onClose, externalPostsClick, router]
  );

  // Check profile view limit for non-logged-in users
  useEffect(() => {
    if (!isOpen || !userId || isSignedIn) return;

    // Check if this is a new profile view
    const viewCount = getProfileViewCount();
    if (viewCount >= PROFILE_VIEW_LIMIT) {
      // Show login prompt after limit reached
      setLoginModalType("profile_limit");
      setShowLoginModal(true);
    } else {
      // Increment view count
      incrementProfileViewCount();
    }
  }, [isOpen, userId, isSignedIn]);

  // Only mobile uses overlay mode, tablet uses push mode
  const isOverlayPanel = isMobile;

  // Detect viewport size - 3-tier breakpoint system
  // Mobile: < 640px | Tablet: 640-1039px | PC: >= 1040px
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 640);
      setIsTabletPortrait(width >= 640 && width < 1040);
      setIsNarrow(width < 400);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Handle chart fade animation when data changes
  useEffect(() => {
    if (isProfileLoading) {
      setChartFadeIn(false);
    } else if (profile) {
      requestAnimationFrame(() => {
        setChartFadeIn(true);
      });
    }
  }, [isProfileLoading, profile]);

  // Reset scroll position when userId changes
  useEffect(() => {
    if (userId) {
      setShowCompactStats(false);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [userId]);

  // Note: Panel data clearing is now handled by React Query
  // When userId changes, useMemo recalculates displayedUser from fresh profile

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
    return undefined;
  }, [isOpen, onClose]);

  // Click outside handler
  useEffect(() => {
    if (isOverlayPanel) return undefined;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside the panel
      if (panelRef.current?.contains(target)) return;
      // Don't close if clicking on table rows (leaderboard)
      if (target.closest("tr") || target.closest("table")) return;
      // Don't close if clicking on interactive elements (buttons, inputs, etc.)
      if (
        target.closest("button, input, textarea, [role='button'], [role='dialog'], [role='menu']")
      )
        return;
      // Don't close if clicking on community feed or modals
      if (target.closest("[data-feed-card], [data-modal], .glass, article")) return;
      onClose();
    }

    if (isOpen) {
      const timer = setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("click", handleClickOutside);
      };
    }
    return undefined;
  }, [isOpen, onClose, isOverlayPanel]);

  // Body scroll prevention
  useEffect(() => {
    if (isOverlayPanel && isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    return undefined;
  }, [isOverlayPanel, isOpen]);

  // Compact stats detection
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const statsElement = statsRef.current;

    if (!scrollContainer || !statsElement) return undefined;

    const handleScroll = () => {
      const statsRect = statsElement.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      setShowCompactStats(statsRect.bottom < containerRect.top + 10);
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [displayedUser]);

  const currentUser = displayedUser;

  // Show loading state when userId exists but data hasn't loaded yet
  if (!currentUser && userId && isProfileLoading) {
    return (
      <>
        {isOverlayPanel && (
          <div
            className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden ${
              isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
            onClick={onClose}
          />
        )}
        <div
          ref={panelRef}
          className={`fixed top-12 right-0 flex flex-col bg-[var(--color-bg-primary)] border-l md:border-t border-[var(--border-default)] z-50 shadow-2xl will-change-transform transition-transform duration-200 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
          style={{
            width: isMobile ? "calc(100% - 56px)" : isTabletPortrait ? "320px" : "440px",
            maxWidth: isMobile ? "calc(100% - 56px)" : isTabletPortrait ? "320px" : "440px",
            height: "calc(100% - 48px)",
          }}
        >
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-[var(--color-text-muted)]">Loading profile...</div>
          </div>
        </div>
      </>
    );
  }

  if (!currentUser) return null;

  const level = getLevelByTokens(currentUser.total_tokens);
  const nextLevel = LEVELS.find((l) => l.level === level.level + 1);
  const progressToNext = nextLevel
    ? ((currentUser.total_tokens - level.minTokens) / (nextLevel.minTokens - level.minTokens)) * 100
    : 100;

  const countryRank = currentUser.country_rank || currentUser.rank;

  // Use currentUser data directly for instant display (no API wait)
  // period_tokens/period_cost come from leaderboard API, total_tokens/total_cost for "all" filter
  const periodTokens =
    periodFilter === "all"
      ? currentUser.total_tokens
      : (currentUser.period_tokens ?? currentUser.total_tokens);
  const periodCost =
    periodFilter === "all"
      ? currentUser.total_cost
      : (currentUser.period_cost ?? currentUser.total_cost);

  // Calculate average from history (this can load async)
  const days =
    periodFilter === "1d"
      ? 1
      : periodFilter === "7d"
        ? 7
        : periodFilter === "30d"
          ? 30
          : usageHistory.length;
  const filteredHistory = usageHistory.slice(-days);
  const avgDailyTokens =
    filteredHistory.length > 0
      ? filteredHistory.reduce((sum, day) => sum + day.tokens, 0) / filteredHistory.length
      : 0;

  return (
    <>
      {isOverlayPanel && (
        <div
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden ${
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={onClose}
        />
      )}

      <div
        ref={panelRef}
        className={`fixed top-12 right-0 flex flex-col bg-[var(--color-bg-primary)] border-l md:border-t border-[var(--border-default)] z-50 shadow-2xl will-change-transform transition-transform duration-200 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{
          width: isMobile ? "calc(100% - 56px)" : isTabletPortrait ? "320px" : "440px",
          maxWidth: isMobile ? "calc(100% - 56px)" : isTabletPortrait ? "320px" : "440px",
          height: "calc(100% - 48px)",
        }}
      >
        {/* Fixed Header Area */}
        <div className="flex-shrink-0">
          {/* Profile Header */}
          <div className="p-4 pb-3 border-b border-[var(--border-default)] bg-[var(--color-bg-primary)]">
            <div className="flex items-start gap-3">
              {/* Avatar with country flag overlay */}
              <div className="relative flex-shrink-0">
                {currentUser.avatar_url ? (
                  <Image
                    src={currentUser.avatar_url}
                    alt={currentUser.username}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-[#F7931E] flex items-center justify-center text-lg font-semibold text-white">
                    {currentUser.username.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Country flag on bottom-right of avatar */}
                {currentUser.country_code && (
                  <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[var(--color-bg-primary)] p-0.5">
                    <FlagIcon countryCode={currentUser.country_code} size="sm" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {/* Name row with badges on right */}
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                    {currentUser.display_name || currentUser.username}
                  </h2>
                  {/* Level + CCplan badges - right aligned */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        level.level === 5 || level.level === 6 ? `level-badge-${level.level}` : ""
                      }`}
                      style={
                        level.level !== 5 && level.level !== 6
                          ? { backgroundColor: `${level.color}20`, color: level.color }
                          : undefined
                      }
                    >
                      {level.icon} Lv.{level.level}
                    </span>
                    {currentUser.ccplan && (
                      <CCplanBadge
                        ccplan={currentUser.ccplan as Exclude<CCPlanFilter, "all">}
                        size="sm"
                      />
                    )}
                  </div>
                </div>
                {/* Username row with social links */}
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    @{currentUser.username.toLowerCase().replace(/\s+/g, "")}
                  </p>
                  {/* Social Links - same row as username */}
                  <SocialLinksQuickAccess
                    socialLinks={freshSocialLinks || currentUser.social_links}
                    isSignedIn={!!isSignedIn}
                    onLoginRequired={handleSocialLinkLoginRequired}
                    userId={currentUser.id}
                    onPostsClick={handlePostsClick}
                    postCount={currentUser.post_count || 0}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Compact Stats Bar */}
          <div
            className={`overflow-hidden transition-all duration-100 ease-out ${
              showCompactStats ? "max-h-16 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="px-3 py-2">
              <div className="flex items-center py-1.5 px-2 bg-[var(--color-section-bg)] border border-[var(--border-default)] rounded-full text-[11px]">
                <div className="flex-1 flex items-center justify-center gap-1">
                  <span>🌍</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    #{currentUser.global_rank || currentUser.rank}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1">
                  {currentUser.country_code && (
                    <FlagIcon countryCode={currentUser.country_code} size="xs" />
                  )}
                  <span className="font-medium text-[var(--color-text-primary)]">
                    #{countryRank}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1">
                  <span>💻</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {(currentUser.total_sessions || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1">
                  <span>💰</span>
                  <span className="font-medium text-[var(--color-cost)]">
                    ${formatTokens(periodCost)}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1">
                  <span>⚡</span>
                  <span className="font-medium text-[var(--color-claude-coral)]">
                    {formatTokens(periodTokens)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div ref={scrollContainerRef} className="p-4 overflow-y-auto flex-1">
          {/* Level Progress */}
          <LevelProgressBar
            currentTokens={currentUser.total_tokens}
            level={level}
            nextLevel={nextLevel}
            progressToNext={progressToNext}
            userId={currentUser.id}
          />

          {/* Stats Grid - New Layout: Top row 1:1:2, Bottom row 1:1 */}
          <div
            ref={statsRef}
            className="grid grid-cols-6 gap-2 mb-4"
            key={`stats-${currentUser.id}`}
          >
            {/* Global Rank */}
            <div
              className={`col-span-2 p-3 rounded-lg transition-all border ${
                scopeFilter === "global"
                  ? "bg-[var(--color-scope-active-bg)] border-[var(--color-claude-coral)]/40"
                  : "bg-[var(--color-section-bg)] border-[var(--border-default)]"
              }`}
            >
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5 flex items-center gap-1">
                🌍 Global
              </div>
              <div
                className={`font-semibold text-[var(--color-text-primary)] ${isNarrow ? "text-sm" : "text-base"}`}
              >
                #{(currentUser.global_rank || currentUser.rank).toLocaleString()}
              </div>
            </div>
            {/* Country Rank */}
            <div
              className={`col-span-2 p-3 rounded-lg transition-all border ${
                scopeFilter === "country"
                  ? "bg-[var(--color-scope-active-bg)] border-[var(--color-claude-coral)]/40"
                  : "bg-[var(--color-section-bg)] border-[var(--border-default)]"
              }`}
            >
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5 flex items-center gap-1">
                {currentUser.country_code && (
                  <FlagIcon countryCode={currentUser.country_code} size="xs" />
                )}
                Country
              </div>
              <div
                className={`font-semibold text-[var(--color-text-primary)] ${isNarrow ? "text-sm" : "text-base"}`}
              >
                #{countryRank.toLocaleString()}
              </div>
            </div>
            {/* Sessions */}
            <div className="col-span-2 p-3 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)]">
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">💻 Sessions</div>
              <div
                className={`font-semibold text-[var(--color-text-primary)] ${isNarrow ? "text-sm" : "text-base"}`}
              >
                {(currentUser.total_sessions || 0).toLocaleString()}
              </div>
            </div>
            {/* Cost */}
            <div className="col-span-3 p-3 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)]">
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">💰 Costs</div>
              <div className="font-medium text-base text-[var(--color-cost)]">
                $
                {periodCost >= 1_000_000
                  ? `${(periodCost / 1_000_000).toFixed(1)}M`
                  : periodCost >= 1_000
                    ? `${(periodCost / 1_000).toFixed(1)}K`
                    : periodCost.toFixed(0)}
              </div>
            </div>
            {/* Tokens */}
            <div className="col-span-3 p-3 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)]">
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">⚡ Tokens</div>
              <div className="font-medium text-base text-[var(--color-claude-coral)]">
                {formatTokens(periodTokens)}
              </div>
            </div>
          </div>

          {/* Usage Chart */}
          <div className="mb-4 p-3 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
                📈 Usage History
              </div>
              <div className="text-[9px] text-[var(--color-text-muted)]">
                {periodFilter === "1d"
                  ? "Today"
                  : periodFilter === "7d"
                    ? "Last 7 days"
                    : periodFilter === "30d"
                      ? "Last 30 days"
                      : usageHistory.length > 60
                        ? "All Time (Monthly)"
                        : "All Time"}
              </div>
            </div>
            <div
              key={`chart-${currentUser.id}`}
              className={`transition-opacity duration-200 ${chartFadeIn ? "opacity-100" : "opacity-0"}`}
            >
              <UsageChart history={usageHistory} periodFilter={periodFilter} />
            </div>
            <div className="text-[11px] text-[var(--color-text-secondary)] mt-2 pt-2 border-t border-[var(--border-default)] text-center">
              Avg Daily:{" "}
              <span className="font-medium text-[var(--color-claude-coral)]">
                {formatTokens(Math.round(avgDailyTokens))}
              </span>{" "}
              tokens
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className="mb-4 px-4 py-3 pt-6 pb-6 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)]">
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
              📅 Activity (Last Year)
            </div>
            <div
              key={`heatmap-${currentUser.id}`}
              className={`transition-opacity duration-200 ${chartFadeIn ? "opacity-100" : "opacity-0"}`}
            >
              <ActivityHeatmap data={usageHistory} periodDays={365} />
            </div>
          </div>

          {/* Badges */}
          <div className="p-3 pb-24 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)] overflow-visible">
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
              🏅 Badges ({userBadges.length}/{BADGES.length})
            </div>
            <div className="overflow-visible">
              <BadgeGrid
                badgeIds={userBadges}
                userCountry={currentUser.country_code || "US"}
                isMobile={isMobile}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Login Prompt Modal */}
      <LoginPromptModal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          setPendingSocialUrl(null);
          // If it was profile limit modal, close the panel too
          if (loginModalType === "profile_limit") {
            onClose();
          }
        }}
        type={loginModalType}
        onContinueAsGuest={loginModalType === "social_link" ? handleContinueAsGuest : undefined}
      />
    </>
  );
}

export default ProfileSidePanel;
