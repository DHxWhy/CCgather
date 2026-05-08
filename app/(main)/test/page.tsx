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
      {/* Hero — UspBanner (Headline + Stats + CTA + Quick Start 통합) */}
      <UspBanner initialStats={stats} />

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
