import type { Metadata } from "next";
import { getPublicStats } from "@/lib/services/publicStats";
import { StatsCharts } from "@/components/stats/StatsCharts";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "CCgather Stats — Claude Code Community Growth",
  description:
    "Live growth statistics of the CCgather community: developers, countries, tokens tracked across the globe.",
};

export default async function StatsPage() {
  const stats = await getPublicStats();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Community Stats</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Live growth of the CCgather community. Updated hourly.
        </p>
      </header>
      <StatsCharts stats={stats} />
    </div>
  );
}
