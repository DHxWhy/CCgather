"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { Coins, Sparkles } from "lucide-react";

interface CountryStat {
  code: string;
  name: string;
  tokens: number;
  cost: number;
}

// Mock data - replace with real API data
const MOCK_COUNTRY_STATS: CountryStat[] = [
  { code: "KR", name: "South Korea", tokens: 12500000000, cost: 45230 },
  { code: "US", name: "United States", tokens: 9800000000, cost: 35420 },
  { code: "JP", name: "Japan", tokens: 7200000000, cost: 26100 },
  { code: "DE", name: "Germany", tokens: 5100000000, cost: 18450 },
  { code: "GB", name: "United Kingdom", tokens: 4300000000, cost: 15560 },
  { code: "FR", name: "France", tokens: 3200000000, cost: 11580 },
  { code: "CN", name: "China", tokens: 2800000000, cost: 10130 },
  { code: "IN", name: "India", tokens: 2100000000, cost: 7600 },
];

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
}

export function LiveStatsTicker({ variant = "compact", className = "" }: LiveStatsTickerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % MOCK_COUNTRY_STATS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentStat = MOCK_COUNTRY_STATS[currentIndex]!;

  // Calculate totals
  const totalTokens = MOCK_COUNTRY_STATS.reduce((sum, s) => sum + s.tokens, 0);
  const totalCost = MOCK_COUNTRY_STATS.reduce((sum, s) => sum + s.cost, 0);

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {/* Global Stats */}
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-text-primary font-medium">{formatNumber(totalTokens)}</span>
          <span>tokens</span>
        </div>
        <span className="text-white/20">|</span>
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <Coins className="w-3 h-3 text-emerald-400" />
          <span className="text-text-primary font-medium">{formatCost(totalCost)}</span>
          <span>spent</span>
        </div>
        <span className="text-white/20">|</span>
        {/* Country Ticker */}
        <div className="relative h-5 w-36 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              className="absolute inset-0 flex items-center gap-1.5"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <FlagIcon countryCode={currentStat.code} size="xs" />
              <span className="text-xs text-text-secondary truncate">{currentStat.name}</span>
              <span className="text-xs text-text-primary font-medium">
                {formatNumber(currentStat.tokens)}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
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
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
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
              <div className="text-xs text-emerald-400">{formatCost(currentStat.cost)}</div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1 mt-3">
        {MOCK_COUNTRY_STATS.slice(0, 8).map((_, idx) => (
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
