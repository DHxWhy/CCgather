import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { LandingHeader } from "@/components/layout/LandingHeader";
import { Footer } from "@/components/layout/footer";
import { LandingHero, LeaderboardPreview, HowItWorks } from "@/components/landing";
import { getGlobalStats } from "@/lib/data/global-stats";

// ISR: Revalidate every 5 minutes for fresh stats
export const revalidate = 300;

// Page-specific SEO metadata
export const metadata: Metadata = {
  title: "CCgather - Global Claude Code Leaderboard",
  description:
    "Proof of your Claude Code dedication. Track your tokens, prove your commitment, and rise through the global rankings!",
  openGraph: {
    title: "CCgather - Global Claude Code Leaderboard",
    description:
      "Proof of your Claude Code dedication. Track your tokens and rise through the global rankings!",
  },
};

export default async function HomePage() {
  // Redirect logged-in users to leaderboard
  // Auth 에러 핸들링: Clerk 세션 동기화 실패 시에도 랜딩 페이지 정상 표시
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch (error) {
    console.error("[HomePage] Auth check failed:", error);
    // 인증 실패 시 비로그인 상태로 처리 → 랜딩 페이지 표시
  }

  if (userId) {
    redirect("/leaderboard");
  }

  // Fetch stats on server for immediate display (zero-latency)
  const stats = await getGlobalStats();
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-primary)]">
      {/* Header - Clerk-free for performance */}
      <LandingHeader />

      {/* Main content */}
      <main className="flex-1">
        {/* Hero with fullscreen globe background */}
        <LandingHero initialStats={stats} />

        {/* Section divider */}
        <div className="section-divider" />

        {/* Leaderboard preview */}
        <LeaderboardPreview />

        {/* Section divider */}
        <div className="section-divider-sm" />

        {/* How it works - simplified */}
        <HowItWorks />
      </main>

      {/* Section divider */}
      <div className="section-divider" />

      {/* Footer */}
      <Footer />
    </div>
  );
}
