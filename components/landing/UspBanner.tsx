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
 * Globe 없이 헤드라인 + Stats + CTA + Quick Start만 압축 표시.
 * 라이브 leaderboard(GlobeStatsSection)가 바로 아래 오는 구조.
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
    <section className="relative py-12 md:py-16 px-6">
      <div className="max-w-4xl mx-auto text-center">
        {/* Live indicator badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-[var(--color-text-muted)]">
            {stats?.showStats
              ? `Developers from ${stats.totalCountries}+ countries`
              : "Be among the first pioneers"}
          </span>
        </div>

        {/* Headline — USP: 영구 아카이브 차별화 */}
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[var(--color-text-primary)] leading-tight mb-4">
          <span className="shimmer-text">Don&apos;t let Claude forget</span>
          <br />
          your journey
        </h1>

        {/* Subheadline — 한국어 USP + global positioning */}
        <p className="text-sm md:text-base lg:text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto mb-8 leading-relaxed">
          Claude는 30일 후 잊지만, 우리는 영원히 기억합니다.
          <br />
          The global leaderboard for Claude Code power users.
        </p>

        {/* Stats or Early Adopter Message — fixed height to prevent CLS */}
        {stats?.showStats ? (
          <div className="flex items-center justify-center gap-6 md:gap-10 mb-8 min-h-[60px] md:min-h-[72px]">
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
                {stats.totalCountries}+
              </div>
              <div className="text-[10px] md:text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                Countries
              </div>
            </div>
            <div className="w-px h-8 md:h-10 bg-white/10" />
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-[var(--color-claude-coral)]">
                {formatNumber(stats.totalTokens)}
              </div>
              <div className="text-[10px] md:text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                Tokens
              </div>
            </div>
            <div className="w-px h-8 md:h-10 bg-white/10" />
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-emerald-400">
                {formatCost(stats.totalCost)}
              </div>
              <div className="text-[10px] md:text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                Spent
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4 md:gap-8 mb-8 min-h-[60px] md:min-h-[72px]">
            <div className="text-center">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                Be the first
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                Pioneer
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <div className="text-sm font-medium text-[var(--color-claude-coral)]">
                Your journey
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                Starts here
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <div className="text-sm font-medium text-emerald-400">Claim #1</div>
              <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                Rank
              </div>
            </div>
          </div>
        )}

        {/* CTA — Get Started → /sign-in (GitHub + Google 옵션 노출) */}
        <div className="flex flex-col min-[400px]:flex-row items-center justify-center gap-3">
          <GetStartedLink className="w-full min-[400px]:w-auto px-5 py-2.5 rounded-xl bg-[#b84c30] text-white text-sm font-semibold hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[var(--color-claude-coral)]/20 text-center">
            Get Started
          </GetStartedLink>
          <Link
            href="#leaderboard"
            className="w-full min-[400px]:w-auto px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[var(--color-text-secondary)] text-sm font-medium hover:bg-white/10 hover:text-[var(--color-text-primary)] transition-all text-center"
          >
            Explore Rankings ↓
          </Link>
        </div>

        {/* Quick Start Steps (desktop only) */}
        <div className="hidden md:flex justify-center mt-12">
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
    </section>
  );
}
