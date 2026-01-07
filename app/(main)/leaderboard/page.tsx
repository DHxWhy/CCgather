'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import ReactCountryFlag from 'react-country-flag';
import { MOCK_USERS, getMockUserHistory, type MockUser } from '@/data/mock';
import { ProfileSidePanel } from '@/components/leaderboard/ProfileSidePanel';

// Types
type PeriodFilter = 'today' | '7d' | '30d' | 'all';
type ScopeFilter = 'global' | 'country';
type SortByFilter = 'tokens' | 'cost';

// Format numbers properly to avoid floating point issues
function formatTokens(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

import { LEVELS, getLevelByTokens } from '@/lib/constants/levels';

// Country Flag with Popover showing country code
function CountryFlag({ countryCode, size = 16 }: { countryCode: string; size?: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ReactCountryFlag
        countryCode={countryCode}
        svg
        style={{ width: `${size}px`, height: `${size}px` }}
      />

      {/* Popover */}
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

// Level Badge with Popover showing all levels
function LevelBadge({ tokens }: { tokens: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const currentLevel = getLevelByTokens(tokens);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className="px-1.5 py-0.5 rounded text-[10px] font-medium cursor-default"
        style={{ backgroundColor: `${currentLevel.color}20`, color: currentLevel.color }}
      >
        {currentLevel.icon} Lv.{currentLevel.level}
      </span>

      {/* Popover */}
      {isHovered && (
        <div className="absolute left-0 top-full mt-1 z-50 w-56 p-2 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-xl">
          <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
            Level System
          </div>
          <div className="space-y-0.5">
            {LEVELS.map((level) => (
              <div
                key={level.level}
                className={`flex items-center justify-between px-1.5 py-1 rounded text-[10px] ${
                  level.level === currentLevel.level
                    ? 'font-medium'
                    : ''
                }`}
                style={level.level === currentLevel.level
                  ? { backgroundColor: `${level.color}20`, color: level.color }
                  : { color: '#9CA3AF' }
                }
              >
                <div className="flex items-center gap-1.5">
                  <span>{level.icon}</span>
                  <span>Lv.{level.level} {level.name}</span>
                </div>
                <span className="text-[8px] opacity-70">
                  {formatLevelRange(level.minTokens, level.maxTokens)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Mock current user country (will be replaced with real user data)
const CURRENT_USER_COUNTRY = 'KR';
const ITEMS_PER_PAGE = 20;

// Helper to calculate period-based tokens and cost
function getPeriodStats(userId: string, totalTokens: number, period: PeriodFilter) {
  const history = getMockUserHistory(userId, totalTokens);
  const days = period === 'today' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : history.length;
  const filtered = history.slice(-days);

  const tokens = filtered.reduce((sum, day) => sum + day.tokens, 0);
  const cost = filtered.reduce((sum, day) => sum + day.cost, 0);
  return { tokens, cost };
}

export default function LeaderboardPage() {
  const [selectedUser, setSelectedUser] = useState<MockUser | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('global');
  const [sortBy, setSortBy] = useState<SortByFilter>('tokens');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [panelWidth, setPanelWidth] = useState(0);
  const [, setIsOverlayMode] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightMyRank, setHighlightMyRank] = useState(false);

  // Detect screen size and set panel width
  // >= 1880px: panel overlays (enough space, no overlap with 1000px centered table + 440px panel)
  // 1440-1880px: main content shrinks (440px panel)
  // 1024-1440px: main content shrinks (380px panel)
  // < 1024px: mobile overlay mode
  useEffect(() => {
    const updatePanelWidth = () => {
      const width = window.innerWidth;
      if (width >= 1880) {
        setPanelWidth(0); // Very large screens - no overlap possible
        setIsOverlayMode(true);
      } else if (width >= 1440) {
        setPanelWidth(450); // Large screens - 440px panel + buffer
        setIsOverlayMode(false);
      } else if (width >= 1024) {
        setPanelWidth(390); // Medium screens - 380px panel + buffer
        setIsOverlayMode(false);
      } else {
        setPanelWidth(0); // Mobile - panel overlays
        setIsOverlayMode(true);
      }
    };
    updatePanelWidth();
    window.addEventListener('resize', updatePanelWidth);
    return () => window.removeEventListener('resize', updatePanelWidth);
  }, []);

  // Set mounted state to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    setIsAnimating(true);
  }, []);

  // Filter and sort ALL users
  const allFilteredUsers = useMemo(() => {
    let users = [...MOCK_USERS];

    // Filter by country if scope is 'country'
    if (scopeFilter === 'country') {
      users = users.filter(user => user.country === CURRENT_USER_COUNTRY);
    }

    // Calculate period stats and sort by period tokens
    const usersWithPeriodStats = users.map(user => {
      const periodStats = getPeriodStats(user.id, user.totalTokens, periodFilter);
      return {
        ...user,
        periodTokens: periodStats.tokens,
        periodCost: periodStats.cost,
      };
    });

    // Sort by selected metric (descending)
    usersWithPeriodStats.sort((a, b) => {
      if (sortBy === 'cost') {
        return b.periodCost - a.periodCost;
      }
      return b.periodTokens - a.periodTokens;
    });

    // Re-calculate ranks after sorting
    return usersWithPeriodStats.map((user, index) => ({
      ...user,
      rank: index + 1,
    }));
  }, [scopeFilter, periodFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(allFilteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return allFilteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [allFilteredUsers, currentPage]);

  // Find current user in ALL filtered users (not just paginated)
  const currentUserData = useMemo(() => {
    return allFilteredUsers.find(u => u.isCurrentUser);
  }, [allFilteredUsers]);

  // Go to my rank page
  const goToMyRank = useCallback(() => {
    if (currentUserData) {
      const myPage = Math.ceil(currentUserData.rank / ITEMS_PER_PAGE);
      setCurrentPage(myPage);
      setHighlightMyRank(true);
    }
  }, [currentUserData]);

  // Reset page and clear highlight when filters change
  useEffect(() => {
    setCurrentPage(1);
    setHighlightMyRank(false);
  }, [scopeFilter, periodFilter, sortBy]);

  // Trigger animation on filter or page change
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 600);
    return () => clearTimeout(timer);
  }, [scopeFilter, periodFilter, sortBy, currentPage]);

  const handleRowClick = (user: MockUser) => {
    setSelectedUser(user);
    setIsPanelOpen(true);
    setHighlightMyRank(false);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
  };

  // Change page and clear highlight (for manual page changes)
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setHighlightMyRank(false);
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Main Content - left position fixed, right adjusts for panel */}
      <div className="transition-all duration-300 ease-out">
        <div
          className="max-w-[1000px] px-4 py-8 transition-all duration-300"
          style={{
            marginLeft: 'max(calc((100vw - 1000px) / 2), 16px)',
            marginRight: isPanelOpen && panelWidth > 0 ? `${panelWidth}px` : 'auto',
          }}
        >
          {/* Header */}
          <div className="mb-6">
        <p className="text-xs text-[var(--color-claude-coral)] font-medium tracking-wide uppercase mb-3">
          Rankings
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
          {scopeFilter === 'global' ? 'Global' : (
            <>
              <ReactCountryFlag countryCode={CURRENT_USER_COUNTRY} svg style={{ width: '24px', height: '24px' }} />
              Country
            </>
          )} Leaderboard
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Top Claude Code developers ranked by {sortBy === 'tokens' ? 'token usage' : 'spending'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-2 md:gap-3 mb-6">
        {/* Left side filters */}
        <div className="flex items-center gap-2 md:gap-3">
        {/* Scope Filter - Global / Country */}
        <div className="flex p-1 bg-[var(--color-filter-bg)] rounded-lg gap-1">
          <button
            onClick={() => setScopeFilter('global')}
            className={`px-2.5 py-1.5 rounded-md text-sm md:text-xs font-medium transition-colors ${
              scopeFilter === 'global'
                ? 'bg-[var(--color-claude-coral)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]'
            }`}
          >
            🌍
          </button>
          <button
            onClick={() => setScopeFilter('country')}
            className={`px-2.5 py-1.5 rounded-md text-sm md:text-xs font-medium transition-colors flex items-center justify-center ${
              scopeFilter === 'country'
                ? 'bg-[var(--color-claude-coral)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]'
            }`}
          >
            <ReactCountryFlag countryCode={CURRENT_USER_COUNTRY} svg style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-[var(--border-default)]" />

        {/* Period Filter */}
        <div className="flex p-1 bg-[var(--color-filter-bg)] rounded-lg gap-1">
          {[
            { value: 'today', label: '1D', labelFull: 'Today' },
            { value: '7d', label: '7D' },
            { value: '30d', label: '30D' },
            { value: 'all', label: 'All', labelFull: 'All Time' },
          ].map((period) => (
            <button
              key={period.value}
              onClick={() => setPeriodFilter(period.value as PeriodFilter)}
              className={`px-2.5 md:px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                periodFilter === period.value
                  ? 'bg-[var(--color-filter-active)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]'
              }`}
            >
              <span className="md:hidden">{period.label}</span>
              <span className="hidden md:inline">{period.labelFull || period.label}</span>
            </button>
          ))}
        </div>
        </div>

        {/* Right side - My Rank & Sort By Filter */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* My Rank Button */}
          {currentUserData && (
            <button
              onClick={goToMyRank}
              className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 bg-[var(--color-filter-bg)] hover:bg-[var(--color-filter-hover)] rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <span>📍</span>
              <span className="hidden md:inline">My Rank</span>
              <span className="text-[var(--color-claude-coral)] font-semibold">#{currentUserData.rank}</span>
            </button>
          )}

          <div className="flex p-1 bg-[var(--color-filter-bg)] rounded-lg gap-1">
            <button
              onClick={() => setSortBy('cost')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                sortBy === 'cost'
                  ? 'bg-[var(--color-cost)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]'
              }`}
            >
              💵
            </button>
            <button
              onClick={() => setSortBy('tokens')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                sortBy === 'tokens'
                  ? 'bg-[var(--color-claude-coral)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]'
              }`}
            >
              🪙
            </button>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup><col className="w-[42px] md:w-[60px]" /><col className="w-[32px] md:w-[44px]" /><col /><col className="w-[36px] md:w-[70px]" /><col className="w-[58px] md:w-[90px]" /><col className="w-[52px] md:w-[70px]" /></colgroup>
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="text-center text-text-secondary font-medium text-xs py-2.5 px-1">
                  Rank
                </th>
                <th className="text-center text-text-secondary font-medium text-xs py-2.5 px-1">
                  C
                </th>
                <th className="text-left text-text-secondary font-medium text-xs py-2.5 px-1">
                  User
                </th>
                <th className="text-center text-text-secondary font-medium text-xs py-2.5 px-1">
                  <span className="md:hidden">Lv</span>
                  <span className="hidden md:inline">Level</span>
                </th>
                <th className="text-center text-text-secondary font-medium text-xs py-2.5 px-1">
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
              {paginatedUsers.map((user, index) => {
                // Rank-based sizing: Desktop = differentiated, Mobile/Tablet = uniform
                const isFirst = user.rank === 1;
                const isTopThree = user.rank <= 3;
                // Mobile/Tablet (< lg): uniform size for top 3, Desktop: slightly differentiated
                const rowPadding = isFirst ? 'py-2 lg:py-3' : isTopThree ? 'py-2 lg:py-2.5' : 'py-2';
                const avatarSize = isFirst ? 'w-6 h-6 lg:w-8 lg:h-8' : isTopThree ? 'w-6 h-6 lg:w-7 lg:h-7' : 'w-6 h-6';
                const avatarText = isFirst ? 'text-xs lg:text-sm' : isTopThree ? 'text-xs' : 'text-xs';
                const nameSize = isFirst ? 'text-xs lg:text-sm' : isTopThree ? 'text-xs' : 'text-xs';
                const rankSize = isFirst ? 'text-base lg:text-lg' : isTopThree ? 'text-base' : 'text-xs';
                const flagSize = 16; // Uniform on mobile/tablet
                const valueSize = isFirst ? 'text-xs' : 'text-xs';

                return (
                <tr
                  key={`${scopeFilter}-${periodFilter}-${sortBy}-${user.id}`}
                  onClick={() => handleRowClick(user)}
                  className={`border-b border-[var(--border-default)] transition-all cursor-pointer hover:!bg-[var(--color-table-row-hover)] ${
                    user.isCurrentUser ? 'bg-primary/5' : ''
                  } ${selectedUser?.id === user.id && isPanelOpen ? '!bg-[var(--color-table-row-hover)]' : ''} ${
                    user.isCurrentUser && highlightMyRank ? '!bg-[var(--color-claude-coral)]/20 ring-2 ring-[var(--color-claude-coral)]' : ''
                  }`}
                  style={{
                    backgroundColor: !user.isCurrentUser && !(selectedUser?.id === user.id && isPanelOpen) && !highlightMyRank && index % 2 === 1
                      ? 'var(--color-table-row-even)'
                      : undefined,
                    animation: isMounted && isAnimating
                      ? `fadeSlideIn 0.2s ease-out ${Math.pow(index, 0.35) * 0.225}s both`
                      : 'none',
                  }}
                >
                  <td className={`${rowPadding} px-1 md:px-2 text-center`}>
                    <span className={`text-text-primary font-mono ${rankSize}`}>
                      {user.rank <= 3 ? ['🥇', '🥈', '🥉'][user.rank - 1] : `#${user.rank}`}
                    </span>
                  </td>
                  <td className={`${rowPadding} px-1 text-center`}>
                    <CountryFlag countryCode={user.country} size={flagSize} />
                  </td>
                  <td className={`${rowPadding} px-1 md:px-2`}>
                    <div className="flex items-center gap-1.5">
                      {/* Fixed-width container for avatar to maintain alignment */}
                      <div className="w-6 lg:w-8 flex items-center justify-center flex-shrink-0">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.username}
                            className={`${avatarSize} rounded-full object-cover`}
                          />
                        ) : (
                          <div className={`${avatarSize} rounded-full bg-gradient-to-br from-primary to-[#F7931E] flex items-center justify-center text-white ${avatarText} font-semibold`}>
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className={`${nameSize} font-medium text-text-primary truncate`}>
                        {user.username}
                      </span>
                    </div>
                  </td>
                  <td className={`${rowPadding} px-1 text-center`} onClick={(e) => e.stopPropagation()}>
                    {/* Mobile: icon only, Desktop: full badge */}
                    <span className="md:hidden">
                      {getLevelByTokens(user.totalTokens).icon}
                    </span>
                    <span className="hidden md:inline">
                      <LevelBadge tokens={user.totalTokens} />
                    </span>
                  </td>
                  <td className={`${rowPadding} px-0.5 md:px-2 text-center`}>
                    <span className={`text-[var(--color-cost)] font-mono ${valueSize}`}>
                      <span className="md:hidden">${(user.periodCost / 1000).toFixed(0)}k</span>
                      <span className="hidden md:inline">${user.periodCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </span>
                  </td>
                  <td className={`${rowPadding} pl-0.5 pr-2 md:pr-4 text-right`}>
                    <span className={`text-[var(--color-claude-coral)] font-mono ${valueSize}`}>
                      {formatTokens(user.periodTokens)}
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
              {/* Previous Button */}
              <button
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="w-10 h-10 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ‹
              </button>

              {/* Page Numbers */}
              {(() => {
                const pages: (number | string)[] = [];
                const showEllipsisStart = currentPage > 3;
                const showEllipsisEnd = currentPage < totalPages - 2;

                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (showEllipsisStart) pages.push('...');

                  const start = Math.max(2, currentPage - 1);
                  const end = Math.min(totalPages - 1, currentPage + 1);
                  for (let i = start; i <= end; i++) pages.push(i);

                  if (showEllipsisEnd) pages.push('...');
                  pages.push(totalPages);
                }

                return pages.map((page, i) => (
                  <button
                    key={i}
                    onClick={() => typeof page === 'number' && handlePageChange(page)}
                    disabled={page === '...'}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                      page === currentPage
                        ? 'bg-[var(--color-claude-coral)] text-white'
                        : page === '...'
                        ? 'text-text-muted cursor-default'
                        : 'text-text-secondary hover:text-text-primary hover:bg-white/10'
                    }`}
                  >
                    {page}
                  </button>
                ));
              })()}

              {/* Next Button */}
              <button
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="w-10 h-10 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ›
              </button>

              {/* Page Info */}
              <span className="ml-4 text-xs text-text-muted">
                {allFilteredUsers.length} users
              </span>
            </div>
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
      />
    </div>
  );
}
