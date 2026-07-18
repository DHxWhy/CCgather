"use client";

import Link from "next/link";
import { FlagIcon } from "@/components/ui/FlagIcon";
import type { PublicStats } from "@/lib/services/publicStats";

const NUM = new Intl.NumberFormat("en-US");

const CATEGORY_META: Record<
  string,
  {
    icon: string;
    label: string;
    blurb: string;
    format: (c: PublicStats["seasonCategories"][number]) => string;
  }
> = {
  tokens: {
    icon: "⚡",
    label: "Token Titan",
    blurb: "burned the most tokens",
    format: (c) =>
      c.tokens >= 1_000_000_000
        ? `${(c.tokens / 1_000_000_000).toFixed(1)}B`
        : `${(c.tokens / 1_000_000).toFixed(1)}M`,
  },
  cost: {
    icon: "💸",
    label: "Big Spender",
    blurb: "ran up the biggest bill",
    format: (c) => `$${NUM.format(Math.round(c.cost))}`,
  },
  sessions: {
    icon: "🔁",
    label: "Session Machine",
    blurb: "never stopped shipping",
    format: (c) => `${NUM.format(c.sessions)} sessions`,
  },
};

export function SeasonChampions({ champions }: { champions: PublicStats["seasonCategories"] }) {
  if (champions.length === 0) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {champions.map((c) => {
        const meta = CATEGORY_META[c.category];
        if (!meta) return null;
        return (
          <Link
            key={c.category}
            href={`/leaderboard?u=${encodeURIComponent(c.username)}`}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--color-bg-card)]/60 p-2.5 transition-colors hover:bg-[var(--color-bg-card-hover)]"
          >
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
              <span aria-hidden>{meta.icon}</span>
              {meta.label}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              {c.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.avatarUrl}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 shrink-0 rounded-full border border-[var(--border-default)] object-cover"
                />
              ) : null}
              <span className="min-w-0 truncate text-xs font-semibold text-[var(--color-text-primary)]">
                {c.displayName || c.username}
              </span>
              {c.countryCode && <FlagIcon countryCode={c.countryCode} size="xs" />}
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold tabular-nums text-[var(--stats-chart-1)]">
              {meta.format(c)}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">{meta.blurb}</div>
          </Link>
        );
      })}
    </div>
  );
}
