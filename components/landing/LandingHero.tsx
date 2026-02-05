"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { GetStartedButton } from "@/components/auth/GetStartedButton";
import { GlobeParticles } from "@/components/ui/globe-particles";
import { formatNumber, formatCost } from "@/lib/utils/format";
import type { GlobalStats } from "@/lib/data/global-stats";

// Globe 플레이스홀더 - 레이아웃 시프트 방지용 빈 공간
function GlobePlaceholder({ size }: { size: number }) {
  return <div style={{ width: size, height: size }} />;
}

// Lazy load Globe for performance - with placeholder
const Globe = dynamic(
  () => import("@/components/globe/Globe").then((mod) => ({ default: mod.Globe })),
  {
    ssr: false,
    loading: () => <GlobePlaceholder size={400} />,
  }
);

// All onboarding countries for globe visualization
// Token values represent relative size (larger = bigger marker)
const GLOBE_STATS = [
  // Tier 1: Major powers (largest markers)
  { code: "US", name: "United States", tokens: 25000000000, cost: 90000 },
  { code: "CN", name: "China", tokens: 20000000000, cost: 72000 },
  { code: "JP", name: "Japan", tokens: 15000000000, cost: 54000 },
  { code: "DE", name: "Germany", tokens: 12000000000, cost: 43000 },
  { code: "IN", name: "India", tokens: 11000000000, cost: 40000 },
  { code: "GB", name: "United Kingdom", tokens: 10000000000, cost: 36000 },
  { code: "FR", name: "France", tokens: 9000000000, cost: 32000 },
  // Tier 2: Major economies
  { code: "IT", name: "Italy", tokens: 7000000000, cost: 25000 },
  { code: "CA", name: "Canada", tokens: 6500000000, cost: 23000 },
  { code: "KR", name: "South Korea", tokens: 6000000000, cost: 22000 },
  { code: "BR", name: "Brazil", tokens: 5500000000, cost: 20000 },
  { code: "AU", name: "Australia", tokens: 5000000000, cost: 18000 },
  { code: "ES", name: "Spain", tokens: 4500000000, cost: 16000 },
  { code: "MX", name: "Mexico", tokens: 4000000000, cost: 14000 },
  { code: "NL", name: "Netherlands", tokens: 3800000000, cost: 14000 },
  { code: "CH", name: "Switzerland", tokens: 3500000000, cost: 13000 },
  { code: "TR", name: "Turkey", tokens: 3200000000, cost: 12000 },
  { code: "SA", name: "Saudi Arabia", tokens: 3000000000, cost: 11000 },
  { code: "PL", name: "Poland", tokens: 2800000000, cost: 10000 },
  { code: "SE", name: "Sweden", tokens: 2600000000, cost: 9000 },
  // Tier 3: Medium economies
  { code: "BE", name: "Belgium", tokens: 2400000000, cost: 8500 },
  { code: "TW", name: "Taiwan", tokens: 2300000000, cost: 8300 },
  { code: "ID", name: "Indonesia", tokens: 2200000000, cost: 8000 },
  { code: "AT", name: "Austria", tokens: 2100000000, cost: 7600 },
  { code: "NO", name: "Norway", tokens: 2000000000, cost: 7200 },
  { code: "IL", name: "Israel", tokens: 1900000000, cost: 6900 },
  { code: "IE", name: "Ireland", tokens: 1800000000, cost: 6500 },
  { code: "TH", name: "Thailand", tokens: 1700000000, cost: 6100 },
  { code: "AE", name: "UAE", tokens: 1600000000, cost: 5800 },
  { code: "SG", name: "Singapore", tokens: 1500000000, cost: 5400 },
  { code: "DK", name: "Denmark", tokens: 1400000000, cost: 5000 },
  { code: "MY", name: "Malaysia", tokens: 1300000000, cost: 4700 },
  { code: "PH", name: "Philippines", tokens: 1250000000, cost: 4500 },
  { code: "ZA", name: "South Africa", tokens: 1200000000, cost: 4300 },
  { code: "FI", name: "Finland", tokens: 1150000000, cost: 4100 },
  { code: "CL", name: "Chile", tokens: 1100000000, cost: 4000 },
  { code: "CZ", name: "Czech Republic", tokens: 1050000000, cost: 3800 },
  { code: "PT", name: "Portugal", tokens: 1000000000, cost: 3600 },
  { code: "RO", name: "Romania", tokens: 950000000, cost: 3400 },
  { code: "NZ", name: "New Zealand", tokens: 900000000, cost: 3200 },
  // Tier 4: Smaller economies
  { code: "GR", name: "Greece", tokens: 850000000, cost: 3100 },
  { code: "HU", name: "Hungary", tokens: 800000000, cost: 2900 },
  { code: "VN", name: "Vietnam", tokens: 750000000, cost: 2700 },
  { code: "PK", name: "Pakistan", tokens: 700000000, cost: 2500 },
  { code: "CO", name: "Colombia", tokens: 650000000, cost: 2300 },
  { code: "EG", name: "Egypt", tokens: 600000000, cost: 2200 },
  { code: "AR", name: "Argentina", tokens: 550000000, cost: 2000 },
  { code: "UA", name: "Ukraine", tokens: 500000000, cost: 1800 },
  { code: "NG", name: "Nigeria", tokens: 450000000, cost: 1600 },
  { code: "BD", name: "Bangladesh", tokens: 400000000, cost: 1400 },
  { code: "PE", name: "Peru", tokens: 380000000, cost: 1400 },
  { code: "KZ", name: "Kazakhstan", tokens: 360000000, cost: 1300 },
  { code: "QA", name: "Qatar", tokens: 340000000, cost: 1200 },
  { code: "SK", name: "Slovakia", tokens: 320000000, cost: 1150 },
  { code: "HR", name: "Croatia", tokens: 300000000, cost: 1100 },
  { code: "LU", name: "Luxembourg", tokens: 280000000, cost: 1000 },
  { code: "BG", name: "Bulgaria", tokens: 260000000, cost: 940 },
  { code: "SI", name: "Slovenia", tokens: 240000000, cost: 870 },
  { code: "LT", name: "Lithuania", tokens: 220000000, cost: 800 },
  { code: "EE", name: "Estonia", tokens: 200000000, cost: 720 },
  { code: "LV", name: "Latvia", tokens: 180000000, cost: 650 },
  { code: "RS", name: "Serbia", tokens: 160000000, cost: 580 },
  { code: "KE", name: "Kenya", tokens: 150000000, cost: 540 },
  { code: "MA", name: "Morocco", tokens: 140000000, cost: 500 },
  { code: "GH", name: "Ghana", tokens: 130000000, cost: 470 },
  { code: "EC", name: "Ecuador", tokens: 120000000, cost: 430 },
  { code: "CR", name: "Costa Rica", tokens: 110000000, cost: 400 },
  { code: "UY", name: "Uruguay", tokens: 100000000, cost: 360 },
  { code: "PA", name: "Panama", tokens: 90000000, cost: 320 },
  { code: "IS", name: "Iceland", tokens: 80000000, cost: 290 },
  { code: "MT", name: "Malta", tokens: 70000000, cost: 250 },
  { code: "CY", name: "Cyprus", tokens: 65000000, cost: 235 },
  { code: "JO", name: "Jordan", tokens: 60000000, cost: 215 },
  { code: "LK", name: "Sri Lanka", tokens: 55000000, cost: 200 },
  { code: "NP", name: "Nepal", tokens: 50000000, cost: 180 },
  { code: "KH", name: "Cambodia", tokens: 45000000, cost: 160 },
  { code: "MU", name: "Mauritius", tokens: 40000000, cost: 145 },
  { code: "GE", name: "Georgia", tokens: 35000000, cost: 125 },
  { code: "AM", name: "Armenia", tokens: 30000000, cost: 108 },
];

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
  const breakpoint = useBreakpoint();

  // Get globe size based on breakpoint
  const globeSize = breakpoint === "mobile" ? 260 : breakpoint === "tablet" ? 280 : 400;

  useEffect(() => {
    setMounted(true);

    // Only fetch if no initial stats provided (fallback for client-side navigation)
    if (!initialStats) {
      fetch("/api/stats/global")
        .then((res) => res.json())
        .then((data) => setStats(data))
        .catch(() => setStats(null));
    }
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
              {/* 플레이스홀더 - 항상 표시, Globe 로드 후 숨김 */}
              {!mounted && <GlobePlaceholder size={globeSize} />}
              {/* Globe + Particles - 마운트 후 페이드인 */}
              <div
                className={`absolute inset-0 transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}
              >
                <GlobeParticles size={globeSize} />
                <Globe markers={GLOBE_STATS} size={globeSize} />
              </div>
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

            {/* Headline - Usage tracking focus for SEO */}
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[var(--color-text-primary)] leading-tight mb-4">
              Track Your
              <br />
              <span className="shimmer-text whitespace-nowrap">Claude Code Usage</span>
            </h1>

            {/* Subheadline */}
            <p className="text-sm md:text-base lg:text-lg text-[var(--color-text-secondary)] max-w-lg mx-auto md:mx-0 mb-8 leading-relaxed">
              The global leaderboard for AI-first developers.
              <br />
              Compare your ranking worldwide.
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
                  <div className="text-xl min-[400px]:text-2xl md:text-3xl font-bold text-emerald-400">
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
                  <div className="text-xs min-[400px]:text-sm font-medium text-emerald-400">
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
                Get Started
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

        {/* Quick Start Steps - Below main content (hidden on mobile) */}
        <div className="hidden md:flex justify-center mt-12 lg:mt-16">
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
