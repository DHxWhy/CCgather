"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { Globe, Trophy, Coins, Zap, ChevronDown } from "lucide-react";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format";

interface UserStats {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  country_code: string;
  current_level: number;
  global_rank: number;
  country_rank: number;
  total_tokens: number;
  total_cost: number;
}

interface HistoryEntry {
  date: string;
  tokens: number;
  cost: number;
}

type PeriodFilter = "3m" | "6m" | "12m" | "all";

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "3m", label: "3개월" },
  { value: "6m", label: "6개월" },
  { value: "12m", label: "12개월" },
  { value: "all", label: "전체" },
];

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getHeatmapIntensity(tokens: number, maxTokens: number): number {
  if (tokens === 0 || maxTokens === 0) return 0;
  return Math.min(tokens / (maxTokens * 0.5), 1);
}

function formatCost(cost: number): string {
  if (cost >= 1000) return `$${(cost / 1000).toFixed(1)}K`;
  if (cost >= 100) return `$${cost.toFixed(0)}`;
  if (cost >= 10) return `$${cost.toFixed(1)}`;
  return `$${cost.toFixed(2)}`;
}

function generateMonthRange(monthsBack: number = 12): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  const today = new Date();

  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    result.push({ year: date.getFullYear(), month: date.getMonth() });
  }

  return result;
}

export default function SettingsUsagePage() {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("12m");
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const monthsToShow = useMemo(() => {
    switch (periodFilter) {
      case "3m":
        return 3;
      case "6m":
        return 6;
      case "12m":
        return 12;
      case "all":
        return Math.max(
          12,
          Math.ceil(
            (Date.now() - new Date(history[0]?.date || Date.now()).getTime()) /
              (30 * 24 * 60 * 60 * 1000)
          ) + 1
        );
      default:
        return 12;
    }
  }, [periodFilter, history]);

  const monthRange = useMemo(() => generateMonthRange(monthsToShow), [monthsToShow]);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const meRes = await fetch("/api/me");
        if (!meRes.ok) throw new Error("Failed to fetch user");
        const meData = await meRes.json();

        setUserStats({
          id: meData.user.id,
          username: meData.user.username,
          display_name: meData.user.display_name,
          avatar_url: meData.user.avatar_url,
          country_code: meData.user.country_code,
          current_level: meData.user.current_level || 1,
          global_rank: meData.user.global_rank || 0,
          country_rank: meData.user.country_rank || 0,
          total_tokens: meData.user.total_tokens || 0,
          total_cost: meData.user.total_cost || 0,
        });

        // Fetch all history (use large number to get everything)
        const historyRes = await fetch(`/api/users/${meData.user.id}/history?days=3650`);
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setHistory(historyData.history || []);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    if (!isLoading && tableRef.current) {
      const scrollContainer = tableRef.current;
      setTimeout(() => {
        scrollContainer.scrollLeft = scrollContainer.scrollWidth;
      }, 100);
    }
  }, [isLoading, monthsToShow]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsPeriodDropdownOpen(false);
      }
    };

    if (isPeriodDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPeriodDropdownOpen]);

  const { dataMap, monthTotals, maxDailyTokens } = useMemo(() => {
    const dataMap: Map<string, HistoryEntry> = new Map();
    const monthTotals: Map<string, { tokens: number; cost: number }> = new Map();
    let maxDailyTokens = 0;

    monthRange.forEach(({ year, month }) => {
      const key = `${year}-${month}`;
      monthTotals.set(key, { tokens: 0, cost: 0 });
    });

    history.forEach((entry) => {
      const date = new Date(entry.date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();

      const dateKey = `${year}-${month}-${day}`;
      const monthKey = `${year}-${month}`;

      dataMap.set(dateKey, entry);

      const monthTotal = monthTotals.get(monthKey);
      if (monthTotal) {
        monthTotal.tokens += entry.tokens;
        monthTotal.cost += entry.cost;
      }

      if (entry.tokens > maxDailyTokens) maxDailyTokens = entry.tokens;
    });

    return { dataMap, monthTotals, maxDailyTokens };
  }, [history, monthRange]);

  const yearGroups = useMemo(() => {
    const groups: { year: number; startIndex: number; count: number }[] = [];
    let currentYear: number | null = null;
    let startIndex = 0;
    let count = 0;

    monthRange.forEach((item, index) => {
      if (item.year !== currentYear) {
        if (currentYear !== null) {
          groups.push({ year: currentYear, startIndex, count });
        }
        currentYear = item.year;
        startIndex = index;
        count = 1;
      } else {
        count++;
      }
    });

    if (currentYear !== null) {
      groups.push({ year: currentYear, startIndex, count });
    }

    return groups;
  }, [monthRange]);

  const today = new Date();
  const currentYear = today.getFullYear();

  return (
    <div className="p-4 sm:p-6 space-y-2">
      {/* Header - Single Row: Title + Stats | Avatar + Filter */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: Title + Stats Pills */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mr-1">Heatmap</h2>
          {userStats && (
            <>
              <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-[var(--color-filter-bg)] border border-[var(--border-default)]">
                <Zap className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[var(--color-claude-coral)]" />
                <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-claude-coral)]">
                  {formatNumber(userStats.total_tokens)}
                </span>
                <span className="hidden sm:inline text-[10px] text-[var(--color-text-muted)]">
                  tokens
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-[var(--color-filter-bg)] border border-[var(--border-default)]">
                <Coins className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[var(--color-cost)]" />
                <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-cost)]">
                  ${userStats.total_cost.toFixed(2)}
                </span>
                <span className="hidden sm:inline text-[10px] text-[var(--color-text-muted)]">
                  cost
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-[var(--color-filter-bg)] border border-[var(--border-default)]">
                <Trophy className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[var(--color-cost)]" />
                <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-text-primary)]">
                  Lv.{userStats.current_level}
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-[var(--color-filter-bg)] border border-[var(--border-default)]">
                <Globe className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[var(--color-text-muted)]" />
                <span className="text-[11px] sm:text-xs font-medium text-[var(--color-text-primary)]">
                  #{userStats.global_rank || "-"}
                </span>
              </div>
              {userStats.country_code && (
                <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-[var(--color-filter-bg)] border border-[var(--border-default)]">
                  <FlagIcon countryCode={userStats.country_code} size="sm" />
                  <span className="text-[11px] sm:text-xs font-medium text-[var(--color-text-primary)]">
                    #{userStats.country_rank || "-"}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Avatar + Filter */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {userStats && (
            <div className="flex items-center gap-1.5 min-w-0">
              {userStats.avatar_url ? (
                <Image
                  src={userStats.avatar_url}
                  alt={userStats.username}
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
                  {userStats.username.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="hidden sm:inline text-sm font-medium text-text-primary truncate max-w-[100px]">
                {userStats.display_name || userStats.username}
              </span>
            </div>
          )}
          {/* Period Filter */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[var(--color-filter-bg)] border border-[var(--border-default)] text-[11px] sm:text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-filter-hover)] transition-colors"
            >
              <span>{PERIOD_OPTIONS.find((o) => o.value === periodFilter)?.label}</span>
              <ChevronDown
                className={cn(
                  "w-3 sm:w-3.5 h-3 sm:h-3.5 transition-transform",
                  isPeriodDropdownOpen && "rotate-180"
                )}
              />
            </button>

            {isPeriodDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-xl overflow-hidden">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setPeriodFilter(option.value);
                      setIsPeriodDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs text-left hover:bg-[var(--color-filter-hover)] transition-colors",
                      periodFilter === option.value
                        ? "text-[var(--color-claude-coral)] bg-[var(--color-claude-coral)]/10"
                        : "text-[var(--color-text-secondary)]"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Heatmap Table */}
          <div className="relative">
            {/* Mobile scroll hint */}
            <div className="sm:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--color-bg-primary)] to-transparent pointer-events-none z-10 rounded-r-xl" />
            <div
              ref={tableRef}
              className="overflow-x-auto rounded-xl border border-[var(--border-default)] bg-[var(--color-section-bg)] flex justify-center"
            >
              <table className="border-collapse" style={{ width: "auto" }}>
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 bg-[var(--color-bg-primary)] w-10" />
                    {yearGroups.map((group) => {
                      const isCurrentYear = group.year === currentYear;
                      return (
                        <th
                          key={group.year}
                          colSpan={group.count}
                          className={cn(
                            "px-2 py-1.5 text-[11px] font-bold text-center border-b border-[var(--border-default)]",
                            isCurrentYear
                              ? "text-[var(--color-text-primary)] bg-[var(--color-claude-coral)]/20"
                              : "text-[var(--color-text-muted)] bg-[var(--color-section-bg)]"
                          )}
                        >
                          {group.year}
                        </th>
                      );
                    })}
                  </tr>
                  <tr>
                    <th className="sticky left-0 z-20 bg-[var(--color-bg-primary)] px-2 py-2 text-[10px] font-semibold text-[var(--color-text-muted)] text-center border-b border-r border-[var(--border-default)] w-10">
                      Day
                    </th>
                    {monthRange.map(({ year, month }) => {
                      const isCurrentMonth =
                        year === today.getFullYear() && month === today.getMonth();
                      return (
                        <th
                          key={`${year}-${month}`}
                          className={cn(
                            "px-1 py-1.5 sm:py-2 text-[9px] sm:text-[10px] font-semibold text-center border-b border-r border-[var(--border-default)] min-w-[90px] sm:min-w-[110px] max-w-[120px] sm:max-w-[140px]",
                            isCurrentMonth
                              ? "text-[var(--color-text-primary)] bg-[var(--color-claude-coral)]/10"
                              : "text-[var(--color-text-muted)]"
                          )}
                        >
                          {MONTHS_SHORT[month]}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 31 }, (_, dayIndex) => {
                    const day = dayIndex + 1;

                    return (
                      <tr key={day} className="hover:bg-[var(--color-table-row-hover)]">
                        <td className="sticky left-0 z-10 bg-[var(--color-bg-primary)] px-2 py-px text-[10px] font-medium text-[var(--color-text-muted)] text-center border-r border-[var(--border-default)]">
                          {day}
                        </td>
                        {monthRange.map(({ year, month }) => {
                          const daysInMonth = getDaysInMonth(year, month);
                          const dateKey = `${year}-${month}-${day}`;
                          const entry = dataMap.get(dateKey);
                          const isValidDay = day <= daysInMonth;
                          const isToday =
                            year === today.getFullYear() &&
                            month === today.getMonth() &&
                            day === today.getDate();
                          const isFuture = new Date(year, month, day) > today;

                          const intensity = entry
                            ? getHeatmapIntensity(entry.tokens, maxDailyTokens)
                            : 0;

                          return (
                            <td
                              key={`${year}-${month}-${day}`}
                              className="px-1 py-0.5 border-r border-[var(--border-default)] min-w-[90px] sm:min-w-[110px] max-w-[120px] sm:max-w-[140px]"
                            >
                              {!isValidDay ? (
                                <div className="h-5" />
                              ) : isFuture ? (
                                <div className="h-5 mx-0.5 rounded" />
                              ) : entry && entry.tokens > 0 ? (
                                <div
                                  className={cn(
                                    "h-5 mx-0.5 px-1.5 rounded flex items-center justify-between transition-transform hover:scale-[1.02] cursor-default",
                                    "bg-[var(--color-claude-coral)]/20",
                                    isToday &&
                                      "ring-2 ring-[var(--color-claude-coral)] ring-offset-1 ring-offset-[var(--color-bg-primary)]"
                                  )}
                                  title={`${entry.date}\nTokens: ${formatNumber(entry.tokens)}\nCost: $${entry.cost.toFixed(2)}`}
                                >
                                  <span className="text-[10px] font-medium text-[var(--color-cost)] text-left">
                                    {formatCost(entry.cost)}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-medium text-[var(--color-claude-coral)] text-right">
                                      {formatNumber(entry.tokens)}
                                    </span>
                                    <span
                                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                      style={{
                                        backgroundColor: `rgba(218, 119, 86, ${0.5 + intensity * 0.5})`,
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={cn(
                                    "h-5 mx-0.5 rounded flex items-center justify-center text-[10px] text-[var(--color-text-disabled)]",
                                    isToday && "ring-1 ring-[var(--color-claude-coral)]/50"
                                  )}
                                >
                                  -
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* Monthly Summary Row */}
                  <tr className="bg-[var(--color-section-bg)] border-t border-[var(--border-default)]">
                    <td className="sticky left-0 z-10 bg-[var(--color-bg-secondary)] px-2 py-2 text-[10px] font-semibold text-[var(--color-text-muted)] text-center border-r border-[var(--border-default)]">
                      Sum
                    </td>
                    {monthRange.map(({ year, month }) => {
                      const monthKey = `${year}-${month}`;
                      const monthTotal = monthTotals.get(monthKey);
                      const isCurrentMonth =
                        year === today.getFullYear() && month === today.getMonth();

                      return (
                        <td
                          key={monthKey}
                          className={cn(
                            "px-1.5 py-2 border-r border-[var(--border-default)] min-w-[90px] sm:min-w-[110px] max-w-[120px] sm:max-w-[140px]",
                            isCurrentMonth && "bg-[var(--color-claude-coral)]/5"
                          )}
                        >
                          {monthTotal && monthTotal.tokens > 0 ? (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-[var(--color-cost)] text-left">
                                {formatCost(monthTotal.cost)}
                              </span>
                              <span className="text-[10px] font-semibold text-[var(--color-claude-coral)] text-right">
                                {formatNumber(monthTotal.tokens)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[var(--color-text-disabled)] block text-center">
                              -
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 text-[10px] text-[var(--color-text-muted)]">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden sm:inline">Tokens:</span>
              <span>Less</span>
              <div className="flex gap-0.5 sm:gap-1">
                {[0.3, 0.45, 0.6, 0.8, 1.0].map((opacity) => (
                  <div
                    key={opacity}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: `rgba(218, 119, 86, ${opacity})` }}
                  />
                ))}
              </div>
              <span>More</span>
            </div>
            <span className="sm:hidden text-[var(--color-text-disabled)]">← swipe →</span>
          </div>
        </>
      )}
    </div>
  );
}
