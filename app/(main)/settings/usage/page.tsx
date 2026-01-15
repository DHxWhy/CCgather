"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Globe, Trophy, Coins, Zap, Calendar, ChevronDown } from "lucide-react";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { cn } from "@/lib/utils";

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

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
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

        const historyRes = await fetch(`/api/users/${meData.user.id}/history?days=365`);
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

  const { dataMap, monthTotals, maxDailyTokens, periodTotal } = useMemo(() => {
    const dataMap: Map<string, HistoryEntry> = new Map();
    const monthTotals: Map<string, { tokens: number; cost: number }> = new Map();
    let maxDailyTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;

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

      totalTokens += entry.tokens;
      totalCost += entry.cost;

      if (entry.tokens > maxDailyTokens) maxDailyTokens = entry.tokens;
    });

    return {
      dataMap,
      monthTotals,
      maxDailyTokens,
      periodTotal: { tokens: totalTokens, cost: totalCost },
    };
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
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
          Usage Heatmap
        </h2>
        {userStats && (
          <div className="flex items-center gap-2">
            {userStats.avatar_url ? (
              <img
                src={userStats.avatar_url}
                alt={userStats.username}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-xs font-semibold text-white">
                {userStats.username.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium text-text-primary">
              {userStats.display_name || userStats.username}
            </span>
          </div>
        )}
      </div>

      {/* Stats Pills */}
      {userStats && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-semibold text-orange-400">
              {formatNumber(userStats.total_tokens)}
            </span>
            <span className="text-[10px] text-text-muted">tokens</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400">
              ${userStats.total_cost.toFixed(2)}
            </span>
            <span className="text-[10px] text-text-muted">cost</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-white">Lv.{userStats.current_level}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <Globe className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs font-medium text-white">#{userStats.global_rank || "-"}</span>
          </div>
          {userStats.country_code && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <FlagIcon countryCode={userStats.country_code} size="sm" />
              <span className="text-xs font-medium text-white">
                #{userStats.country_rank || "-"}
              </span>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Title with Period Filter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-600">
                <span className="text-orange-400">{formatNumber(periodTotal.tokens)}</span> tokens,{" "}
                <span className="text-amber-400">{formatCost(periodTotal.cost)}</span>
              </span>
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-300 hover:bg-white/10 transition-colors"
              >
                <span>{PERIOD_OPTIONS.find((o) => o.value === periodFilter)?.label}</span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    isPeriodDropdownOpen && "rotate-180"
                  )}
                />
              </button>

              {isPeriodDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-[#18181b] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                  {PERIOD_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setPeriodFilter(option.value);
                        setIsPeriodDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2 text-xs text-left hover:bg-white/10 transition-colors",
                        periodFilter === option.value
                          ? "text-orange-400 bg-orange-400/10"
                          : "text-zinc-300"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Heatmap Table */}
          <div
            ref={tableRef}
            className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]"
          >
            <table className="w-full border-collapse" style={{ minWidth: "900px" }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-[#0a0a0d] w-10" />
                  {yearGroups.map((group) => {
                    const isCurrentYear = group.year === currentYear;
                    return (
                      <th
                        key={group.year}
                        colSpan={group.count}
                        className={cn(
                          "px-2 py-1.5 text-[11px] font-bold text-center border-b border-white/5",
                          isCurrentYear
                            ? "text-white bg-orange-400/20"
                            : "text-zinc-500 bg-white/[0.03]"
                        )}
                      >
                        {group.year}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  <th className="sticky left-0 z-20 bg-[#0a0a0d] px-2 py-2 text-[10px] font-semibold text-zinc-500 text-center border-b border-r border-white/10 w-10">
                    Day
                  </th>
                  {monthRange.map(({ year, month }) => {
                    const isCurrentMonth =
                      year === today.getFullYear() && month === today.getMonth();
                    return (
                      <th
                        key={`${year}-${month}`}
                        className={cn(
                          "px-1 py-2 text-[10px] font-semibold text-center border-b border-r border-white/10",
                          isCurrentMonth ? "text-white bg-orange-400/10" : "text-zinc-500"
                        )}
                        style={{ minWidth: "80px" }}
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
                    <tr key={day} className="hover:bg-white/[0.015]">
                      <td className="sticky left-0 z-10 bg-[#0a0a0d] px-2 py-0.5 text-[10px] font-medium text-zinc-600 text-center border-r border-white/10">
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
                            className="px-1 py-0.5 border-r border-white/5"
                          >
                            {!isValidDay ? (
                              <div className="h-6" />
                            ) : isFuture ? (
                              <div className="h-6 mx-0.5 rounded" />
                            ) : entry && entry.tokens > 0 ? (
                              <div
                                className={cn(
                                  "h-6 mx-0.5 px-1.5 rounded flex items-center justify-between transition-transform hover:scale-[1.02] cursor-default",
                                  isToday &&
                                    "ring-2 ring-orange-400 ring-offset-1 ring-offset-[#0a0a0d]"
                                )}
                                title={`${entry.date}\nTokens: ${formatNumber(entry.tokens)}\nCost: $${entry.cost.toFixed(2)}`}
                              >
                                <span className="text-[10px] font-medium text-amber-400 text-left">
                                  {formatCost(entry.cost)}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-medium text-orange-400 text-right">
                                    {formatNumber(entry.tokens)}
                                  </span>
                                  <span
                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{
                                      backgroundColor: `rgba(251, 146, 60, ${0.2 + intensity * 0.8})`,
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "h-6 mx-0.5 rounded flex items-center justify-center text-[10px] text-zinc-700",
                                  isToday && "ring-1 ring-orange-400/50"
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
                <tr className="bg-white/[0.03] border-t border-white/10">
                  <td className="sticky left-0 z-10 bg-[#0f0f14] px-2 py-2 text-[10px] font-semibold text-zinc-500 text-center border-r border-white/10">
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
                          "px-1.5 py-2 border-r border-white/5",
                          isCurrentMonth && "bg-orange-400/5"
                        )}
                      >
                        {monthTotal && monthTotal.tokens > 0 ? (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-amber-400 text-left">
                              {formatCost(monthTotal.cost)}
                            </span>
                            <span className="text-[10px] font-semibold text-orange-400 text-right">
                              {formatNumber(monthTotal.tokens)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-700 block text-center">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] text-zinc-600">
            <span>Tokens:</span>
            <span>Less</span>
            <div className="flex gap-1">
              {[0.2, 0.4, 0.6, 0.8, 1.0].map((opacity) => (
                <div
                  key={opacity}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: `rgba(251, 146, 60, ${opacity})` }}
                />
              ))}
            </div>
            <span>More</span>
          </div>
        </>
      )}
    </div>
  );
}
