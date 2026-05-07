import type { Metadata } from "next";
import { UspBanner } from "@/components/landing/UspBanner";
import { Footer } from "@/components/layout/footer";
import { LandingHeader } from "@/components/layout/LandingHeader";
import { HowItWorks, WhyCCgather, SocialProof } from "@/components/landing";
import { getGlobalStats } from "@/lib/data/global-stats";
import LeaderboardPage from "@/app/(main)/leaderboard/page";

// ISR: Revalidate every 5 minutes for fresh stats (랜딩과 동일)
export const revalidate = 300;

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
 */
export default async function TestPage() {
  // Fetch stats on server for immediate display (zero-latency)
  const stats = await getGlobalStats();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-primary)]">
      <LandingHeader />

      <main className="flex-1">
        {/* USP 띠 — 헤드라인 + Stats + CTA + Quick Start */}
        <UspBanner initialStats={stats} />

        {/* Section divider */}
        <div className="section-divider" />

        {/* Live Leaderboard — 기존 /leaderboard 페이지 그대로 사용 */}
        <div id="leaderboard">
          <LeaderboardPage />
        </div>

        {/* Section divider */}
        <div className="section-divider-sm" />

        {/* Marketing sections — 기존과 동일 */}
        <HowItWorks />
      </main>

      {/* Why CCgather — GEO-optimized feature cards */}
      <WhyCCgather />

      {/* Social proof — Product Hunt badge */}
      <SocialProof />

      {/* Footer */}
      <Footer />
    </div>
  );
}
