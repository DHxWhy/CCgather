"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { GetStartedButton } from "@/components/auth/GetStartedButton";
import { GlobeParticles } from "@/components/ui/globe-particles";
import type { GlobalStats } from "@/lib/data/global-stats";

// Lazy load Globe for performance - no skeleton, just fade in
const Globe = dynamic(
  () => import("@/components/globe/Globe").then((mod) => ({ default: mod.Globe })),
  { ssr: false }
);

interface CountryMarker {
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
  if (cost >= 1e3) return `$${(cost / 1e3).toFixed(0)}K`;
  return `$${cost.toFixed(0)}`;
}

interface LandingHeroProps {
  initialStats?: GlobalStats | null;
}

// Hook to get current breakpoint
function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<"mobile" | "tablet" | "desktop">("desktop");

  useEffect(() => {
    const checkBreakpoint = () => {
      if (window.innerWidth < 768) {
        setBreakpoint("mobile");
      } else if (window.innerWidth < 1024) {
        setBreakpoint("tablet");
      } else {
        setBreakpoint("desktop");
      }
    };

    checkBreakpoint();
    window.addEventListener("resize", checkBreakpoint);
    return () => window.removeEventListener("resize", checkBreakpoint);
  }, []);

  return breakpoint;
}

export function LandingHero({ initialStats }: LandingHeroProps) {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<GlobalStats | null>(initialStats ?? null);
  const [countryMarkers, setCountryMarkers] = useState<CountryMarker[]>([]);
  const breakpoint = useBreakpoint();

  // Get globe size based on breakpoint
  const globeSize = breakpoint === "mobile" ? 260 : breakpoint === "tablet" ? 280 : 400;

  useEffect(() => {
    setMounted(true);

    // Fetch global stats if not provided
    if (!initialStats) {
      fetch("/api/stats/global")
        .then((res) => res.json())
        .then((data) => setStats(data))
        .catch(() => setStats(null));
    }

    // Fetch country data for globe markers
    fetch("/api/countries?stats=true")
      .then((res) => res.json())
      .then((data) => {
        const markers: CountryMarker[] = (data.countries || []).map((c: ApiCountryStat) => ({
          code: c.country_code,
          name: c.country_name,
          tokens: c.total_tokens || 0,
          cost: c.total_cost || 0,
        }));
        setCountryMarkers(markers);
      })
      .catch(() => setCountryMarkers([]));
  }, [initialStats]);

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden py-16 md:py-0">
      {/* Main layout container */}
      <div className="relative z-10 w-full px-6 md:px-8 lg:px-12">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 lg:gap-16 mx-auto max-w-7xl w-full">
          {/* Globe - Top on mobile, Left on tablet/PC */}
          {/* Fixed dimensions to prevent CLS */}
          <div className="flex-shrink-0 flex items-center justify-center w-full max-w-[260px] aspect-square md:max-w-[280px] lg:max-w-[400px]">
            <div className="relative" style={{ width: globeSize, height: globeSize }}>
              {mounted && (
                <>
                  <GlobeParticles size={globeSize} />
                  <Globe markers={countryMarkers} size={globeSize} />
                </>
              )}
            </div>
          </div>

          {/* Content - Bottom on mobile, Right on tablet/PC */}
          <div className="text-center md:text-left md:max-w-md lg:max-w-lg">
            {/* Badge - conditional based on stats */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-[var(--color-text-muted)]">
                {stats?.showStats
                  ? `Developers from ${stats.totalCountries}+ countries`
                  : "Be among the first pioneers"}
              </span>
            </div>

            {/* Headline - Dedication & Investment focus */}
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[var(--color-text-primary)] leading-tight mb-4">
              Proof of your
              <br />
              <span className="shimmer-text whitespace-nowrap">Claude Code dedication</span>
            </h1>

            {/* Subheadline */}
            <p className="text-sm md:text-base lg:text-lg text-[var(--color-text-secondary)] max-w-lg mx-auto md:mx-0 mb-8 leading-relaxed">
              The global leaderboard for developers
              <br />
              serious about AI-first development.
            </p>

            {/* Stats or Early Adopter Message */}
            {/* Fixed height container to prevent CLS */}
            {stats?.showStats ? (
              // Real Stats Mode - compact on mobile
              <div className="flex items-center justify-center md:justify-start gap-3 min-[400px]:gap-4 md:gap-6 lg:gap-8 mb-8 md:mb-10 min-h-[60px] md:min-h-[72px]">
                <div className="text-center md:text-left">
                  <div className="text-xl min-[400px]:text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
                    {stats.totalCountries}+
                  </div>
                  <div className="text-[10px] min-[400px]:text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                    Countries
                  </div>
                </div>
                <div className="w-px h-8 min-[400px]:h-10 bg-white/10" />
                <div className="text-center md:text-left">
                  <div className="text-xl min-[400px]:text-2xl md:text-3xl font-bold text-[var(--color-claude-coral)]">
                    {formatNumber(stats.totalTokens)}
                  </div>
                  <div className="text-[10px] min-[400px]:text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                    Tokens
                  </div>
                </div>
                <div className="w-px h-8 min-[400px]:h-10 bg-white/10" />
                <div className="text-center md:text-left">
                  <div className="text-xl min-[400px]:text-2xl md:text-3xl font-bold text-amber-400">
                    {formatCost(stats.totalCost)}
                  </div>
                  <div className="text-[10px] min-[400px]:text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                    Spent
                  </div>
                </div>
              </div>
            ) : (
              // Early Adopter Mode - compact on mobile
              <div className="flex items-center justify-center md:justify-start gap-4 min-[400px]:gap-6 md:gap-8 mb-8 md:mb-10 min-h-[60px] md:min-h-[72px]">
                <div className="text-center md:text-left">
                  <div className="text-xs min-[400px]:text-sm font-medium text-[var(--color-text-primary)]">
                    Be the first
                  </div>
                  <div className="text-[9px] min-[400px]:text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                    Pioneer
                  </div>
                </div>
                <div className="w-px h-6 min-[400px]:h-8 bg-white/10" />
                <div className="text-center md:text-left">
                  <div className="text-xs min-[400px]:text-sm font-medium text-[var(--color-claude-coral)]">
                    Your journey
                  </div>
                  <div className="text-[9px] min-[400px]:text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                    Starts here
                  </div>
                </div>
                <div className="w-px h-6 min-[400px]:h-8 bg-white/10" />
                <div className="text-center md:text-left">
                  <div className="text-xs min-[400px]:text-sm font-medium text-amber-400">
                    Claim #1
                  </div>
                  <div className="text-[9px] min-[400px]:text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                    Rank
                  </div>
                </div>
              </div>
            )}

            {/* CTA Buttons - Stack on mobile (<400px), row on larger */}
            {/* Always show non-authenticated UI on landing page for performance */}
            <div className="flex flex-col min-[400px]:flex-row items-center justify-center md:justify-start gap-3">
              <GetStartedButton className="w-full min-[400px]:w-auto px-5 py-2.5 rounded-xl bg-[var(--color-claude-coral)] text-white text-sm font-semibold hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[var(--color-claude-coral)]/20">
                CCgather Together
              </GetStartedButton>
              <Link
                href="/leaderboard"
                className="w-full min-[400px]:w-auto px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[var(--color-text-secondary)] text-sm font-medium hover:bg-white/10 hover:text-[var(--color-text-primary)] transition-all text-center"
              >
                Explore Rankings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Start Steps - Bottom center (hidden on mobile) */}
      <div className="hidden md:block absolute bottom-24 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-sm">
              🔐
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">Sign in</span>
          </div>
          <div className="w-6 h-px bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center text-sm">
              ⚡
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">npx ccgather</span>
          </div>
          <div className="w-6 h-px bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-sm">
              📊
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">Auto sync</span>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
          <div className="w-1 h-2 rounded-full bg-white/40" />
        </div>
      </div>
    </section>
  );
}
