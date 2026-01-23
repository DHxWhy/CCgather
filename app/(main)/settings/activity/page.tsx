"use client";

import { useState, useEffect, useMemo } from "react";
import { Activity, BarChart3 } from "lucide-react";
import Link from "next/link";

interface HistoryEntry {
  date: string;
  tokens: number;
  cost: number;
}

interface YearGroup {
  year: string; // "2026"
  entries: HistoryEntry[];
  totalTokens: number;
  totalCost: number;
}

function getDayOfWeek(dateStr: string): number {
  // Returns 0 (Sunday) to 6 (Saturday)
  return new Date(dateStr).getDay();
}

export default function SettingsActivityPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const meRes = await fetch("/api/me");
        if (!meRes.ok) throw new Error("Failed to fetch user");
        const meData = await meRes.json();
        const userId = meData.user?.id;
        if (!userId) throw new Error("User ID not found");

        // Fetch all history (use large number to get everything)
        const historyRes = await fetch(`/api/users/${userId}/history?days=3650`);
        if (!historyRes.ok) throw new Error("Failed to fetch history");
        const historyData = await historyRes.json();
        setHistory(historyData.history || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        setIsLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  // Group history by year
  const yearGroups = useMemo(() => {
    const groups: Map<string, YearGroup> = new Map();

    history.forEach((entry) => {
      const year = entry.date.substring(0, 4); // "2026"
      if (!groups.has(year)) {
        groups.set(year, { year, entries: [], totalTokens: 0, totalCost: 0 });
      }
      const group = groups.get(year)!;
      group.entries.push(entry);
      group.totalTokens += entry.tokens;
      group.totalCost += entry.cost;
    });

    // Sort entries within each group by date descending
    groups.forEach((group) => {
      group.entries.sort((a, b) => b.date.localeCompare(a.date));
    });

    // Return groups sorted by year descending
    return Array.from(groups.values()).sort((a, b) => b.year.localeCompare(a.year));
  }, [history]);

  // Calculate totals
  const totalTokens = history.reduce((acc, entry) => acc + entry.tokens, 0);
  const totalCost = history.reduce((acc, entry) => acc + entry.cost, 0);
  const activeDays = history.length;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">Activity</h2>
        <Link
          href="/settings/usage"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/5 transition-colors"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>View Heatmap</span>
        </Link>
      </div>

      {/* Summary Stats */}
      {!isLoading && !error && history.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">{activeDays}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Active Days</p>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
            <p className="text-lg font-semibold text-[var(--color-cost)]">
              ${totalCost.toFixed(2)}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Total Cost</p>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
            <p className="text-lg font-semibold text-[var(--color-claude-coral)]">
              {formatNumber(totalTokens)}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Total Tokens</p>
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--color-text-muted)]">Your complete usage history</p>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-14 bg-white/[0.03] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
          <Activity className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3 opacity-50" />
          <p className="text-[var(--color-text-muted)] text-sm font-medium">
            No submission history yet
          </p>
          <p className="text-[var(--color-text-muted)] text-xs mt-1">
            Run{" "}
            <code className="text-[var(--color-claude-coral)] px-1.5 py-0.5 rounded bg-[var(--color-claude-coral)]/10">
              npx ccgather
            </code>{" "}
            to submit
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {yearGroups.map((group) => (
            <div key={group.year}>
              {/* Year Header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  {group.year}
                </span>
                <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
                  <span>
                    <span className="text-[var(--color-cost)]">${group.totalCost.toFixed(2)}</span>
                  </span>
                  <span>
                    <span className="text-[var(--color-claude-coral)]">
                      {formatNumber(group.totalTokens)}
                    </span>
                  </span>
                </div>
              </div>

              {/* Day Entries */}
              <div className="rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--border-default)] overflow-hidden">
                {group.entries.map((entry, idx) => {
                  const monthDay = entry.date.substring(5); // "01-15"
                  const dayOfWeek = getDayOfWeek(entry.date);
                  const isSaturday = dayOfWeek === 6;
                  const isSunday = dayOfWeek === 0;

                  return (
                    <div
                      key={entry.date}
                      className={`flex items-center justify-between px-3 py-2 hover:bg-white/[0.02] transition-colors ${
                        idx !== group.entries.length - 1
                          ? "border-b border-[var(--border-default)]"
                          : ""
                      }`}
                    >
                      <span
                        className={`text-xs font-light w-12 tabular-nums ${
                          isSunday
                            ? "text-red-400/70"
                            : isSaturday
                              ? "text-blue-400/70"
                              : "text-[var(--color-text-muted)]"
                        }`}
                      >
                        {monthDay}
                      </span>
                      <div className="flex items-center gap-4 text-right tabular-nums">
                        <span className="text-xs font-medium text-[var(--color-cost)] min-w-[70px]">
                          ${entry.cost.toFixed(2)}
                        </span>
                        <span className="text-xs font-medium text-[var(--color-text-primary)] min-w-[50px]">
                          {formatNumber(entry.tokens)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
