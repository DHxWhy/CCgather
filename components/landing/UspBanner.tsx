"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GetStartedLink } from "@/components/landing/GetStartedLink";
import { formatNumber, formatCost } from "@/lib/utils/format";
import type { GlobalStats } from "@/lib/data/global-stats";

interface UspBannerProps {
  initialStats?: GlobalStats | null;
}

/**
 * UspBanner — `/test` 페이지 상단 USP 띠.
 * 세로 폭 절반 압축 버전 (히어로보다 leaderboard fold 우선).
 * Live badge + Quick Start Steps 제거, headline 한 줄, padding/mb 최소.
 */
export function UspBanner({ initialStats }: UspBannerProps) {
  const [stats, setStats] = useState<GlobalStats | null>(initialStats ?? null);

  useEffect(() => {
    if (!initialStats) {
      fetch("/api/stats/global")
        .then((res) => res.json())
        .then((data) => setStats(data))
        .catch(() => setStats(null));
    }
  }, [initialStats]);

  return (
    <section className="relative py-3 md:py-5 px-6">
      <div className="max-w-4xl mx-auto text-center">
        {/* Headline — 한 줄, USP */}
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-[var(--color-text-primary)] leading-tight mb-2">
          <span className="shimmer-text">Don&apos;t let Claude forget your journey</span>
        </h1>

        {/* Subheadline */}
        <p className="text-xs md:text-sm text-[var(--color-text-secondary)] max-w-xl mx-auto mb-3 leading-relaxed">
          The global leaderboard for Claude Code power users.
        </p>

        {/* Stats inline (한 줄, fixed height for CLS) */}
        {stats?.showStats ? (
          <div className="flex items-center justify-center gap-4 md:gap-6 mb-3 min-h-[36px]">
            <div className="text-center">
              <span className="text-base md:text-lg font-bold text-[var(--color-text-primary)]">
                {stats.totalCountries}+
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider ml-1">
                countries
              </span>
            </div>
            <span className="w-px h-4 bg-white/10" />
            <div className="text-center">
              <span className="text-base md:text-lg font-bold text-[var(--color-claude-coral)]">
                {formatNumber(stats.totalTokens)}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider ml-1">
                tokens
              </span>
            </div>
            <span className="w-px h-4 bg-white/10" />
            <div className="text-center">
              <span className="text-base md:text-lg font-bold text-emerald-400">
                {formatCost(stats.totalCost)}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider ml-1">
                spent
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 mb-3 min-h-[36px]">
            <span className="text-xs text-[var(--color-text-muted)]">
              Be among the first pioneers · Claim #1
            </span>
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col min-[400px]:flex-row items-center justify-center gap-3">
          <GetStartedLink className="w-full min-[400px]:w-auto px-5 py-2 rounded-xl bg-[#b84c30] text-white text-sm font-semibold hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[var(--color-claude-coral)]/20 text-center">
            Get Started
          </GetStartedLink>
          <Link
            href="#leaderboard"
            className="w-full min-[400px]:w-auto px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-[var(--color-text-secondary)] text-sm font-medium hover:bg-white/10 hover:text-[var(--color-text-primary)] transition-all text-center"
          >
            Explore Rankings ↓
          </Link>
        </div>
      </div>
    </section>
  );
}
