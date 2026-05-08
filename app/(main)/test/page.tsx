import type { Metadata } from "next";
import { UspBanner } from "@/components/landing/UspBanner";
import { HowItWorks, WhyCCgather, SocialProof } from "@/components/landing";
import { getGlobalStats } from "@/lib/data/global-stats";
import LeaderboardPage from "@/app/(main)/leaderboard/page";

// SEO 제외 — 사용자 검토 전용 격리 라우트
export const metadata: Metadata = {
  title: "CCgather Test — Option B-1 Preview",
  description: "Internal preview of landing + leaderboard integration. Not for production.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * `/test` 라우트 — 옵션 B-1 (랜딩 + 리더보드 통합) 격리 미리보기.
 *
 * 기존 `/`, `/leaderboard`는 100% 그대로 유지.
 * 사용자가 preview에서 디자인/UX 검증 후 라우트 swap PR로 `/`에 적용 예정.
 *
 * (main) 레이아웃의 Providers/Header/Footer/OnboardingGuard 자동 적용.
 * LeaderboardPage에 disableUrlSync 전달 — /test에서 URL이 /leaderboard로
 * 강제 변경되는 것 방지.
 */
export default async function TestPage() {
  // Fetch stats on server for immediate display (zero-latency)
  const stats = await getGlobalStats();

  return (
    <>
      {/* USP 띠 — 헤드라인 + Stats + CTA */}
      <UspBanner initialStats={stats} />

      {/* Quick Start 띠 — Leaderboard 직전 funnel (Sign in → npx ccgather → Auto sync) */}
      <div className="px-6 py-3 border-y border-white/[0.05] bg-white/[0.02]">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-3 md:gap-6 flex-wrap">
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

      {/* Live Leaderboard — pathname === "/test"이면 LeaderboardPage가 자동으로 URL sync skip */}
      <div id="leaderboard">
        <LeaderboardPage />
      </div>

      {/* Section divider */}
      <div className="section-divider-sm" />

      {/* Marketing sections */}
      <HowItWorks />
      <WhyCCgather />
      <SocialProof />
    </>
  );
}
