import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { LandingHero, LeaderboardPreview, HowItWorks } from "@/components/landing";

// Page-specific SEO metadata
export const metadata: Metadata = {
  title: "CCgather - Document Your AI Development Journey",
  description:
    "Track your Claude Code investment. Every token tells a story of learning, building, and growing. Show the world you're serious about AI-first development.",
  openGraph: {
    title: "CCgather - Your AI Journey, Documented",
    description:
      "Track your dedication to AI development. See how your investment compares with developers worldwide.",
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-primary)]">
      {/* Header */}
      <Header />

      {/* Main content */}
      <main className="flex-1">
        {/* Hero with fullscreen globe background */}
        <LandingHero />

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
