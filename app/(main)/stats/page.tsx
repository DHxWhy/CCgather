import type { Metadata } from "next";
import Link from "next/link";
import { getPublicStats } from "@/lib/services/publicStats";
import { StatsCharts } from "@/components/stats/StatsCharts";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "CCgather Stats — Claude Code Community Growth",
  description:
    "Live growth statistics of the CCgather community: developers, countries, tokens tracked across the globe.",
};

const NUM = new Intl.NumberFormat("en-US");

export default async function StatsPage() {
  const stats = await getPublicStats();
  const { totalUsers, totalCountries } = stats.summary;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
          <span className="font-mono tabular-nums text-[var(--color-claude-coral)]">
            {NUM.format(totalUsers)}
          </span>{" "}
          developers.{" "}
          <span className="font-mono tabular-nums text-[var(--color-claude-coral)]">
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

      <section className="rounded-xl border border-[var(--color-claude-coral)]/40 bg-[var(--color-bg-card)] p-6 sm:p-8">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              Be developer #{NUM.format(totalUsers + 1)}.
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              One command syncs your Claude Code usage. Free, open source.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-lg border border-[var(--border-default)] bg-[var(--color-bg-elevated)] px-3 py-2 font-mono text-sm text-[var(--color-text-primary)]">
              npx ccgather
            </code>
            <Link
              href="/cli"
              className="rounded-lg bg-[var(--color-claude-coral)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Get the CLI
            </Link>
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
