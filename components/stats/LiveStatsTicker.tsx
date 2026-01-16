"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { Coins, Sparkles, ChevronDown, Users } from "lucide-react";
import { CountryStatsModal } from "@/components/globe";

interface CountryStat {
  code: string;
  name: string;
  tokens: number;
  cost: number;
  users?: number;
}

interface ApiCountryStat {
  country_code: string;
  country_name: string;
  total_tokens: number;
  total_cost: number;
  total_users: number;
}

function formatNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
}

function formatCost(cost: number): string {
  if (cost >= 1e6) return `$${(cost / 1e6).toFixed(1)}M`;
  if (cost >= 1e3) return `$${(cost / 1e3).toFixed(1)}K`;
  return `$${cost}`;
}

interface LiveStatsTickerProps {
  variant?: "compact" | "full";
  className?: string;
  userCountryCode?: string;
}

export function LiveStatsTicker({
  variant = "compact",
  className = "",
  userCountryCode,
}: LiveStatsTickerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stats, setStats] = useState<CountryStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch country stats from API
  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/countries?stats=true");
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();

        // Transform API response to component format
        const transformedStats: CountryStat[] = (data.countries || []).map((c: ApiCountryStat) => ({
          code: c.country_code,
          name: c.country_name,
          tokens: c.total_tokens || 0,
          cost: c.total_cost || 0,
          users: c.total_users || 0,
        }));

        setStats(transformedStats);
      } catch (error) {
        console.error("Failed to fetch country stats:", error);
        setStats([]);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  // Rotate through countries
  useEffect(() => {
    if (stats.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % stats.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [stats.length]);

  // Calculate totals
  const totalTokens = stats.reduce((sum, s) => sum + s.tokens, 0);
  const totalCost = stats.reduce((sum, s) => sum + s.cost, 0);

  const handleClick = () => {
    setIsModalOpen(true);
  };

  // Pioneer mode - no data yet
  if (!loading && stats.length === 0) {
    if (variant === "compact") {
      return (
        <button
          onClick={handleClick}
          className={`cursor-pointer hover:bg-white/5 transition-colors rounded-lg ${className}`}
        >
          <div className="flex flex-col gap-1 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span>🌍</span>
                <span className="text-[var(--color-text-muted)]">Pioneer mode</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3 text-[var(--color-claude-coral)]" />
              <span className="text-[var(--color-text-secondary)]">Be the first!</span>
            </div>
          </div>
        </button>
      );
    }

    return (
      <div className={`rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs text-text-muted uppercase tracking-wider">Pioneer Mode</span>
          </div>
        </div>
        <div className="text-center py-4">
          <div className="text-3xl mb-2">🚀</div>
          <p className="text-sm text-[var(--color-text-primary)] font-medium mb-1">
            Be among the first pioneers!
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            No country data yet. Your submission will start the journey.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    if (variant === "compact") {
      return (
        <div className={`animate-pulse ${className}`}>
          <div className="flex flex-col gap-1 text-[11px]">
            <div className="h-4 w-24 bg-white/10 rounded" />
            <div className="h-4 w-32 bg-white/10 rounded" />
          </div>
        </div>
      );
    }

    return (
      <div
        className={`rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 animate-pulse ${className}`}
      >
        <div className="h-4 w-20 bg-white/10 rounded mb-4" />
        <div className="h-8 w-full bg-white/10 rounded" />
      </div>
    );
  }

  const currentStat = stats[currentIndex];
  if (!currentStat) return null;

  if (variant === "compact") {
    return (
      <>
        <button
          onClick={handleClick}
          className={`cursor-pointer hover:bg-white/5 transition-colors rounded-lg ${className}`}
        >
          {/* 2-row vertical layout */}
          <div className="flex flex-col gap-1 text-[11px]">
            {/* Row 1: Global stats (tokens + spent) */}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span>🌍</span>
                <span className="text-text-primary font-medium tabular-nums">
                  {formatNumber(totalTokens)}
                </span>
              </span>
              <span className="text-white/20">│</span>
              <span className="text-amber-400 font-medium tabular-nums">
                {formatCost(totalCost)}
              </span>
            </div>
            {/* Row 2: Country ticker */}
            <div className="flex items-center justify-between gap-2">
              <div className="relative h-4 flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    className="absolute inset-0 flex items-center gap-1"
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -12, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <FlagIcon countryCode={currentStat.code} size="xs" />
                    <span className="text-text-secondary truncate">{currentStat.name}</span>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-1">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={currentIndex}
                    className="text-text-primary font-medium tabular-nums"
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -12, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {formatNumber(currentStat.tokens)}
                  </motion.span>
                </AnimatePresence>
                <ChevronDown className="w-3 h-3 text-white/30" />
              </div>
            </div>
          </div>
        </button>

        {/* Country Stats Modal */}
        <CountryStatsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          stats={stats}
          totalTokens={totalTokens}
          totalCost={totalCost}
          userCountryCode={userCountryCode}
        />
      </>
    );
  }

  // Full variant - for landing page
  return (
    <div className={`rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-text-muted uppercase tracking-wider">Live Stats</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-text-muted">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-text-primary font-semibold">{formatNumber(totalTokens)}</span>
            <span>tokens</span>
          </div>
          <div className="flex items-center gap-1.5 text-text-muted">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-text-primary font-semibold">{formatCost(totalCost)}</span>
            <span>spent</span>
          </div>
        </div>
      </div>

      {/* Country Ticker */}
      <div className="relative h-8 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            className="absolute inset-0 flex items-center justify-between"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex items-center gap-3">
              <FlagIcon countryCode={currentStat.code} size="md" />
              <div>
                <div className="text-sm font-medium text-text-primary">{currentStat.name}</div>
                <div className="text-xs text-text-muted">#{currentIndex + 1} in token usage</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-text-primary">
                {formatNumber(currentStat.tokens)}
              </div>
              <div className="text-xs text-amber-400">{formatCost(currentStat.cost)}</div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1 mt-3">
        {stats.slice(0, 8).map((_, idx) => (
          <div
            key={idx}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              idx === currentIndex ? "bg-primary" : "bg-white/10"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
