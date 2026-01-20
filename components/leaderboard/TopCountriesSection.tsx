"use client";

import { motion } from "framer-motion";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { formatNumber, formatCost } from "@/lib/utils/format";

export interface CountryStat {
  code: string;
  name: string;
  tokens: number;
  cost: number;
}

interface TopCountriesSectionProps {
  stats: CountryStat[];
  totalTokens: number;
  totalCost: number;
  sortBy?: "tokens" | "cost";
  userCountryCode?: string;
  maxItems?: number;
  className?: string;
  compact?: boolean; // Compact layout for narrow viewports
}

export function TopCountriesSection({
  stats,
  totalTokens,
  totalCost,
  sortBy = "tokens",
  userCountryCode,
  maxItems = 10,
  className = "",
  compact = false,
}: TopCountriesSectionProps) {
  // Sort stats based on selected criteria
  const sortedStats = [...stats]
    .sort((a, b) => (sortBy === "tokens" ? b.tokens - a.tokens : b.cost - a.cost))
    .slice(0, maxItems);

  // Calculate max values for progress bars
  const maxTokens = Math.max(...stats.map((s) => s.tokens), 1);
  const maxCost = Math.max(...stats.map((s) => s.cost), 1);

  if (sortedStats.length === 0) {
    return null;
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
          🏆 Top Countries
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">
          by {sortBy === "tokens" ? "Token Usage" : "Cost"}
        </span>
      </div>

      {/* Country List - Single column for better width utilization */}
      <div className="flex flex-col gap-2">
        {sortedStats.map((stat, index) => {
          const percentage =
            sortBy === "tokens" ? (stat.tokens / totalTokens) * 100 : (stat.cost / totalCost) * 100;
          const barWidth =
            sortBy === "tokens" ? (stat.tokens / maxTokens) * 100 : (stat.cost / maxCost) * 100;
          const barColor =
            sortBy === "tokens"
              ? "linear-gradient(90deg, rgba(229, 115, 89, 0.5) 0%, var(--color-claude-coral) 100%)"
              : "linear-gradient(90deg, rgba(245, 158, 11, 0.5) 0%, #f59e0b 100%)";
          const isUserCountry =
            userCountryCode && stat.code.toUpperCase() === userCountryCode.toUpperCase();

          return (
            <motion.div
              key={stat.code}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isUserCountry
                  ? "bg-emerald-500/10 ring-1 ring-emerald-500/30 ring-inset"
                  : "hover:bg-[var(--glass-bg)]"
              }`}
            >
              {/* Rank - vertically centered between two rows */}
              <span className="w-6 text-xs font-mono text-[var(--color-text-muted)] flex-shrink-0">
                #{index + 1}
              </span>

              {/* Right content: Two rows */}
              <div className="flex-1 min-w-0">
                {/* Row 1: Flag, Country Name ... Cost, Tokens */}
                <div className="flex items-center gap-2 mb-1.5">
                  {/* Flag */}
                  <FlagIcon countryCode={stat.code} size="sm" />

                  {/* Country name */}
                  <span
                    className={`text-sm font-medium flex-1 truncate ${
                      isUserCountry ? "text-emerald-400" : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    {stat.name}
                    {isUserCountry && <span className="ml-1 text-[10px]">🟢</span>}
                  </span>

                  {/* Cost & Tokens (right aligned) - dimmed based on sortBy */}
                  {/* Compact: only show unselected value, Default: show both */}
                  <div className={`flex items-center gap-2 font-mono ${compact ? "text-[10px] pr-2" : "text-xs"}`}>
                    {compact ? (
                      /* Compact: only unselected value */
                      sortBy === "tokens" ? (
                        <span className="text-[var(--color-text-muted)]">{formatCost(stat.cost)}</span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">{formatNumber(stat.tokens)}</span>
                      )
                    ) : (
                      /* Default: both values */
                      <>
                        <span className={sortBy === "tokens" ? "text-[var(--color-text-muted)]" : "text-[var(--color-cost)]"}>
                          {formatCost(stat.cost)}
                        </span>
                        <span className={sortBy === "cost" ? "text-[var(--color-text-muted)]" : "text-[var(--color-claude-coral)]"}>
                          {formatNumber(stat.tokens)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Row 2: Progress Bar with overlays */}
                <div className="relative">
                  {/* Progress Bar */}
                  <div className="h-4 bg-[var(--color-filter-bg)] rounded overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{
                        duration: 0.8,
                        delay: 0.2 + index * 0.03,
                        ease: "easeOut",
                      }}
                      className="h-full rounded"
                      style={{ background: barColor }}
                    />
                  </div>

                  {/* Overlays on gauge */}
                  {/* Percentage always left */}
                  <span className="absolute inset-0 flex items-center justify-start pl-2 text-[10px] font-mono text-white/50">
                    {percentage.toFixed(1)}%
                  </span>
                  {/* Compact: Selected value right */}
                  {compact && (
                    <span className={`absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-mono ${
                      sortBy === "tokens" ? "text-[var(--color-claude-coral)]" : "text-[var(--color-cost)]"
                    }`}>
                      {sortBy === "tokens" ? formatNumber(stat.tokens) : formatCost(stat.cost)}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Onboarding Copy */}
      <p className="text-center text-[11px] text-[var(--color-text-muted)]/60 mt-4">
        More developers = stronger country ranking
      </p>
    </div>
  );
}
