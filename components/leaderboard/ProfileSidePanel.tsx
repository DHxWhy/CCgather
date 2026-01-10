"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { X as CloseIcon, Github, Linkedin, Globe } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
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
import { RollingNumber } from "@/components/ui/RollingNumber";
import { CCplanBadge } from "@/components/leaderboard/CCplanBadge";
import type {
  LeaderboardUser,
  UsageHistoryPoint,
  PeriodFilter,
  ScopeFilter,
  CCPlanFilter,
  SocialLinks,
} from "@/lib/types";

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
    periodFilter === "today"
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

  return (
    <div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#71717A", fontSize: 9 }}
              interval={
                periodFilter === "today"
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

    const duration = 1500;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = progress * progress;
      setAnimatedProgress(easedProgress * progressToNext);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const timer = setTimeout(() => {
      requestAnimationFrame(animate);
    }, 100);

    return () => clearTimeout(timer);
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
}: {
  badge: Badge;
  isEarned: boolean;
  columnIndex: number;
  totalInCategory: number;
  userCountry?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const RARITY_TEXT_COLOR = "text-[var(--color-text-primary)]";

  const RARITY_BG_COLORS: Record<Badge["rarity"], string> = {
    common: "bg-gray-500/20",
    rare: "bg-blue-500/20",
    epic: "bg-purple-500/20",
    legendary: "bg-[var(--color-claude-coral)]/30",
  };

  // Show popover on the left side of the badge for easier vertical navigation
  const isRightColumn = columnIndex >= 3; // Right half of 5 columns

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`w-full aspect-square flex items-center justify-center rounded text-center transition-colors cursor-default ${
          isEarned
            ? `bg-[var(--color-section-bg)] hover:bg-white/10`
            : "bg-[var(--color-section-bg)] opacity-50"
        }`}
      >
        <div className={`text-lg ${!isEarned ? "grayscale" : ""}`}>
          {isEarned
            ? badge.id === "country_first" && userCountry
              ? countryCodeToFlag(userCountry)
              : badge.icon
            : "🔒"}
        </div>
      </div>

      {isHovered && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 z-[100] w-48 p-2.5 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-xl ${
            isRightColumn ? "right-full mr-2" : "left-full ml-2"
          }`}
        >
          {/* Arrow pointing to badge */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 ${
              isRightColumn ? "left-full ml-[-1px]" : "right-full mr-[-1px]"
            }`}
          >
            <div
              className={`border-8 border-transparent ${
                isRightColumn
                  ? "border-l-[var(--color-bg-secondary)]"
                  : "border-r-[var(--color-bg-secondary)]"
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
              <div className="text-xs font-medium text-[var(--color-text-primary)]">
                {badge.name}
              </div>
              <span
                className={`inline-block text-[9px] font-medium capitalize px-1.5 py-0.5 rounded ${RARITY_BG_COLORS[badge.rarity]} ${RARITY_TEXT_COLOR}`}
              >
                {badge.rarity}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-[var(--color-text-secondary)] mb-1.5 bg-black/20 px-1.5 py-1 rounded">
            📋 {badge.description}
          </div>
          <div
            className={`text-[10px] ${isEarned ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"}`}
          >
            {isEarned ? `✨ ${badge.praise}` : "🔒 Not yet unlocked"}
          </div>
        </div>
      )}
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

// Social Links Quick Access (Header Icons)
function SocialLinksQuickAccess({ socialLinks }: { socialLinks: SocialLinks | null | undefined }) {
  if (!socialLinks) return null;

  const links = [
    {
      key: "github",
      icon: Github,
      prefix: "https://github.com/",
      hoverColor: "hover:text-white hover:bg-white/20",
    },
    {
      key: "twitter",
      icon: XIcon,
      prefix: "https://x.com/",
      hoverColor: "hover:text-white hover:bg-white/20",
    },
    {
      key: "linkedin",
      icon: Linkedin,
      prefix: "https://linkedin.com/in/",
      hoverColor: "hover:text-[#0A66C2] hover:bg-[#0A66C2]/20",
    },
    {
      key: "website",
      icon: Globe,
      prefix: "",
      hoverColor: "hover:text-[var(--color-claude-coral)] hover:bg-[var(--color-claude-coral)]/20",
    },
  ] as const;

  const activeLinks = links.filter((link) => {
    const value = socialLinks[link.key as keyof SocialLinks];
    return value && value.trim() !== "";
  });

  if (activeLinks.length === 0) return null;

  const getFullUrl = (link: (typeof links)[number], value: string): string => {
    if (link.key === "website") {
      return value.startsWith("http") ? value : `https://${value}`;
    }
    // For github, twitter, linkedin - just prepend the prefix
    return `${link.prefix}${value.replace(/^@/, "")}`;
  };

  return (
    <div className="flex items-center gap-1 mt-1.5">
      {activeLinks.map((link) => {
        const value = socialLinks[link.key as keyof SocialLinks] || "";
        const Icon = link.icon;
        const url = getFullUrl(link, value);

        return (
          <a
            key={link.key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`p-1.5 rounded-md text-[var(--color-text-muted)] transition-all ${link.hoverColor}`}
            title={link.key === "website" ? new URL(url).hostname : value}
          >
            <Icon className="w-3.5 h-3.5" />
          </a>
        );
      })}
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

// Badge display component
function BadgeGrid({ badgeIds, userCountry }: { badgeIds: string[]; userCountry: string }) {
  const categories: Badge["category"][] = ["streak", "tokens", "rank", "model", "social"];

  const badgesByCategory = useMemo(() => {
    return categories.map((category) => ({
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
  user: DisplayUser | null;
  isOpen: boolean;
  onClose: () => void;
  periodFilter: PeriodFilter;
  scopeFilter: ScopeFilter;
  ccplanFilter?: CCPlanFilter;
}

export function ProfileSidePanel({
  user,
  isOpen,
  onClose,
  periodFilter,
  scopeFilter,
  ccplanFilter = "all",
}: ProfileSidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [displayedUser, setDisplayedUser] = useState<DisplayUser | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTabletPortrait, setIsTabletPortrait] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [showCompactStats, setShowCompactStats] = useState(false);

  // API data state
  const [usageHistory, setUsageHistory] = useState<UsageHistoryPoint[]>([]);
  const [userBadges, setUserBadges] = useState<string[]>([]);
  const [freshSocialLinks, setFreshSocialLinks] = useState<SocialLinks | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Only mobile uses overlay mode, tablet uses push mode
  const isOverlayPanel = isMobile;

  // Swipe gesture state
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchCurrentX, setTouchCurrentX] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isVerticalScroll, setIsVerticalScroll] = useState(false);

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

  // Calculate swipe offset (only for horizontal swipe, not vertical scroll)
  const swipeOffset = useMemo(() => {
    if (!isDragging || isVerticalScroll || touchStartX === null || touchCurrentX === null) return 0;
    const diff = touchCurrentX - touchStartX;
    return Math.max(0, diff);
  }, [isDragging, isVerticalScroll, touchStartX, touchCurrentX]);

  // Touch handlers with vertical scroll detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      setTouchStartX(touch.clientX);
      setTouchStartY(touch.clientY);
      setTouchCurrentX(touch.clientX);
      setIsDragging(false); // Don't start dragging until we determine direction
      setIsVerticalScroll(false);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || touchStartX === null || touchStartY === null) return;

      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      // Determine scroll direction on first significant movement
      if (!isDragging && !isVerticalScroll) {
        const minThreshold = 10; // Minimum movement before deciding direction
        if (Math.abs(deltaX) > minThreshold || Math.abs(deltaY) > minThreshold) {
          // If vertical movement is greater than horizontal, it's a vertical scroll
          if (Math.abs(deltaY) > Math.abs(deltaX)) {
            setIsVerticalScroll(true);
            return;
          } else {
            // Horizontal movement - start dragging
            setIsDragging(true);
          }
        }
      }

      // Only update horizontal position if we're in drag mode
      if (isDragging && !isVerticalScroll) {
        setTouchCurrentX(touch.clientX);
      }
    },
    [isDragging, isVerticalScroll, touchStartX, touchStartY]
  );

  const handleTouchEnd = useCallback(() => {
    // Only close if it was a horizontal swipe (not vertical scroll)
    if (isDragging && !isVerticalScroll && touchStartX !== null && touchCurrentX !== null) {
      const diff = touchCurrentX - touchStartX;
      const threshold = 100;

      if (diff > threshold) {
        onClose();
      }
    }

    // Reset all touch state
    setIsDragging(false);
    setTouchStartX(null);
    setTouchStartY(null);
    setTouchCurrentX(null);
    setIsVerticalScroll(false);
  }, [isDragging, isVerticalScroll, touchStartX, touchCurrentX, onClose]);

  // Fetch user history and badges when user changes
  useEffect(() => {
    async function fetchUserData() {
      if (!user) return;

      setHistoryLoading(true);
      setFreshSocialLinks(null); // Reset on user change
      try {
        // Fetch history (includes fresh social_links)
        const historyResponse = await fetch(`/api/users/${user.id}/history?days=365`);
        if (historyResponse.ok) {
          const data = await historyResponse.json();
          setUsageHistory(data.history || []);
          // Use fresh social_links from API
          if (data.user?.social_links) {
            setFreshSocialLinks(data.user.social_links);
          }
        }

        // Fetch badges (from user_badges table)
        const badgesResponse = await fetch(`/api/users/${user.id}/badges`);
        if (badgesResponse.ok) {
          const data = await badgesResponse.json();
          setUserBadges((data.badges || []).map((b: { badge_type: string }) => b.badge_type));
        } else {
          setUserBadges([]);
        }
      } catch {
        setUsageHistory([]);
        setUserBadges([]);
      } finally {
        setHistoryLoading(false);
      }
    }
    fetchUserData();
  }, [user?.id]);

  // Handle user change with transition
  useEffect(() => {
    if (!isOpen || !user) return undefined;

    if (displayedUser?.id === user.id) return undefined;

    setShowCompactStats(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    if (displayedUser) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayedUser(user);
        setIsTransitioning(false);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setDisplayedUser(user);
      return undefined;
    }
  }, [user, isOpen, displayedUser?.id]);

  // Clear when panel closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setDisplayedUser(null);
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

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
      if (panelRef.current?.contains(target)) return;
      if (target.closest("tr") || target.closest("table")) return;
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
  if (!currentUser) return null;

  const level = getLevelByTokens(currentUser.total_tokens);
  const nextLevel = LEVELS.find((l) => l.level === level.level + 1);
  const progressToNext = nextLevel
    ? ((currentUser.total_tokens - level.minTokens) / (nextLevel.minTokens - level.minTokens)) * 100
    : 100;

  const countryRank = currentUser.country_rank || currentUser.rank;

  // Calculate period stats from history
  const days =
    periodFilter === "today"
      ? 1
      : periodFilter === "7d"
        ? 7
        : periodFilter === "30d"
          ? 30
          : usageHistory.length;
  const filteredHistory = usageHistory.slice(-days);
  const periodTokens = filteredHistory.reduce((sum, day) => sum + day.tokens, 0);
  const periodCost = filteredHistory.reduce((sum, day) => sum + day.cost, 0);
  const avgDailyTokens = filteredHistory.length > 0 ? periodTokens / filteredHistory.length : 0;

  const periodLabel =
    periodFilter === "today"
      ? "Today"
      : periodFilter === "7d"
        ? "7D"
        : periodFilter === "30d"
          ? "30D"
          : "All Time";

  return (
    <>
      {isOverlayPanel && (
        <div
          className={`fixed inset-0 z-40 transition-opacity duration-300 lg:hidden pointer-events-none ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full flex flex-col bg-[var(--color-bg-primary)] border-l border-[var(--border-default)] z-50 shadow-2xl ${
          isDragging ? "" : "transition-transform duration-300 ease-out"
        } ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{
          width: isMobile ? "calc(100% - 56px)" : isTabletPortrait ? "320px" : "440px",
          maxWidth: isMobile ? "calc(100% - 56px)" : isTabletPortrait ? "320px" : "440px",
          transform: isOpen ? `translateX(${swipeOffset}px)` : "translateX(100%)",
        }}
        onTouchStart={isOverlayPanel ? handleTouchStart : undefined}
        onTouchMove={isOverlayPanel ? handleTouchMove : undefined}
        onTouchEnd={isOverlayPanel ? handleTouchEnd : undefined}
      >
        {/* Fixed Header Area */}
        <div className="flex-shrink-0">
          {/* Title Bar */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
            <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              Profile Details
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Profile Header */}
          <div
            className={`p-4 pb-3 border-b border-[var(--border-default)] bg-[var(--color-bg-primary)] transition-opacity duration-150 ${
              isTransitioning ? "opacity-30" : "opacity-100"
            }`}
          >
            <div className="flex items-start gap-3">
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.username}
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-[#F7931E] flex items-center justify-center text-lg font-semibold text-white flex-shrink-0">
                  {currentUser.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                    {currentUser.display_name || currentUser.username}
                  </h2>
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                    style={{ backgroundColor: `${level.color}20`, color: level.color }}
                  >
                    {level.icon} Lv.{level.level}
                  </span>
                  {currentUser.ccplan && (
                    <CCplanBadge
                      ccplan={currentUser.ccplan as Exclude<CCPlanFilter, "all">}
                      ccplanRank={currentUser.ccplan_rank}
                      size="sm"
                    />
                  )}
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1.5 mt-0.5">
                  {currentUser.country_code && (
                    <ReactCountryFlag
                      countryCode={currentUser.country_code}
                      svg
                      style={{ width: "12px", height: "12px" }}
                    />
                  )}
                  <span>@{currentUser.username.toLowerCase().replace(/\s+/g, "")}</span>
                </p>
                {/* Social Links Quick Access - use fresh data from API when available */}
                {(freshSocialLinks || currentUser.social_links) && (
                  <SocialLinksQuickAccess
                    socialLinks={freshSocialLinks || currentUser.social_links}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Compact Stats Bar */}
          <div
            className={`overflow-hidden transition-all duration-200 ${
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
                    <ReactCountryFlag
                      countryCode={currentUser.country_code}
                      svg
                      style={{ width: "12px", height: "12px" }}
                    />
                  )}
                  <span className="font-medium text-[var(--color-text-primary)]">
                    #{countryRank}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1">
                  <span>💰</span>
                  <span className="font-medium text-[var(--color-cost)]">
                    ${formatTokens(periodCost)}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1">
                  <span>🔥</span>
                  <span className="font-medium text-[var(--color-claude-coral)]">
                    {formatTokens(periodTokens)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollContainerRef}
          className={`p-4 overflow-y-auto overflow-x-clip flex-1 transition-opacity duration-150 ${
            isTransitioning ? "opacity-30" : "opacity-100"
          }`}
        >
          {/* Level Progress */}
          <LevelProgressBar
            currentTokens={currentUser.total_tokens}
            level={level}
            nextLevel={nextLevel}
            progressToNext={progressToNext}
            userId={currentUser.id}
          />

          {/* Stats Grid */}
          <div
            ref={statsRef}
            className="grid grid-cols-2 gap-2 mb-4"
            key={`stats-${currentUser.id}`}
          >
            {/* CCplan Rank - show when filtering by a specific tier */}
            {ccplanFilter !== "all" && currentUser.ccplan && currentUser.ccplan_rank && (
              <div className="p-3 rounded-lg bg-primary/10 ring-1 ring-primary/30 border border-[var(--border-default)] col-span-2">
                <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5 flex items-center gap-1">
                  <CCplanBadge
                    ccplan={currentUser.ccplan as Exclude<CCPlanFilter, "all">}
                    size="sm"
                  />
                  League Rank
                </div>
                <div
                  className={`font-semibold text-[var(--color-text-primary)] ${isNarrow ? "text-base" : "text-lg"}`}
                >
                  #<RollingNumber value={currentUser.ccplan_rank} delay={0} duration={600} />
                </div>
              </div>
            )}
            {/* Global Rank */}
            <div
              className={`p-3 rounded-lg transition-all ${
                scopeFilter === "global" && ccplanFilter === "all"
                  ? "bg-primary/10 ring-1 ring-primary/30"
                  : "bg-[var(--color-section-bg)]"
              } border border-[var(--border-default)]`}
            >
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5 flex items-center gap-1">
                🌍 Global Rank
              </div>
              <div
                className={`font-semibold text-[var(--color-text-primary)] ${isNarrow ? "text-base" : "text-lg"}`}
              >
                #
                <RollingNumber
                  value={currentUser.global_rank || currentUser.rank}
                  delay={0}
                  duration={600}
                />
              </div>
            </div>
            {/* Cost */}
            <div className="p-3 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)]">
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">
                {periodLabel} Cost $
              </div>
              <div
                className={`font-semibold text-[var(--color-cost)] ${
                  isNarrow
                    ? periodCost >= 100_000
                      ? "text-sm"
                      : "text-base"
                    : periodTokens >= 100_000_000_000
                      ? "text-sm lg:text-lg"
                      : periodTokens >= 1_000_000_000
                        ? "text-base lg:text-lg"
                        : "text-lg"
                }`}
              >
                <RollingNumber
                  value={periodCost}
                  delay={100}
                  duration={800}
                  formatFn={(v) => {
                    if (isNarrow && v >= 100_000) {
                      return `${(v / 1_000).toFixed(0)}K`;
                    }
                    return v.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    });
                  }}
                />
              </div>
            </div>
            {/* Country Rank */}
            <div
              className={`p-3 rounded-lg transition-all ${
                scopeFilter === "country" && ccplanFilter === "all"
                  ? "bg-primary/10 ring-1 ring-primary/30"
                  : "bg-[var(--color-section-bg)]"
              } border border-[var(--border-default)]`}
            >
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5 flex items-center gap-1">
                {currentUser.country_code && (
                  <ReactCountryFlag
                    countryCode={currentUser.country_code}
                    svg
                    style={{ width: "10px", height: "10px" }}
                  />
                )}
                Country Rank
              </div>
              <div
                className={`font-semibold text-[var(--color-text-primary)] ${isNarrow ? "text-base" : "text-lg"}`}
              >
                #<RollingNumber value={countryRank} delay={200} duration={600} />
              </div>
            </div>
            {/* Tokens */}
            <div className="p-3 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)]">
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">
                {periodLabel} Tokens
              </div>
              <div
                className={`font-semibold text-[var(--color-claude-coral)] ${
                  isNarrow
                    ? periodTokens >= 1_000_000_000
                      ? "text-sm"
                      : "text-base"
                    : periodTokens >= 100_000_000_000
                      ? "text-sm lg:text-lg"
                      : periodTokens >= 1_000_000_000
                        ? "text-base lg:text-lg"
                        : "text-lg"
                }`}
              >
                <RollingNumber
                  value={periodTokens}
                  delay={300}
                  duration={1000}
                  formatFn={(v) => {
                    if (isNarrow && v >= 1_000_000_000) {
                      return `${(v / 1_000_000_000).toFixed(1)}B`;
                    }
                    return v.toLocaleString();
                  }}
                />
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
                {historyLoading
                  ? "Loading..."
                  : periodFilter === "today"
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
            {historyLoading ? (
              <div className="h-32 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : usageHistory.length > 0 ? (
              <UsageChart history={usageHistory} periodFilter={periodFilter} />
            ) : (
              <div className="h-32 flex items-center justify-center text-[var(--color-text-muted)] text-xs">
                No usage data available
              </div>
            )}
            <div className="text-[11px] text-[var(--color-text-secondary)] mt-2 pt-2 border-t border-[var(--border-default)] text-center">
              Avg Daily:{" "}
              <span className="font-medium text-[var(--color-claude-coral)]">
                {formatTokens(Math.round(avgDailyTokens))}
              </span>{" "}
              tokens
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className="mb-4 p-3 pt-6 pb-4 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)]">
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
              📅 Activity (Last Year)
            </div>
            {historyLoading ? (
              <div className="h-20 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ActivityHeatmap data={usageHistory} periodDays={365} />
            )}
          </div>

          {/* Badges */}
          <div className="p-3 pb-24 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)] overflow-visible">
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
              🏅 Badges ({userBadges.length}/{BADGES.length})
            </div>
            <div className="overflow-visible">
              <BadgeGrid badgeIds={userBadges} userCountry={currentUser.country_code || "US"} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ProfileSidePanel;
