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
 * UspBanner — `/test` 페이지 상단 USP 띠 (2컬럼 좌우 분배).
 * 모바일: 세로 stack / 데스크톱(md+): 좌측 헤드라인+서브, 우측 Stats+CTA.
 * 세로 폭 자연스럽게 절반 → leaderboard fold 위로 노출.
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
    <section
      className="relative py-6 md:py-8 px-6"
      aria-labelledby="hero-heading"
      data-section="hero"
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 md:gap-10">
          {/* Left: Headline + Subheadline */}
          <div className="text-center md:text-left flex-1">
            <h1
              id="hero-heading"
              className="text-2xl md:text-3xl lg:text-4xl font-bold text-[var(--color-text-primary)] leading-tight mb-2"
            >
              <span className="shimmer-text" style={{ animationDuration: "2s" }}>
                Don&apos;t let Claude forget
              </span>
              <br />
              your journey
            </h1>
            <p className="text-sm md:text-base text-[var(--color-text-secondary)] leading-relaxed">
              The global leaderboard for Claude Code power users.
            </p>
          </div>

          {/* Right: Stats + CTA */}
          <div className="flex flex-col items-center md:items-end gap-3 md:gap-4 md:min-w-[300px]">
            {/* Stats inline (CLS 방지 fixed height) */}
            {stats?.showStats ? (
              <div className="flex items-center justify-center md:justify-end gap-3 md:gap-4 min-h-[32px]">
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
              <div className="flex items-center justify-center md:justify-end min-h-[32px]">
                <span className="text-xs text-[var(--color-text-muted)]">
                  Be among the first pioneers · Claim #1
                </span>
              </div>
            )}

            {/* CTA — 좌우 정렬 (모바일 stack, 데스크톱 row) */}
            <div className="flex flex-col min-[400px]:flex-row items-center gap-2.5 w-full md:w-auto">
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
        </div>

        {/* Quick Start — Hero 하단, 경계 없이 자연 spacing으로 통합 */}
        <div className="mt-6 flex items-center justify-center gap-3 md:gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-sm">
              🔐
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">Sign in</span>
          </div>
          <div className="hidden sm:block w-6 h-px bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center text-sm">
              ⚡
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">npx ccgather</span>
          </div>
          <div className="hidden sm:block w-6 h-px bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-sm">
              📊
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">Auto sync</span>
          </div>
        </div>
      </div>
    </section>
  );
}
