"use client";

import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import { X, DollarSign, Coins } from "lucide-react";
import { Globe } from "./Globe";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { GlobeParticles } from "@/components/ui/globe-particles";

// Animated number component with rolling count effect
function AnimatedNumber({
  value,
  formatter,
  duration = 1.5,
  delay = 0,
}: {
  value: number;
  formatter: (n: number) => string;
  duration?: number;
  delay?: number;
}) {
  const [isAnimating, setIsAnimating] = useState(true);

  const spring = useSpring(0, {
    stiffness: 50,
    damping: 20,
    duration: duration * 1000,
  });

  const display = useTransform(spring, (current) => formatter(Math.round(current)));
  const [displayValue, setDisplayValue] = useState(formatter(0));

  useEffect(() => {
    const timeout = setTimeout(() => {
      spring.set(value);
    }, delay * 1000);

    const unsubscribe = display.on("change", (v) => {
      setDisplayValue(v);
    });

    const animationTimeout = setTimeout(
      () => {
        setIsAnimating(false);
      },
      (duration + delay) * 1000
    );

    return () => {
      clearTimeout(timeout);
      clearTimeout(animationTimeout);
      unsubscribe();
    };
  }, [value, spring, display, duration, delay]);

  return <span className={isAnimating ? "tabular-nums" : ""}>{displayValue}</span>;
}

interface CountryStat {
  code: string;
  name: string;
  tokens: number;
  cost: number;
}

interface CountryStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: CountryStat[];
  totalTokens: number;
  totalCost: number;
  userCountryCode?: string; // 로그인한 사용자의 국가 코드
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
  return `$${cost.toFixed(0)}`;
}

export function CountryStatsModal({
  isOpen,
  onClose,
  stats,
  totalTokens,
  totalCost,
  userCountryCode,
}: CountryStatsModalProps) {
  const [sortBy, setSortBy] = useState<"tokens" | "cost">("tokens");

  // ESC key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, handleKeyDown]);

  // Sort stats based on selected criteria
  const sortedStats = [...stats].sort((a, b) =>
    sortBy === "tokens" ? b.tokens - a.tokens : b.cost - a.cost
  );

  // Calculate percentages
  const maxTokens = Math.max(...stats.map((s) => s.tokens), 1);
  const maxCost = Math.max(...stats.map((s) => s.cost), 1);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop - z-index must be higher than header (z-[60]) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal - z-index must be higher than header (z-[60]) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1],
              opacity: { duration: 0.3 },
            }}
            className="fixed left-1/2 top-[12%] sm:top-1/2 -translate-x-1/2 sm:-translate-y-1/2 z-[70] w-[95vw] sm:w-[90vw] max-w-[1050px] max-h-[85vh] sm:max-h-[85vh] overflow-hidden"
          >
            {/* Glass container */}
            <motion.div
              className="relative rounded-2xl overflow-hidden"
              initial={{ backdropFilter: "blur(0px)" }}
              animate={{ backdropFilter: "blur(20px)" }}
              exit={{ backdropFilter: "blur(0px)" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              {/* Glass effect background - Always dark theme */}
              <motion.div
                className="absolute inset-0 bg-[rgba(8,8,12,0.95)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                }}
              />

              {/* Border glow - Always dark theme */}
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none border border-white/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                style={{
                  boxShadow:
                    "0 0 30px rgba(229, 115, 89, 0.08), inset 0 0 40px rgba(255, 255, 255, 0.01)",
                }}
              />

              {/* Content */}
              <div className="relative p-4 sm:p-6">
                {/* Header - Always dark theme */}
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
                      <span className="text-xl sm:text-2xl">🌍</span>
                      Global Token Usage
                    </h2>
                    <p className="text-xs sm:text-sm text-white/50 mt-1">
                      Real-time token usage worldwide
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Sort Toggle Buttons */}
                    <div className="flex items-center bg-white/5 rounded-lg p-0.5">
                      <button
                        onClick={() => setSortBy("cost")}
                        className={`p-1.5 sm:p-2 rounded-md transition-all ${
                          sortBy === "cost"
                            ? "bg-amber-400/20 text-amber-400"
                            : "text-white/40 hover:text-white/60"
                        }`}
                        title="Sort by Cost"
                      >
                        <DollarSign className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setSortBy("tokens")}
                        className={`p-1.5 sm:p-2 rounded-md transition-all ${
                          sortBy === "tokens"
                            ? "bg-[#e57359]/20 text-[#e57359]"
                            : "text-white/40 hover:text-white/60"
                        }`}
                        title="Sort by Tokens"
                      >
                        <Coins className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={onClose}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <X className="w-5 h-5 text-white/50" />
                    </button>
                  </div>
                </div>

                {/* Main content - Globe with stats + Rankings */}
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-center lg:items-end">
                  {/* Left: Globe + Stats below */}
                  <div className="flex-shrink-0 flex flex-col items-center lg:pl-[22px]">
                    {/* PC Globe with particles - lg+ */}
                    <div className="relative hidden lg:block" style={{ width: 350, height: 350 }}>
                      <GlobeParticles size={350} />
                      <Globe
                        markers={stats}
                        size={350}
                        className="mx-auto"
                        userCountryCode={userCountryCode}
                      />
                    </div>
                    {/* Tablet Globe with particles - md to lg */}
                    <div
                      className="relative hidden md:block lg:hidden"
                      style={{ width: 280, height: 280 }}
                    >
                      <GlobeParticles size={280} />
                      <Globe
                        markers={stats}
                        size={280}
                        className="mx-auto"
                        userCountryCode={userCountryCode}
                      />
                    </div>
                    {/* Mobile Globe with particles - below md */}
                    <div className="relative md:hidden" style={{ width: 180, height: 180 }}>
                      <GlobeParticles size={180} />
                      <Globe
                        markers={stats}
                        size={180}
                        className="mx-auto"
                        userCountryCode={userCountryCode}
                      />
                    </div>
                    {/* Stats summary below globe - Always dark theme */}
                    <div className="flex gap-4 md:gap-6 mt-3 md:mt-4 justify-center">
                      <div className="text-center">
                        <p className="text-[9px] md:text-[10px] text-white/50 uppercase tracking-wider mb-0.5">
                          Countries
                        </p>
                        <p className="text-base md:text-lg font-bold text-white">
                          <AnimatedNumber
                            value={stats.length}
                            formatter={(n) => n.toString()}
                            duration={1}
                            delay={0.3}
                          />
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] md:text-[10px] text-white/50 uppercase tracking-wider mb-0.5">
                          Spent
                        </p>
                        <p className="text-base md:text-lg font-bold text-amber-400">
                          <AnimatedNumber
                            value={totalCost}
                            formatter={formatCost}
                            duration={2}
                            delay={0.4}
                          />
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] md:text-[10px] text-white/50 uppercase tracking-wider mb-0.5">
                          Tokens
                        </p>
                        <p className="text-base md:text-lg font-bold text-[#e57359]">
                          <AnimatedNumber
                            value={totalTokens}
                            formatter={formatNumber}
                            duration={2}
                            delay={0.5}
                          />
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Country Rankings - Always dark theme */}
                  <div className="flex-1 min-w-0 w-full lg:w-auto">
                    <div className="text-[10px] lg:text-xs text-white/50 uppercase tracking-wider mb-2">
                      Top Countries by {sortBy === "tokens" ? "Token Usage" : "Cost"}
                    </div>

                    <div className="space-y-0.5 max-h-[45vh] lg:max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                      {sortedStats.map((stat, index) => {
                        const percentage =
                          sortBy === "tokens"
                            ? (stat.tokens / totalTokens) * 100
                            : (stat.cost / totalCost) * 100;
                        const barWidth =
                          sortBy === "tokens"
                            ? (stat.tokens / maxTokens) * 100
                            : (stat.cost / maxCost) * 100;
                        const barColor =
                          sortBy === "tokens"
                            ? "linear-gradient(90deg, #e57359 0%, rgba(229, 115, 89, 0.5) 100%)"
                            : "linear-gradient(90deg, #10b981 0%, rgba(16, 185, 129, 0.5) 100%)";
                        const isUserCountry =
                          userCountryCode &&
                          stat.code.toUpperCase() === userCountryCode.toUpperCase();

                        return (
                          <motion.div
                            key={stat.code}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className={`group relative px-3 ${isUserCountry ? "bg-emerald-500/10 rounded-lg ring-1 ring-emerald-500/30 ring-inset py-2" : "py-1.5"}`}
                          >
                            {/* PC only: Single row layout (lg+) */}
                            <div className="hidden lg:flex items-center gap-2">
                              <span className="w-5 text-xs font-mono text-white/50">
                                #{index + 1}
                              </span>
                              <FlagIcon countryCode={stat.code} size="sm" />
                              <span
                                className={`text-sm font-medium w-28 ${isUserCountry ? "text-emerald-400" : "text-white"}`}
                              >
                                {stat.name}
                                {isUserCountry && <span className="ml-1 text-xs">🟢</span>}
                              </span>
                              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden mx-2">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${barWidth}%` }}
                                  transition={{
                                    duration: 1.2,
                                    delay: 0.3 + index * 0.05,
                                    ease: "easeOut",
                                  }}
                                  className="h-full rounded-full"
                                  style={{ background: barColor }}
                                />
                              </div>
                              <span className="text-xs font-mono text-amber-400 w-14 text-right">
                                <AnimatedNumber
                                  value={stat.cost}
                                  formatter={formatCost}
                                  duration={1}
                                  delay={0.3 + index * 0.05}
                                />
                              </span>
                              <span className="text-xs font-mono text-[#e57359] w-12 text-right">
                                <AnimatedNumber
                                  value={stat.tokens}
                                  formatter={formatNumber}
                                  duration={1}
                                  delay={0.3 + index * 0.05}
                                />
                              </span>
                              <span className="text-xs text-white/50 w-11 text-right">
                                {percentage.toFixed(1)}%
                              </span>
                            </div>

                            {/* Tablet & Mobile: Two row layout (below lg) */}
                            <div className="flex lg:hidden flex-col gap-0.5">
                              {/* Row 1: Rank + Flag + Country name (full, no truncate) */}
                              <div className="flex items-center gap-1.5">
                                <span className="shrink-0 w-6 text-[10px] font-mono text-white/50">
                                  #{index + 1}
                                </span>
                                <span className="shrink-0">
                                  <FlagIcon countryCode={stat.code} size="sm" />
                                </span>
                                <span
                                  className={`text-xs font-medium ${isUserCountry ? "text-emerald-400" : "text-white"}`}
                                >
                                  {stat.name}
                                  {isUserCountry && <span className="ml-1 text-[10px]">🟢</span>}
                                </span>
                              </div>
                              {/* Row 2: Gauge bar + Cost + Token + Percentage */}
                              <div className="flex items-center gap-2 ml-6">
                                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden min-w-[60px]">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${barWidth}%` }}
                                    transition={{
                                      duration: 1.2,
                                      delay: 0.3 + index * 0.05,
                                      ease: "easeOut",
                                    }}
                                    className="h-full rounded-full"
                                    style={{ background: barColor }}
                                  />
                                </div>
                                <span className="shrink-0 text-[10px] font-mono text-amber-400">
                                  {formatCost(stat.cost)}
                                </span>
                                <span className="shrink-0 text-[10px] font-mono text-[#e57359]">
                                  {formatNumber(stat.tokens)}
                                </span>
                                <span className="shrink-0 text-[10px] text-white/50">
                                  {percentage.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer note - Always dark theme */}
                <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-white/10 text-center">
                  <p className="text-[10px] sm:text-xs text-white/50">
                    Data updates in real-time as developers use Claude Code worldwide
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
