"use client";

import { motion } from "framer-motion";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { formatNumber, formatCost } from "@/lib/utils/format";

interface CountryStat {
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
}

export function TopCountriesSection({
  stats,
  totalTokens,
  totalCost,
  sortBy = "tokens",
  userCountryCode,
  maxItems = 10,
  className = "",
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
              ? "linear-gradient(90deg, var(--color-claude-coral) 0%, rgba(229, 115, 89, 0.5) 100%)"
              : "linear-gradient(90deg, #10b981 0%, rgba(16, 185, 129, 0.5) 100%)";
          const isUserCountry =
            userCountryCode && stat.code.toUpperCase() === userCountryCode.toUpperCase();

          return (
            <motion.div
              key={stat.code}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`group relative px-3 py-2 rounded-lg transition-colors ${
                isUserCountry
                  ? "bg-emerald-500/10 ring-1 ring-emerald-500/30 ring-inset"
                  : "hover:bg-[var(--glass-bg)]"
              }`}
            >
              {/* Row 1: Rank, Flag, Country Name, Stats */}
              <div className="flex items-center gap-2 mb-1.5">
                {/* Rank */}
                <span className="w-6 text-xs font-mono text-[var(--color-text-muted)]">
                  #{index + 1}
                </span>

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

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-[var(--color-cost)]">{formatCost(stat.cost)}</span>
                  <span className="text-[var(--color-claude-coral)]">
                    {formatNumber(stat.tokens)}
                  </span>
                  <span className="text-[var(--color-text-muted)] w-12 text-right">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Row 2: Full-width Progress Bar */}
              <div className="h-1.5 bg-[var(--color-filter-bg)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{
                    duration: 0.8,
                    delay: 0.2 + index * 0.03,
                    ease: "easeOut",
                  }}
                  className="h-full rounded-full"
                  style={{ background: barColor }}
                />
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
