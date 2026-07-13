import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { getPublicStats } from "@/lib/services/publicStats";
import { StatsCharts } from "@/components/stats/StatsCharts";
import { CopyCommand } from "@/components/stats/CopyCommand";

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

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
          <span className="font-mono tabular-nums tracking-normal text-[var(--stats-chart-1)]">
            {NUM.format(totalUsers)}
          </span>{" "}
          developers.{" "}
          <span className="font-mono tabular-nums tracking-normal text-[var(--stats-chart-1)]">
            {NUM.format(totalCountries)}
          </span>{" "}
          countries. One leaderboard.
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
          CCgather is a free, open-source leaderboard for Claude Code usage. These are our live
          community numbers — updated hourly.
        </p>
      </header>

      <StatsCharts stats={stats} />

      <section className="rounded-xl border border-[var(--stats-chart-1)]/40 bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            Join {NUM.format(totalUsers)} developers tracking their Claude Code journey.
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <CopyCommand command="npx ccgather" />
            <Link
              href="/leaderboard"
              className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-card-hover)]"
            >
              See the leaderboard →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
