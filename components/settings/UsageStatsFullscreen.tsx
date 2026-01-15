"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Globe, Trophy, Coins, Zap, Calendar, ChevronDown } from "lucide-react";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { cn } from "@/lib/utils";
import Image from "next/image";

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

interface UsageStatsFullscreenProps {
  isOpen: boolean;
  onClose: () => void;
}

// Period filter options
type PeriodFilter = "3m" | "6m" | "12m" | "all";

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "3m", label: "3개월" },
  { value: "6m", label: "6개월" },
  { value: "12m", label: "12개월" },
  { value: "all", label: "전체" },
];

// Month names
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

// Get days in month
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Heatmap dot intensity based on tokens (returns opacity 0-1)
function getHeatmapIntensity(tokens: number, maxTokens: number): number {
  if (tokens === 0 || maxTokens === 0) return 0;
  return Math.min(tokens / (maxTokens * 0.5), 1);
}

// Format number
function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

// Format cost (compact)
function formatCost(cost: number): string {
  if (cost >= 1000) return `$${(cost / 1000).toFixed(1)}K`;
  if (cost >= 100) return `$${cost.toFixed(0)}`;
  if (cost >= 10) return `$${cost.toFixed(1)}`;
  return `$${cost.toFixed(2)}`;
}

// Generate list of year-months for the last N months
function generateMonthRange(monthsBack: number = 12): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  const today = new Date();

  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    result.push({ year: date.getFullYear(), month: date.getMonth() });
  }

  return result;
}

export function UsageStatsFullscreen({ isOpen, onClose }: UsageStatsFullscreenProps) {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("12m");
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate months based on filter
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

  // Generate months range (current month on the right)
  const monthRange = useMemo(() => generateMonthRange(monthsToShow), [monthsToShow]);

  // Fetch data
  useEffect(() => {
    if (!isOpen) return;

    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch user data
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

        // Fetch history (365 days)
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
  }, [isOpen]);

  // Scroll to right side (current month) when loaded
  useEffect(() => {
    if (!isLoading && tableRef.current) {
      const scrollContainer = tableRef.current;
      setTimeout(() => {
        scrollContainer.scrollLeft = scrollContainer.scrollWidth;
      }, 100);
    }
  }, [isLoading, monthsToShow]);

  // Close dropdown when clicking outside
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

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Process data into year/month/day structure
  const { dataMap, monthTotals, maxDailyTokens, periodTotal } = useMemo(() => {
    const dataMap: Map<string, HistoryEntry> = new Map();
    const monthTotals: Map<string, { tokens: number; cost: number }> = new Map();
    let maxDailyTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;

    // Initialize month totals
    monthRange.forEach(({ year, month }) => {
      const key = `${year}-${month}`;
      monthTotals.set(key, { tokens: 0, cost: 0 });
    });

    // Fill data
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

  // Group months by year for header display
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

  if (!isOpen) return null;

  const today = new Date();
  const currentYear = today.getFullYear();

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] bg-[#07070a]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Content Container */}
        <div className="h-full overflow-auto">
          <div className="min-h-full px-6 py-4 max-w-[1800px] mx-auto">
            {/* Compact Header with Inline Stats */}
            <header className="flex items-center justify-between mb-3">
              {/* Left: Logo */}
              <div className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="CCgather"
                  width={24}
                  height={24}
                  className="rounded-md"
                />
                <span className="text-sm font-bold text-white">CCgather</span>
              </div>

              {/* Center: Inline Stats Pills */}
              {userStats && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                    <Zap className="w-3 h-3 text-orange-400" />
                    <span className="text-[11px] font-semibold text-orange-400">
                      {formatNumber(userStats.total_tokens)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                    <Coins className="w-3 h-3 text-amber-400" />
                    <span className="text-[11px] font-semibold text-amber-400">
                      ${userStats.total_cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span className="text-[11px] font-semibold text-white">
                      Lv.{userStats.current_level}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                    <Globe className="w-3 h-3 text-zinc-400" />
                    <span className="text-[11px] font-medium text-white">
                      #{userStats.global_rank || "-"}
                    </span>
                  </div>
                  {userStats.country_code && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                      <FlagIcon countryCode={userStats.country_code} size="sm" />
                      <span className="text-[11px] font-medium text-white">
                        #{userStats.country_rank || "-"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Right: User & Close */}
              <div className="flex items-center gap-2">
                {userStats && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                    {userStats.avatar_url && (
                      <img
                        src={userStats.avatar_url}
                        alt={userStats.username}
                        className="w-4 h-4 rounded-full"
                      />
                    )}
                    <span className="text-[11px] font-medium text-zinc-300">
                      @{userStats.username}
                    </span>
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {isLoading ? (
              <div className="flex items-center justify-center h-[60vh]">
                <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Title with Period Filter */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-zinc-500" />
                    <h2 className="text-sm font-semibold text-white">Usage Heatmap</h2>
                    <span className="text-xs text-zinc-600">
                      (<span className="text-orange-400">{formatNumber(periodTotal.tokens)}</span>{" "}
                      tokens, <span className="text-amber-400">{formatCost(periodTotal.cost)}</span>
                      )
                    </span>
                  </div>

                  {/* Period Filter Dropdown */}
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
                  <table className="w-full border-collapse" style={{ minWidth: "1100px" }}>
                    {/* Year Header Row */}
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
                      {/* Month Header Row */}
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
                                "px-1 py-2 text-[10px] font-semibold text-center border-b border-white/10",
                                isCurrentMonth ? "text-white bg-orange-400/10" : "text-zinc-500"
                              )}
                              style={{ minWidth: "90px" }}
                            >
                              {MONTHS_SHORT[month]}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Days 1-31 */}
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

                              // Calculate heatmap intensity based on tokens
                              const intensity = entry
                                ? getHeatmapIntensity(entry.tokens, maxDailyTokens)
                                : 0;

                              return (
                                <td key={`${year}-${month}-${day}`} className="px-1 py-0.5">
                                  {!isValidDay ? (
                                    <div className="h-6" />
                                  ) : isFuture ? (
                                    <div className="h-6 mx-0.5 rounded" />
                                  ) : entry && entry.tokens > 0 ? (
                                    <div
                                      className={cn(
                                        "h-6 mx-0.5 rounded flex items-center justify-center gap-1 transition-transform hover:scale-[1.02] cursor-default",
                                        isToday &&
                                          "ring-2 ring-orange-400 ring-offset-1 ring-offset-[#0a0a0d]"
                                      )}
                                      title={`${entry.date}\nTokens: ${formatNumber(entry.tokens)}\nCost: $${entry.cost.toFixed(2)}`}
                                    >
                                      {/* Cost (yellow) */}
                                      <span className="text-[9px] font-medium text-amber-400">
                                        {formatCost(entry.cost)}
                                      </span>
                                      {/* Token (primary/coral) */}
                                      <span className="text-[9px] font-medium text-orange-400">
                                        {formatNumber(entry.tokens)}
                                      </span>
                                      {/* Heatmap dot based on tokens */}
                                      <span
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{
                                          backgroundColor: `rgba(218, 119, 86, ${0.2 + intensity * 0.8})`,
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div
                                      className={cn(
                                        "h-6 mx-0.5 rounded flex items-center justify-center text-[9px] text-zinc-700",
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
                                "px-1 py-2 text-center",
                                isCurrentMonth && "bg-orange-400/5"
                              )}
                            >
                              {monthTotal && monthTotal.tokens > 0 ? (
                                <div className="flex items-center justify-center gap-1">
                                  <span className="text-[9px] font-semibold text-amber-400">
                                    {formatCost(monthTotal.cost)}
                                  </span>
                                  <span className="text-[9px] font-semibold text-orange-400">
                                    {formatNumber(monthTotal.tokens)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[9px] text-zinc-700">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer - Heatmap Legend */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                    <span>Tokens:</span>
                    <span>Less</span>
                    <div className="flex gap-1">
                      {[0.2, 0.4, 0.6, 0.8, 1.0].map((opacity) => (
                        <div
                          key={opacity}
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: `rgba(218, 119, 86, ${opacity})` }}
                        />
                      ))}
                    </div>
                    <span>More</span>
                  </div>
                  <p className="text-[10px] text-zinc-600">Generated by CCgather.dev</p>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
