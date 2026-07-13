"use client";

import { useEffect, useState } from "react";
import { motion, animate, useReducedMotion } from "framer-motion";
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import Link from "next/link";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { GlobeStatsSection } from "@/components/leaderboard/GlobeStatsSection";
import { TopDevelopers } from "@/components/stats/TopDevelopers";
import { getCountryName } from "@/lib/constants/countries";
import type { PublicStats } from "@/lib/services/publicStats";

const NUM = new Intl.NumberFormat("en-US");

const CHART_TOKENS = [
  "var(--stats-chart-1)",
  "var(--stats-chart-2)",
  "var(--stats-chart-3)",
  "var(--stats-chart-4)",
];

const MODEL_COLORS: Record<string, string> = {
  Opus: "var(--stats-chart-1)",
  Fable: "var(--stats-chart-2)",
  Sonnet: "var(--stats-chart-5)",
  Haiku: "var(--stats-chart-3)",
  Other: "var(--stats-chart-4)",
};

const WORDS_PER_TOKEN = 0.75;
const WORDS_PER_NOVEL = 90_000;
const SECONDS_30D = 30 * 24 * 60 * 60;

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return NUM.format(Math.round(n));
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const EASE = [0.22, 1, 0.36, 1] as const;

const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const riseIn = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

const CARD =
  "rounded-xl border border-[var(--border-default)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-md)]";

const tooltipStyle = {
  backgroundColor: "var(--color-bg-elevated)",
  border: "1px solid var(--border-default)",
  borderRadius: "8px",
  fontSize: "12px",
  fontFamily: "var(--font-mono, monospace)",
  color: "var(--color-text-primary)",
};

const tooltipItemStyle = { color: "var(--color-text-primary)" };

function CountUp({ value }: { value: number }) {
  const reducedMotion = useReducedMotion() ?? false;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reducedMotion]);

  return <>{NUM.format(display)}</>;
}

function ScopeChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
      {children}
    </span>
  );
}

function SectionTitle({ title, caption }: { title: string; caption?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-1">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        {title}
      </h2>
      {caption && <span className="text-xs text-[var(--color-text-secondary)]">{caption}</span>}
    </div>
  );
}

export function StatsCharts({ stats }: { stats: PublicStats }) {
  const reducedMotion = useReducedMotion() ?? false;
  const { summary, growth, countries, recentSyncs, models } = stats;
  const maxCountryUsers = countries.length > 0 ? countries[0]!.users : 1;
  const topModel = models[0];
  const todaySignups = growth.length > 0 ? growth[growth.length - 1]!.signups : 0;
  const cumulativeNow = growth.length > 0 ? growth[growth.length - 1]!.cumulative : 0;
  const cumulative30dAgo = growth.length > 30 ? growth[growth.length - 31]!.cumulative : 0;
  const delta30 = Math.max(cumulativeNow - cumulative30dAgo, 0);
  const weekSignups = growth.slice(-7).reduce((a, g) => a + g.signups, 0);
  const heroDelta =
    todaySignups > 0
      ? `+${NUM.format(todaySignups)} joined today`
      : weekSignups > 0
        ? `+${NUM.format(weekSignups)} joined this week`
        : "tracking their Claude Code journey";
  const novels = (summary.tokens30d * WORDS_PER_TOKEN) / WORDS_PER_NOVEL;
  const tokensPerSecond = summary.tokens30d / SECONDS_30D;

  return (
    <motion.div
      className="space-y-6"
      variants={reducedMotion ? undefined : staggerParent}
      initial={reducedMotion ? undefined : "hidden"}
      animate={reducedMotion ? undefined : "show"}
    >
      <motion.div
        variants={reducedMotion ? undefined : staggerParent}
        className="grid grid-cols-2 gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]"
      >
        <motion.div
          variants={reducedMotion ? undefined : riseIn}
          className={`${CARD} col-span-2 border-[var(--stats-chart-1)]/40 lg:col-span-1`}
        >
          <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between lg:gap-2">
            <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              Developers
            </span>
            <span className="self-start lg:self-auto">
              <ScopeChip>All time</ScopeChip>
            </span>
          </div>
          <div className="mt-2 font-mono text-5xl font-bold tabular-nums text-[var(--stats-chart-1)]">
            <CountUp value={summary.totalUsers} />
          </div>
          <div className="mt-1 text-xs font-medium text-[var(--stats-chart-3)]">{heroDelta}</div>
        </motion.div>

        {[
          { label: "Countries", value: NUM.format(summary.totalCountries), scope: "All time" },
          {
            label: "Tokens",
            value: formatCompact(summary.tokens30d),
            scope: "30 days",
            caption: "input + output + cache",
          },
          {
            label: "Sessions",
            value: formatCompact(summary.sessions30d),
            scope: "30 days",
            caption: "synced via CLI",
          },
        ].map((card) => (
          <motion.div
            key={card.label}
            variants={reducedMotion ? undefined : riseIn}
            className={CARD}
          >
            <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between lg:gap-2">
              <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                {card.label}
              </span>
              <span className="self-start lg:self-auto">
                <ScopeChip>{card.scope}</ScopeChip>
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[var(--color-text-primary)]">
              {card.value}
            </div>
            {card.caption && (
              <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">{card.caption}</div>
            )}
          </motion.div>
        ))}
      </motion.div>

      {summary.tokens30d > 0 && (
        <motion.p
          variants={reducedMotion ? undefined : riseIn}
          className="px-1 text-xs text-[var(--color-text-secondary)]"
        >
          That&apos;s ≈{" "}
          <span className="font-mono font-semibold tabular-nums text-[var(--color-text-primary)]">
            {formatCompact(novels)}
          </span>{" "}
          novels&apos; worth of text — about{" "}
          <span className="font-mono font-semibold tabular-nums text-[var(--color-text-primary)]">
            {formatCompact(tokensPerSecond)}
          </span>{" "}
          tokens every second, around the clock.
        </motion.p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
        <motion.section
          variants={reducedMotion ? undefined : riseIn}
          className={`${CARD} flex flex-col`}
        >
          <SectionTitle
            title="Around the world"
            caption={`+${NUM.format(delta30)} devs in 30 days`}
          />
          <div className="flex flex-1 items-center justify-center py-2">
            <GlobeStatsSection size="large" hideStats hideParticles scopeFilter="global" />
          </div>
        </motion.section>

        <motion.section
          variants={reducedMotion ? undefined : riseIn}
          className={`${CARD} flex flex-col`}
        >
          <SectionTitle
            title="Top developers"
            caption={
              <Link
                href="/leaderboard"
                className="text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--stats-chart-1)]"
              >
                full leaderboard →
              </Link>
            }
          />
          <TopDevelopers />
        </motion.section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section variants={reducedMotion ? undefined : riseIn} className={CARD}>
          <SectionTitle
            title="Country race"
            caption={
              <Link
                href="/leaderboard"
                className="text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--stats-chart-1)]"
              >
                full leaderboard →
              </Link>
            }
          />
          <ol className="space-y-3">
            {countries.map((c, i) => (
              <li key={c.countryCode}>
                <Link
                  href="/leaderboard"
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-0.5 transition-colors hover:bg-[var(--color-bg-card-hover)]"
                >
                  <span className="w-5 text-right font-mono text-xs tabular-nums text-[var(--color-text-muted)]">
                    {i + 1}
                  </span>
                  <FlagIcon countryCode={c.countryCode} size="sm" />
                  <span
                    title={getCountryName(c.countryCode)}
                    className="w-32 truncate text-sm text-[var(--color-text-primary)]"
                  >
                    {getCountryName(c.countryCode)}
                  </span>
                  <div
                    aria-hidden
                    className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]"
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max((c.users / maxCountryUsers) * 100, 4)}%`,
                        backgroundColor: "var(--stats-chart-1)",
                        opacity: Math.max(1 - i * 0.03, 0.75),
                      }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-sm font-medium tabular-nums text-[var(--color-text-secondary)]">
                    {NUM.format(c.users)}
                  </span>
                  <span className="w-12 text-right font-mono text-[10px] font-medium tabular-nums text-[var(--stats-chart-3)]">
                    {c.weekSignups > 0 ? `▲ +${c.weekSignups}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-right text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            ▲ new this week
          </p>
        </motion.section>

        <motion.section
          variants={reducedMotion ? undefined : riseIn}
          className={`${CARD} flex flex-col`}
        >
          <SectionTitle title="Model mix" caption="share of tokens processed" />
          {models.length > 0 && topModel ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
              <div
                role="img"
                aria-label={`Model mix donut chart. ${models.map((m) => `${m.family} ${m.pct} percent`).join(", ")} of tokens processed.`}
                className="relative h-44 w-44 shrink-0"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart accessibilityLayer={false}>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                      formatter={(value: number | undefined, name: string | undefined) => [
                        `${value ?? 0}%`,
                        name,
                      ]}
                    />
                    <Pie
                      data={models}
                      dataKey="pct"
                      nameKey="family"
                      innerRadius={58}
                      outerRadius={80}
                      paddingAngle={2}
                      strokeWidth={0}
                      isAnimationActive={!reducedMotion}
                    >
                      {models.map((m, i) => (
                        <Cell
                          key={m.family}
                          fill={MODEL_COLORS[m.family] ?? CHART_TOKENS[i % CHART_TOKENS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-2xl font-bold tabular-nums text-[var(--color-text-primary)]">
                    {topModel.pct}%
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                    {topModel.family}
                  </span>
                </div>
              </div>
              <ul className="w-full space-y-2">
                {models.map((m) => (
                  <li key={m.family} className="flex items-center gap-2 text-sm">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: MODEL_COLORS[m.family] ?? MODEL_COLORS.Other }}
                    />
                    <span className="text-[var(--color-text-primary)]">{m.family}</span>
                    <span className="ml-auto font-mono text-sm tabular-nums text-[var(--color-text-secondary)]">
                      {m.pct}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No model data yet.</p>
          )}
          <p className="mt-auto pt-4 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            Share of tokens processed — not share of developers.
          </p>
        </motion.section>
      </div>

      {recentSyncs.length > 0 && (
        <motion.section variants={reducedMotion ? undefined : riseIn} className={`${CARD} py-4`}>
          <SectionTitle title="Live syncs" caption="latest CLI submissions" />
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {recentSyncs.map((s, i) => (
              <li
                key={`${s.countryCode}-${i}`}
                className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]"
              >
                <FlagIcon countryCode={s.countryCode} size="xs" />
                <span className="font-mono tabular-nums">{timeAgo(s.syncedAt)}</span>
              </li>
            ))}
          </ul>
        </motion.section>
      )}
    </motion.div>
  );
}
