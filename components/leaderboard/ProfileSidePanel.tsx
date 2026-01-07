'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';
import ReactCountryFlag from 'react-country-flag';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { LEVELS, getLevelByTokens } from '@/lib/constants/levels';
import { BADGES, type Badge } from '@/lib/constants/badges';
import { getMockUserHistory, MOCK_USERS, type MockUsagePoint } from '@/data/mock';
import type { MockUser } from '@/data/mock';
import { ActivityHeatmap } from '@/components/profile/ActivityHeatmap';
import { RollingNumber } from '@/components/ui/RollingNumber';

// Calculate country rank for a user
function getCountryRank(user: MockUser): number {
  const sameCountryUsers = MOCK_USERS
    .filter(u => u.country === user.country)
    .sort((a, b) => b.totalTokens - a.totalTokens);
  return sameCountryUsers.findIndex(u => u.id === user.id) + 1;
}

type PeriodFilter = 'today' | '7d' | '30d' | 'all';
type ScopeFilter = 'global' | 'country';

interface ProfileSidePanelProps {
  user: MockUser | null;
  isOpen: boolean;
  onClose: () => void;
  periodFilter: PeriodFilter;
  scopeFilter: ScopeFilter;
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
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
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
function aggregateByMonth(data: MockUsagePoint[]): { date: string; tokens: number }[] {
  const monthMap = new Map<string, number>();

  data.forEach((day) => {
    const monthKey = day.date.slice(0, 7); // YYYY-MM format
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + day.tokens);
  });

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, tokens]) => ({
      date: month.slice(2), // YY-MM format
      tokens,
    }));
}

// Line chart for usage history
function UsageChart({ history, periodFilter }: { history: MockUsagePoint[]; periodFilter: PeriodFilter }) {
  const days = periodFilter === 'today' ? 1 : periodFilter === '7d' ? 7 : periodFilter === '30d' ? 30 : history.length;
  const filteredData = history.slice(-days);

  // Use monthly aggregation for 60+ days
  const useMonthly = filteredData.length > 60;

  const chartData = useMonthly
    ? aggregateByMonth(filteredData)
    : filteredData.map((day) => ({
        date: day.date.slice(5), // MM-DD format
        tokens: day.tokens,
      }));

  return (
    <div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-default)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717A', fontSize: 9 }}
              interval={periodFilter === 'today' ? 0 : periodFilter === '7d' ? 0 : periodFilter === '30d' ? 6 : useMonthly ? Math.max(0, Math.floor(chartData.length / 6) - 1) : chartData.length <= 14 ? 0 : Math.floor(chartData.length / 5)}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717A', fontSize: 9 }}
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
              activeDot={{ r: 4, fill: '#DA7756', stroke: '#fff', strokeWidth: 2 }}
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
type Level = typeof LEVELS[number];

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
  const [hoveredPart, setHoveredPart] = useState<'filled' | 'empty' | null>(null);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  const tokensInCurrentLevel = currentTokens - level.minTokens;
  const tokensToNextLevel = nextLevel ? nextLevel.minTokens - currentTokens : 0;

  // Animate progress bar with ease-in effect (slow start, fast end)
  useEffect(() => {
    setAnimatedProgress(0);

    const duration = 1500; // 1.5 seconds
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in quadratic: starts moderately, accelerates
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

      {/* Progress bar with hover areas */}
      <div className="relative h-2.5 bg-white/10 rounded-full overflow-visible border border-[var(--border-default)]">
        {/* Filled part - shows current tokens on hover */}
        <div
          className="absolute top-0 left-0 h-full bg-[var(--color-claude-coral)] rounded-l-full cursor-pointer"
          style={{ width: `${Math.min(animatedProgress, 100)}%` }}
          onMouseEnter={() => setHoveredPart('filled')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Empty part - shows remaining tokens on hover */}
        {nextLevel && (
          <div
            className="absolute top-0 right-0 h-full cursor-pointer"
            style={{ width: `${100 - Math.min(animatedProgress, 100)}%` }}
            onMouseEnter={() => setHoveredPart('empty')}
            onMouseLeave={() => setHoveredPart(null)}
          />
        )}

        {/* Tooltip for filled part */}
        {hoveredPart === 'filled' && (
          <div className="absolute bottom-full left-1/4 -translate-x-1/2 mb-2 z-50 px-2 py-1 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg whitespace-nowrap">
            <div className="text-[10px] text-[var(--color-text-muted)]">Current Level Progress</div>
            <div className="text-xs font-medium text-[var(--color-claude-coral)]">
              {formatTokens(tokensInCurrentLevel)} tokens
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="border-6 border-transparent border-t-[var(--color-bg-secondary)]" />
            </div>
          </div>
        )}

        {/* Tooltip for empty part */}
        {hoveredPart === 'empty' && nextLevel && (
          <div className="absolute bottom-full right-1/4 translate-x-1/2 mb-2 z-50 px-2 py-1 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg whitespace-nowrap">
            <div className="text-[10px] text-[var(--color-text-muted)]">To Next Level</div>
            <div className="text-xs font-medium text-[var(--color-text-primary)]">
              {formatTokens(tokensToNextLevel)} tokens
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="border-6 border-transparent border-t-[var(--color-bg-secondary)]" />
            </div>
          </div>
        )}
      </div>

      {/* Level range info */}
      <div className="text-[9px] text-[var(--color-text-muted)] mt-1.5">
        Current Range: <span className="text-[var(--color-text-secondary)]">{formatLevelRange(level.minTokens, level.maxTokens)}</span> ({level.name})
      </div>
    </div>
  );
}

// Convert country code to flag emoji (e.g., 'KR' → 🇰🇷)
function countryCodeToFlag(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 0x1F1E6 + char.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

// Single badge with hover popover
function BadgeItem({ badge, isEarned, columnIndex, totalInCategory, userCountry }: { badge: Badge; isEarned: boolean; columnIndex: number; totalInCategory: number; userCountry?: string }) {
  const [isHovered, setIsHovered] = useState(false);

  const RARITY_COLORS: Record<Badge['rarity'], string> = {
    common: 'border-gray-500/30',
    rare: 'border-blue-500/30',
    epic: 'border-purple-500/30',
    legendary: 'border-yellow-500/30',
  };

  // Unified text color using design system
  const RARITY_TEXT_COLOR = 'text-[var(--color-text-primary)]';

  const RARITY_BG_COLORS: Record<Badge['rarity'], string> = {
    common: 'bg-gray-500/20',
    rare: 'bg-blue-500/20',
    epic: 'bg-purple-500/20',
    legendary: 'bg-[var(--color-claude-coral)]/30',
  };

  // Determine popover position based on badge position in its category
  // For categories with up to 6 badges, use relative positioning
  const isLeftSide = columnIndex <= 1;
  const isRightSide = columnIndex >= totalInCategory - 2;

  const popoverPositionClass = isLeftSide
    ? 'left-0'
    : isRightSide
    ? 'right-0'
    : 'left-1/2 -translate-x-1/2';

  const arrowPositionClass = isLeftSide
    ? 'left-4'
    : isRightSide
    ? 'right-4'
    : 'left-1/2 -translate-x-1/2';

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`w-full aspect-square flex items-center justify-center rounded border border-[var(--border-default)] text-center transition-colors cursor-default ${
          isEarned
            ? `bg-[var(--color-section-bg)] ${RARITY_COLORS[badge.rarity]} hover:bg-white/10`
            : 'bg-[var(--color-section-bg)] opacity-50'
        }`}
      >
        <div className={`text-lg ${!isEarned ? 'grayscale' : ''}`}>
          {isEarned
            ? (badge.id === 'country_first' && userCountry ? countryCodeToFlag(userCountry) : badge.icon)
            : '🔒'}
        </div>
      </div>

      {/* Popover - position based on column */}
      {isHovered && (
        <div className={`absolute top-full ${popoverPositionClass} mt-2 z-[100] w-48 p-2.5 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-xl`}>
          {/* Arrow pointing up */}
          <div className={`absolute bottom-full ${arrowPositionClass} mb-[-1px]`}>
            <div className="border-8 border-transparent border-b-[var(--color-bg-secondary)]" />
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-lg">
              {badge.id === 'country_first' && userCountry ? countryCodeToFlag(userCountry) : badge.icon}
            </span>
            <div>
              <div className="text-xs font-medium text-[var(--color-text-primary)]">
                {badge.name}
              </div>
              <span className={`inline-block text-[9px] font-medium capitalize px-1.5 py-0.5 rounded ${RARITY_BG_COLORS[badge.rarity]} ${RARITY_TEXT_COLOR}`}>
                {badge.rarity}
              </span>
            </div>
          </div>
          {/* 기준 표시 */}
          <div className="text-[10px] text-[var(--color-text-secondary)] mb-1.5 bg-black/20 px-1.5 py-1 rounded">
            📋 {badge.description}
          </div>
          {/* 획득 여부에 따른 메시지 */}
          <div className={`text-[10px] ${isEarned ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'}`}>
            {isEarned ? `✨ ${badge.praise}` : '🔒 Not yet unlocked'}
          </div>
        </div>
      )}
    </div>
  );
}

// Category labels with icons
const CATEGORY_LABELS: Record<Badge['category'], { icon: string; label: string }> = {
  streak: { icon: '🔥', label: 'Streak' },
  tokens: { icon: '💎', label: 'Tokens' },
  rank: { icon: '🏆', label: 'Rank' },
  model: { icon: '🎭', label: 'Model' },
  social: { icon: '🤝', label: 'Social' },
};

// Rarity order for sorting (higher = harder/rarer)
const RARITY_ORDER: Record<Badge['rarity'], number> = {
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

// Badge display component - grouped by category in vertical columns
function BadgeGrid({ badgeIds, userCountry }: { badgeIds: string[]; userCountry: string }) {
  // Group badges by category in order
  const categories: Badge['category'][] = ['streak', 'tokens', 'rank', 'model', 'social'];

  const badgesByCategory = useMemo(() => {
    return categories.map(category => ({
      category,
      badges: BADGES
        .filter(b => b.category === category)
        .sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]), // Sort by rarity: legendary → common
    }));
  }, []);

  // Find max badges in any category for row count
  const maxBadges = Math.max(...badgesByCategory.map(c => c.badges.length));

  return (
    <div className="flex gap-1">
      {/* Each category is a vertical column */}
      {badgesByCategory.map(({ category, badges }, colIndex) => {
        const { icon } = CATEGORY_LABELS[category];

        return (
          <div key={category} className="flex-1 flex flex-col gap-1">
            {/* Category header - just icon */}
            <div className="text-center text-[10px] pb-0.5 border-b border-[var(--border-default)]">
              {icon}
            </div>
            {/* Badges stacked vertically */}
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
            {/* Empty placeholders to align columns */}
            {Array.from({ length: maxBadges - badges.length }).map((_, i) => (
              <div key={`empty-${i}`} className="w-full aspect-square" />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function ProfileSidePanel({ user, isOpen, onClose, periodFilter, scopeFilter }: ProfileSidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [displayedUser, setDisplayedUser] = useState<MockUser | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTabletPortrait, setIsTabletPortrait] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [showCompactStats, setShowCompactStats] = useState(false);

  // Overlay mode: mobile and tablet portrait use overlay panel
  const isOverlayPanel = isMobile || isTabletPortrait;

  // Swipe gesture state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchCurrent, setTouchCurrent] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Detect viewport size
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768); // Phone only
      setIsTabletPortrait(width >= 768 && width < 1024); // Tablet portrait
      setIsTablet(width >= 1024 && width < 1440); // Tablet landscape / small desktop
      setIsNarrow(width < 400); // Very narrow screens
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Calculate swipe offset for panel animation
  const swipeOffset = useMemo(() => {
    if (!isDragging || touchStart === null || touchCurrent === null) return 0;
    const diff = touchCurrent - touchStart;
    // Only allow swiping right (to close)
    return Math.max(0, diff);
  }, [isDragging, touchStart, touchCurrent]);

  // Touch handlers for swipe gesture
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      setTouchStart(touch.clientX);
      setTouchCurrent(touch.clientX);
      setIsDragging(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    if (touch) {
      setTouchCurrent(touch.clientX);
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || touchStart === null || touchCurrent === null) {
      setIsDragging(false);
      setTouchStart(null);
      setTouchCurrent(null);
      return;
    }

    const diff = touchCurrent - touchStart;
    const threshold = 100; // Minimum swipe distance to close

    if (diff > threshold) {
      onClose();
    }

    setIsDragging(false);
    setTouchStart(null);
    setTouchCurrent(null);
  }, [isDragging, touchStart, touchCurrent, onClose]);

  // Handle user change with smooth transition
  useEffect(() => {
    if (!isOpen || !user) return undefined;

    // If same user, no transition needed
    if (displayedUser?.id === user.id) return undefined;

    // Reset scroll position and compact stats when user changes
    setShowCompactStats(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    // If there's already a displayed user, do a quick fade transition
    if (displayedUser) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayedUser(user);
        setIsTransitioning(false);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // First user, show immediately
      setDisplayedUser(user);
      return undefined;
    }
  }, [user, isOpen]);

  // Clear displayed user when panel closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setDisplayedUser(null);
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [isOpen, onClose]);

  // Close on click outside (except table rows) - only on desktop
  useEffect(() => {
    if (isOverlayPanel) return undefined; // Don't use click outside on overlay mode

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;

      // Don't close if clicking inside the panel
      if (panelRef.current?.contains(target)) return;

      // Don't close if clicking on table rows (they have their own click handler)
      if (target.closest('tr') || target.closest('table')) return;

      onClose();
    }

    if (isOpen) {
      // Use setTimeout to avoid closing immediately when opening
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside);
      };
    }
    return undefined;
  }, [isOpen, onClose, isOverlayPanel]);

  // Prevent body scroll when mobile panel is open
  useEffect(() => {
    if (isOverlayPanel && isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [isOverlayPanel, isOpen]);

  // Detect when stats section scrolls out of view
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const statsElement = statsRef.current;

    if (!scrollContainer || !statsElement) return undefined;

    const handleScroll = () => {
      const statsRect = statsElement.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      // Show compact stats when the stats grid is scrolled above the container top
      setShowCompactStats(statsRect.bottom < containerRect.top + 10);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [displayedUser]);

  // Get usage history for the displayed user (365 days for heatmap)
  const usageHistory = useMemo(() => {
    if (!displayedUser) return [];
    return getMockUserHistory(displayedUser.id, displayedUser.totalTokens, 365);
  }, [displayedUser]);

  const currentUser = displayedUser;
  if (!currentUser) return null;

  const level = getLevelByTokens(currentUser.totalTokens);
  const nextLevel = LEVELS.find((l) => l.level === level.level + 1);
  const progressToNext = nextLevel
    ? ((currentUser.totalTokens - level.minTokens) / (nextLevel.minTokens - level.minTokens)) * 100
    : 100;

  // Calculate country rank
  const countryRank = getCountryRank(currentUser);

  // Calculate stats based on period filter
  const days = periodFilter === 'today' ? 1 : periodFilter === '7d' ? 7 : periodFilter === '30d' ? 30 : usageHistory.length;
  const filteredHistory = usageHistory.slice(-days);
  const periodTokens = filteredHistory.reduce((sum, day) => sum + day.tokens, 0);
  const periodCost = filteredHistory.reduce((sum, day) => sum + day.cost, 0);
  const avgDailyTokens = filteredHistory.length > 0 ? periodTokens / filteredHistory.length : 0;

  // Period label for display
  const periodLabel = periodFilter === 'today' ? 'Today' : periodFilter === '7d' ? '7D' : periodFilter === '30d' ? '30D' : 'All Time';

  return (
    <>
      {/* Mobile Backdrop - transparent, allows clicking through to table rows */}
      {isOverlayPanel && (
        <div
          className={`fixed inset-0 z-40 transition-opacity duration-300 lg:hidden pointer-events-none ${
            isOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Side Panel - on mobile, leave space for rank column */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full flex flex-col bg-[var(--color-bg-primary)] border-l border-[var(--border-default)] z-50 shadow-2xl ${
          isDragging ? '' : 'transition-transform duration-300 ease-out'
        } ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          width: isMobile ? 'calc(100% - 56px)' : (isTabletPortrait || isTablet) ? '380px' : '440px',
          maxWidth: isMobile ? 'calc(100% - 56px)' : (isTabletPortrait || isTablet) ? '380px' : '440px',
          transform: isOpen
            ? `translateX(${swipeOffset}px)`
            : 'translateX(100%)',
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
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Profile Header - Fixed */}
          <div className={`p-4 pb-3 border-b border-[var(--border-default)] bg-[var(--color-bg-primary)] transition-opacity duration-150 ${
            isTransitioning ? 'opacity-30' : 'opacity-100'
          }`}>
            <div className="flex items-start gap-3">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.username}
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-[#F7931E] flex items-center justify-center text-lg font-semibold text-white flex-shrink-0">
                  {currentUser.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                    {currentUser.username}
                  </h2>
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                    style={{ backgroundColor: `${level.color}20`, color: level.color }}
                  >
                    {level.icon} Lv.{level.level}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1.5 mt-0.5">
                  <ReactCountryFlag countryCode={currentUser.country} svg style={{ width: '12px', height: '12px' }} />
                  <span>@{currentUser.username.toLowerCase().replace(/\s+/g, '')}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Compact Stats Bar - shows when stats are scrolled out */}
          <div
            className={`overflow-hidden transition-all duration-200 ${
              showCompactStats ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="px-3 py-2">
              <div className="flex items-center py-1.5 px-2 bg-[var(--color-section-bg)] border border-[var(--border-default)] rounded-full text-[11px]">
                <div className="flex-1 flex items-center justify-center gap-1">
                  <span>🌍</span>
                  <span className="font-medium text-[var(--color-text-primary)]">#{currentUser.rank}</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1">
                  <ReactCountryFlag countryCode={currentUser.country} svg style={{ width: '12px', height: '12px' }} />
                  <span className="font-medium text-[var(--color-text-primary)]">#{countryRank}</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1">
                  <span>💰</span>
                  <span className="font-medium text-[var(--color-cost)]">${formatTokens(periodCost)}</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1">
                  <span>🔥</span>
                  <span className="font-medium text-[var(--color-claude-coral)]">{formatTokens(periodTokens)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollContainerRef}
          className={`p-4 overflow-y-auto flex-1 transition-opacity duration-150 ${
            isTransitioning ? 'opacity-30' : 'opacity-100'
          }`}
        >
          {/* Level Progress */}
          <LevelProgressBar
            currentTokens={currentUser.totalTokens}
            level={level}
            nextLevel={nextLevel}
            progressToNext={progressToNext}
            userId={currentUser.id}
          />

          {/* Stats Grid - Row 1: Global Rank | Cost, Row 2: Country Rank | Tokens */}
          <div ref={statsRef} className="grid grid-cols-2 gap-2 mb-4" key={`stats-${currentUser.id}`}>
            {/* Row 1: Global Rank */}
            <div className={`p-3 rounded-lg transition-all ${
              scopeFilter === 'global'
                ? 'bg-primary/10 ring-1 ring-primary/30'
                : 'bg-[var(--color-section-bg)]'
            } border border-[var(--border-default)]`}>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5 flex items-center gap-1">
                🌍 Global Rank
              </div>
              <div className={`font-semibold text-[var(--color-text-primary)] ${isNarrow ? 'text-base' : 'text-lg'}`}>
                #<RollingNumber value={currentUser.rank} delay={0} duration={600} />
              </div>
            </div>
            {/* Row 1: Cost */}
            <div className="p-3 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)]">
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">
                {periodLabel} Cost $
              </div>
              <div className={`font-semibold text-[var(--color-cost)] ${
                isNarrow
                  ? (periodCost >= 100_000 ? 'text-sm' : 'text-base')
                  : (periodTokens >= 100_000_000_000 ? 'text-sm lg:text-lg' : periodTokens >= 1_000_000_000 ? 'text-base lg:text-lg' : 'text-lg')
              }`}>
                <RollingNumber
                  value={periodCost}
                  delay={100}
                  duration={800}
                  formatFn={(v) => {
                    if (isNarrow && v >= 100_000) {
                      return `${(v / 1_000).toFixed(0)}K`;
                    }
                    return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                  }}
                />
              </div>
            </div>
            {/* Row 2: Country Rank */}
            <div className={`p-3 rounded-lg transition-all ${
              scopeFilter === 'country'
                ? 'bg-primary/10 ring-1 ring-primary/30'
                : 'bg-[var(--color-section-bg)]'
            } border border-[var(--border-default)]`}>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5 flex items-center gap-1">
                <ReactCountryFlag countryCode={currentUser.country} svg style={{ width: '10px', height: '10px' }} />
                Country Rank
              </div>
              <div className={`font-semibold text-[var(--color-text-primary)] ${isNarrow ? 'text-base' : 'text-lg'}`}>
                #<RollingNumber value={countryRank} delay={200} duration={600} />
              </div>
            </div>
            {/* Row 2: Tokens */}
            <div className="p-3 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)]">
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">
                {periodLabel} Tokens
              </div>
              <div className={`font-semibold text-[var(--color-claude-coral)] ${
                isNarrow
                  ? (periodTokens >= 1_000_000_000 ? 'text-sm' : 'text-base')
                  : (periodTokens >= 100_000_000_000 ? 'text-sm lg:text-lg' : periodTokens >= 1_000_000_000 ? 'text-base lg:text-lg' : 'text-lg')
              }`}>
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
                {periodFilter === 'today' ? 'Today'
                  : periodFilter === '7d' ? 'Last 7 days'
                  : periodFilter === '30d' ? 'Last 30 days'
                  : usageHistory.length > 60 ? 'All Time (Monthly)' : 'All Time'}
              </div>
            </div>
            <UsageChart history={usageHistory} periodFilter={periodFilter} />
            <div className="text-[11px] text-[var(--color-text-secondary)] mt-2 pt-2 border-t border-[var(--border-default)] text-center">
              Avg Daily: <span className="font-medium text-[var(--color-claude-coral)]">{formatTokens(Math.round(avgDailyTokens))}</span> tokens
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className="mb-4 p-3 pt-6 pb-4 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)]">
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
              📅 Activity (Last Year)
            </div>
            <div className="overflow-x-auto pb-2">
              <ActivityHeatmap data={usageHistory} periodDays={365} />
            </div>
          </div>

          {/* Badges */}
          <div className="p-3 pb-24 bg-[var(--color-section-bg)] rounded-lg border border-[var(--border-default)]">
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
              🏅 Badges ({currentUser.badges.length}/{BADGES.length})
            </div>
            <BadgeGrid badgeIds={currentUser.badges} userCountry={currentUser.country} />
          </div>
        </div>
      </div>
    </>
  );
}

export default ProfileSidePanel;
