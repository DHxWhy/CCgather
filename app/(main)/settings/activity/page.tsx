"use client";

import { useState, useEffect } from "react";
import { Activity, Calendar, BarChart3 } from "lucide-react";
import Link from "next/link";

interface HistoryEntry {
  date: string;
  tokens: number;
  cost: number;
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

        const historyRes = await fetch(`/api/users/${userId}/history?days=30`);
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Calculate totals
  const totalTokens = history.reduce((acc, entry) => acc + entry.tokens, 0);
  const totalCost = history.reduce((acc, entry) => acc + entry.cost, 0);
  const activeDays = history.length;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">
          Submission History
        </h2>
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
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{activeDays}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Active Days</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
            <p className="text-2xl font-bold text-[var(--color-cost)]">${totalCost.toFixed(2)}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Total Cost</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
            <p className="text-2xl font-bold text-[var(--color-claude-coral)]">
              {formatNumber(totalTokens)}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Total Tokens</p>
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--color-text-muted)]">Your daily usage data (last 30 days)</p>

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
        <div className="space-y-2">
          {history
            .slice()
            .reverse()
            .map((entry) => (
              <div
                key={entry.date}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--border-default)] hover:border-[var(--border-hover)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-claude-coral)]/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-[var(--color-claude-coral)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {formatDate(entry.date)}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">{entry.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div className="min-w-[60px]">
                    <p className="text-sm font-medium text-[var(--color-cost)]">
                      ${entry.cost.toFixed(2)}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">cost</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {formatNumber(entry.tokens)}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">tokens</p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
