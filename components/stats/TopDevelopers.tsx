"use client";

import Link from "next/link";
import { FlagIcon } from "@/components/ui/FlagIcon";
import type { PublicStats } from "@/lib/services/publicStats";

const NUM = new Intl.NumberFormat("en-US");

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return NUM.format(n);
}

const RANK_STYLES = [
  "border-[var(--stats-chart-1)]/60",
  "border-[var(--border-default)]",
  "border-[var(--border-default)]",
];

export function TopDevelopers({ devs }: { devs: PublicStats["monthRace"] }) {
  if (devs.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Race starting soon…</p>;
  }

  return (
    <div className="space-y-3">
      {devs.map((dev, i) => (
        <Link
          key={dev.username}
          href={`/leaderboard?u=${encodeURIComponent(dev.username)}`}
          className={`flex items-center gap-4 rounded-xl border bg-[var(--color-bg-elevated)]/40 p-4 transition-colors hover:bg-[var(--color-bg-card-hover)] ${RANK_STYLES[i]}`}
        >
          <span className="w-7 text-center font-mono text-lg font-bold tabular-nums text-[var(--color-text-muted)]">
            {i + 1}
          </span>
          {dev.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dev.avatarUrl}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-full border border-[var(--border-default)] object-cover"
            />
          ) : (
            <div className="h-14 w-14 shrink-0 rounded-full bg-[var(--color-bg-elevated)]" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-semibold text-[var(--color-text-primary)]">
                {dev.displayName || dev.username}
              </span>
              {dev.countryCode && <FlagIcon countryCode={dev.countryCode} size="xs" />}
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              @{dev.username} · Lv.{dev.currentLevel}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xl font-bold tabular-nums text-[var(--stats-chart-1)]">
              {formatCompact(dev.tokens)}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              tokens · this month
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
