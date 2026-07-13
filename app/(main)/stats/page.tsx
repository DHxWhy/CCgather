import type { Metadata } from "next";
import { cache } from "react";
import { getPublicStats } from "@/lib/services/publicStats";
import { StatsCharts } from "@/components/stats/StatsCharts";

export const revalidate = 3600;

const NUM = new Intl.NumberFormat("en-US");

const getStats = cache(getPublicStats);

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { summary } = await getStats();
    const title = `${NUM.format(summary.totalUsers)} developers across ${NUM.format(summary.totalCountries)} countries — CCgather Stats`;
    const description =
      "Live growth of the CCgather community — the free, open-source leaderboard for Claude Code usage. Updated hourly.";
    return {
      title,
      description,
      openGraph: { title, description, type: "website" },
      twitter: { card: "summary_large_image", title, description },
    };
  } catch {
    return {
      title: "CCgather Stats — Claude Code Community Growth",
      description:
        "Live growth statistics of the CCgather community: developers, countries, tokens tracked across the globe.",
    };
  }
}

export default async function StatsPage() {
  const stats = await getStats();
  const { totalUsers, totalCountries } = stats.summary;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "CCgather Community Stats",
    description: `Live statistics of the CCgather community: ${NUM.format(totalUsers)} developers across ${NUM.format(totalCountries)} countries tracking Claude Code usage.`,
    url: "https://ccgather.com/stats",
    keywords: ["Claude Code", "leaderboard", "AI coding", "developer statistics", "token usage"],
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: "CCgather", url: "https://ccgather.com" },
    temporalCoverage: `2026-01-01/${new Date().toISOString().slice(0, 10)}`,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] sm:text-xl">
          <span className="font-mono tabular-nums tracking-normal text-[var(--stats-chart-1)]">
            {NUM.format(totalUsers)}
          </span>{" "}
          developers.{" "}
          <span className="font-mono tabular-nums tracking-normal text-[var(--stats-chart-1)]">
            {NUM.format(totalCountries)}
          </span>{" "}
          countries. One leaderboard.
        </h1>
        <p className="text-[11px] text-[var(--color-text-secondary)]">
          Free, open-source Claude Code leaderboard · live numbers, updated hourly
        </p>
      </header>

      <StatsCharts stats={stats} />
    </div>
  );
}
