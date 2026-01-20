"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import ReactCountryFlag from "react-country-flag";
import { Globe } from "@/components/globe/Globe";
import { GlobeParticles } from "@/components/ui/globe-particles";
import { getCountryName } from "@/lib/constants/countries";

interface CountryStat {
  code: string;
  name: string;
  tokens: number;
  cost: number;
}

interface ApiCountryStat {
  country_code: string;
  country_name: string;
  total_tokens: number;
  total_cost: number;
}

interface GlobeStatsSectionProps {
  userCountryCode?: string;
  onStatsLoaded?: (stats: CountryStat[], totalTokens: number, totalCost: number) => void;
  className?: string;
  size?: "default" | "large";
  scopeFilter?: "global" | "country";
}

// Hook for responsive globe size
function useResponsiveGlobeSize(sizeMode: "default" | "large") {
  const [globeSize, setGlobeSize] = useState(sizeMode === "large" ? 320 : 200);

  useEffect(() => {
    const calculateSize = () => {
      const width = window.innerWidth;

      if (sizeMode === "large") {
        // Large mode: Maximize globe for 50% column width
        // 1000px container / 2 = 500px column - padding ~40px = ~460px available
        if (width >= 1536) return 380; // 2xl+
        if (width >= 1280) return 350; // xl+
        if (width >= 1024) return 320; // lg+
        return 280; // fallback
      }

      // Default mode: Compact
      if (width >= 1536) return 220;
      if (width >= 1280) return 200;
      if (width >= 1024) return 180;
      if (width >= 768) return 160;
      return 150;
    };

    setGlobeSize(calculateSize());

    const handleResize = () => {
      setGlobeSize(calculateSize());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sizeMode]);

  return globeSize;
}

export function GlobeStatsSection({
  userCountryCode,
  onStatsLoaded,
  className = "",
  size = "default",
  scopeFilter = "global",
}: GlobeStatsSectionProps) {
  const [stats, setStats] = useState<CountryStat[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const globeSize = useResponsiveGlobeSize(size);

  // Calculate user's country rank and stats
  const userCountryData = useMemo(() => {
    if (!userCountryCode || stats.length === 0) return null;
    const sortedByTokens = [...stats].sort((a, b) => b.tokens - a.tokens);
    const rank = sortedByTokens.findIndex((s) => s.code === userCountryCode) + 1;
    const countryStats = stats.find((s) => s.code === userCountryCode);
    return {
      rank: rank > 0 ? rank : null,
      tokens: countryStats?.tokens || 0,
      cost: countryStats?.cost || 0,
    };
  }, [stats, userCountryCode]);

  // Fetch country stats from API
  useEffect(() => {
    fetch("/api/countries?stats=true")
      .then((res) => res.json())
      .then((data) => {
        const countryStats: CountryStat[] = (data.countries || []).map((c: ApiCountryStat) => {
          const resolvedName =
            c.country_name && c.country_name.length > 2
              ? c.country_name
              : getCountryName(c.country_code);
          return {
            code: c.country_code,
            name: resolvedName,
            tokens: c.total_tokens || 0,
            cost: c.total_cost || 0,
          };
        });

        const tokens = countryStats.reduce((sum, s) => sum + s.tokens, 0);
        const cost = countryStats.reduce((sum, s) => sum + s.cost, 0);

        setStats(countryStats);
        setTotalTokens(tokens);
        setTotalCost(cost);
        setLoading(false);

        // Notify parent component
        if (onStatsLoaded) {
          onStatsLoaded(countryStats, tokens, cost);
        }
      })
      .catch(() => {
        setLoading(false);
      });
  }, [onStatsLoaded]);

  const isLarge = size === "large";

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Globe */}
      <div className="relative" style={{ width: globeSize, height: globeSize }}>
        {!loading && (
          <>
            <GlobeParticles size={globeSize} />
            <Globe
              markers={stats}
              size={globeSize}
              className="mx-auto"
              userCountryCode={userCountryCode}
              scopeFilter={scopeFilter}
            />
          </>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Stats summary below globe - single line with emojis */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: loading ? 0 : 1, y: loading ? 10 : 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className={`flex items-center justify-center ${isLarge ? "gap-3 mt-4 text-sm" : "gap-2 mt-3 text-xs"}`}
      >
        {scopeFilter === "global" ? (
          <>
            <span className="flex items-center gap-1 text-[var(--color-text-primary)]">
              <span>🌍</span>
            </span>
            <span className="text-[var(--color-text-muted)]">·</span>
            <span className="flex items-center gap-1 text-[var(--color-cost)]">
              <span>💰</span>
              <span className="font-semibold">
                ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </span>
            <span className="text-[var(--color-text-muted)]">·</span>
            <span className="flex items-center gap-1 text-[var(--color-claude-coral)]">
              <span>⚡</span>
              <span className="font-semibold">{totalTokens.toLocaleString()}</span>
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1 text-[var(--color-text-primary)]">
              {userCountryCode && (
                <ReactCountryFlag
                  countryCode={userCountryCode}
                  svg
                  style={{ width: "16px", height: "16px" }}
                />
              )}
            </span>
            <span className="text-[var(--color-text-muted)]">·</span>
            <span className="flex items-center gap-1 text-[var(--color-cost)]">
              <span>💰</span>
              <span className="font-semibold">
                $
                {(userCountryData?.cost || 0).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </span>
            </span>
            <span className="text-[var(--color-text-muted)]">·</span>
            <span className="flex items-center gap-1 text-[var(--color-claude-coral)]">
              <span>⚡</span>
              <span className="font-semibold">
                {(userCountryData?.tokens || 0).toLocaleString()}
              </span>
            </span>
          </>
        )}
      </motion.div>
    </div>
  );
}
