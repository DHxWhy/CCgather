"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FlagIcon } from "@/components/ui/FlagIcon";

const NUM = new Intl.NumberFormat("en-US");

interface TopDev {
  username: string;
  display_name: string | null;
  display_avatar_url: string | null;
  avatar_url: string | null;
  country_code: string | null;
  current_level: number;
  period_tokens: number;
}

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

export function TopDevelopers() {
  const [devs, setDevs] = useState<TopDev[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard?period=30d&limit=3")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { users?: TopDev[] }) => {
        if (!cancelled) setDevs((d.users ?? []).slice(0, 3));
      })
      .catch((e) => {
        console.warn("[TopDevelopers] fetch failed:", e);
        if (!cancelled) setDevs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (devs === null) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[76px] animate-pulse rounded-xl border border-[var(--border-default)] bg-[var(--color-bg-elevated)]/40"
          />
        ))}
      </div>
    );
  }

  if (devs.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Leaderboard warming up…</p>;
  }

  return (
    <div className="space-y-3">
      {devs.map((dev, i) => {
        const avatar = dev.display_avatar_url || dev.avatar_url;
        return (
          <Link
            key={dev.username}
            href={`/leaderboard?u=${encodeURIComponent(dev.username)}`}
            className={`flex items-center gap-4 rounded-xl border bg-[var(--color-bg-elevated)]/40 p-4 transition-colors hover:bg-[var(--color-bg-card-hover)] ${RANK_STYLES[i]}`}
          >
            <span className="w-7 text-center font-mono text-lg font-bold tabular-nums text-[var(--color-text-muted)]">
              {i + 1}
            </span>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
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
                  {dev.display_name || dev.username}
                </span>
                {dev.country_code && <FlagIcon countryCode={dev.country_code} size="xs" />}
              </div>
              <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                @{dev.username} · Lv.{dev.current_level}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-xl font-bold tabular-nums text-[var(--stats-chart-1)]">
                {formatCompact(dev.period_tokens)}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                tokens · 30d
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
