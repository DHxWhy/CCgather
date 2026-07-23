"use client";

import { useEffect, useState } from "react";
import { motion, animate, useReducedMotion } from "framer-motion";
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import Link from "next/link";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { getCountryName } from "@/lib/constants/countries";
import { GlobeStatsSection } from "@/components/leaderboard/GlobeStatsSection";
import { TopDevelopers } from "@/components/stats/TopDevelopers";
import { SeasonChampions } from "@/components/stats/SeasonChampions";
import type { PublicStats } from "@/lib/services/publicStats";
import {
  SEASON_TAGLINES,
  SEASON_SUBLINES,
  CROWN_LABELS,
  FLAG_LABELS,
  COUNTDOWN_LABELS,
  HOF_CAPTIONS,
  pickRandom,
} from "@/lib/constants/seasonCopy";

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
  show: { transition: { staggerChildren: 0.05 } },
};

const riseIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

const CARD =
  "min-w-0 rounded-xl border border-[var(--border-default)] bg-[var(--color-bg-secondary)] p-4 transition-colors duration-200 hover:border-[var(--border-hover)]";

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

function useRotatingCopy<T>(pool: readonly T[]): T {
  const [copy, setCopy] = useState<T>(pool[0]!);
  useEffect(() => {
    setCopy(pickRandom(pool));
  }, [pool]);
  return copy;
}

function ScopeChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--border-default)] px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
      {children}
    </span>
  );
}

function SectionTitle({ title, caption }: { title: string; caption?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        {title}
      </h2>
      {caption && <span className="text-xs text-[var(--color-text-secondary)]">{caption}</span>}
    </div>
  );
}

export function StatsCharts({ stats }: { stats: PublicStats }) {
  const reducedMotion = useReducedMotion() ?? false;
  const tagline = useRotatingCopy(SEASON_TAGLINES);
  const subline = useRotatingCopy(SEASON_SUBLINES);
  const crownLabel = useRotatingCopy(CROWN_LABELS);
  const flagLabel = useRotatingCopy(FLAG_LABELS);
  const countdownLabel = useRotatingCopy(COUNTDOWN_LABELS);
  const hofCaption = useRotatingCopy(HOF_CAPTIONS);
  const {
    summary,
    growth,
    countries,
    recentSyncs,
    models,
    monthRace,
    monthCountryRace,
    seasonCategories,
    hallOfFame,
  } = stats;
  const maxCountryUsers = countries.length > 0 ? countries[0]!.users : 1;
  const topModel = models[0];
  const topRacer = monthRace[0];
  const runnerUp = monthRace[1];
  const userGap = topRacer && runnerUp ? topRacer.tokens - runnerUp.tokens : 0;
  const topCountry = monthCountryRace[0];
  const runnerCountry = monthCountryRace[1];
  const countryGap = topCountry && runnerCountry ? topCountry.tokens - runnerCountry.tokens : 0;
  const todaySignups = growth.length > 0 ? growth[growth.length - 1]!.signups : 0;
  const cumulativeNow = growth.length > 0 ? growth[growth.length - 1]!.cumulative : 0;
  const cumulative30dAgo = growth.length > 30 ? growth[growth.length - 31]!.cumulative : 0;
  const delta30 = Math.max(cumulativeNow - cumulative30dAgo, 0);
  const weekSignups = growth.slice(-7).reduce((a, g) => a + g.signups, 0);
  const now = new Date();
  const nextMonthUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const daysToReset = Math.max(1, Math.ceil((nextMonthUTC - now.getTime()) / 86_400_000));
  const heroDelta =
    todaySignups > 0
      ? `+${NUM.format(todaySignups)} joined today`
      : weekSignups > 0
        ? `+${NUM.format(weekSignups)} joined this week`
        : "tracking their Claude Code journey";
  const novels = (summary.tokens30d * WORDS_PER_TOKEN) / WORDS_PER_NOVEL;
  const tokensPerSecond = summary.tokens30d / SECONDS_30D;

  const leaderboardLink = (
    <Link href="/leaderboard" className="transition-colors hover:text-[var(--stats-chart-1)]">
      full leaderboard →
    </Link>
  );

  return (
    <motion.div
      className="space-y-4"
      variants={reducedMotion ? undefined : staggerParent}
      initial={reducedMotion ? undefined : "hidden"}
      animate={reducedMotion ? undefined : "show"}
    >
      <motion.div
        variants={reducedMotion ? undefined : staggerParent}
        className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
      >
        <motion.div
          variants={reducedMotion ? undefined : riseIn}
          className={`${CARD} !p-3 border-[var(--stats-chart-1)]/40`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              Developers
            </span>
            <ScopeChip>All time</ScopeChip>
          </div>
          <div className="font-mono text-xl font-bold tabular-nums text-[var(--stats-chart-1)]">
            <CountUp value={summary.totalUsers} />
          </div>
          <div className="text-[10px] font-medium text-[var(--stats-chart-3)]">{heroDelta}</div>
        </motion.div>

        {[
          {
            label: "Countries",
            value: NUM.format(summary.totalCountries),
            scope: "All time",
            caption: `+${NUM.format(delta30)} devs in 30 days`,
          },
          {
            label: "Tokens",
            value: formatCompact(summary.tokens30d),
            scope: "30 days",
            caption: `≈ ${formatCompact(novels)} novels · ~${formatCompact(tokensPerSecond)}/sec`,
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
            className={`${CARD} !p-3`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                {card.label}
              </span>
              <ScopeChip>{card.scope}</ScopeChip>
            </div>
            <div className="font-mono text-base font-bold tabular-nums text-[var(--color-text-primary)]">
              {card.value}
            </div>
            <div className="truncate text-[10px] text-[var(--color-text-muted)]">
              {card.caption}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {recentSyncs.length > 0 && (
        <motion.div variants={reducedMotion ? undefined : riseIn} className={`${CARD} !py-2.5`}>
          <div className="flex items-center gap-4">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Live syncs
            </span>
            <div className="marquee-viewport relative flex-1 overflow-hidden">
              <ul className="marquee-track flex w-max items-center gap-x-6 whitespace-nowrap">
                {[...recentSyncs, ...recentSyncs].map((s, i) => (
                  <li key={`${s.countryCode}-${i}`} className="shrink-0">
                    {s.username ? (
                      <Link
                        href={`/leaderboard?u=${encodeURIComponent(s.username)}`}
                        className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--stats-chart-1)]"
                      >
                        <FlagIcon countryCode={s.countryCode} size="xs" />
                        <span className="font-medium text-[var(--color-text-primary)]">
                          @{s.username}
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
                          {timeAgo(s.syncedAt)}
                        </span>
                      </Link>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                        <FlagIcon countryCode={s.countryCode} size="xs" />
                        <span className="font-mono text-xs tabular-nums">
                          {timeAgo(s.syncedAt)}
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.section
          variants={reducedMotion ? undefined : riseIn}
          className={`${CARD} flex flex-col lg:row-span-2`}
        >
          <SectionTitle
            title="Around the world"
            caption={
              <span className="text-xs text-[var(--color-text-secondary)]">
                <span className="text-[var(--stats-chart-3)]">▲ new this week</span>
              </span>
            }
          />
          <div className="flex flex-1 items-center justify-center py-3">
            <GlobeStatsSection
              size="large"
              hideStats
              hideParticles
              overlayDots
              scopeFilter="global"
            />
          </div>
          <ol className="mt-3 space-y-1.5">
            {countries.map((c, i) => (
              <li key={c.countryCode}>
                <Link
                  href="/leaderboard"
                  className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-0.5 transition-colors hover:bg-[var(--color-bg-card-hover)]"
                >
                  <span className="w-4 text-right font-mono text-xs tabular-nums text-[var(--color-text-muted)]">
                    {i + 1}
                  </span>
                  <FlagIcon countryCode={c.countryCode} size="xs" />
                  <span
                    title={getCountryName(c.countryCode)}
                    className="w-24 truncate text-sm text-[var(--color-text-primary)]"
                  >
                    {getCountryName(c.countryCode)}
                  </span>
                  <div
                    aria-hidden
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]"
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
                  <span className="w-7 text-right font-mono text-xs font-medium tabular-nums text-[var(--color-text-secondary)]">
                    {NUM.format(c.users)}
                  </span>
                  <span className="w-9 text-right font-mono text-[10px] font-medium tabular-nums text-[var(--stats-chart-3)]">
                    {c.weekSignups > 0 ? `▲ +${c.weekSignups}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </motion.section>

        <motion.section
          variants={reducedMotion ? undefined : riseIn}
          className={`${CARD} flex flex-col`}
        >
          <SectionTitle
            title="This month's race"
            caption={
              <span className="text-xs text-[var(--color-text-secondary)]">{leaderboardLink}</span>
            }
          />
          <TopDevelopers devs={monthRace} />
        </motion.section>

        <motion.section
          variants={reducedMotion ? undefined : riseIn}
          className={`${CARD} flex flex-col`}
        >
          <SectionTitle title="Model mix" caption="share of tokens" />
          {models.length > 0 && topModel ? (
            <div className="flex items-center gap-4">
              <div
                role="img"
                aria-label={`Model mix donut chart. ${models.map((m) => `${m.family} ${m.pct} percent`).join(", ")} of tokens processed.`}
                className="relative h-32 w-32 shrink-0"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart accessibilityLayer={false}>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                      wrapperStyle={{ zIndex: 20 }}
                      position={{ y: -8 }}
                      offset={12}
                      formatter={(value: number | undefined, name: string | undefined) => [
                        `${value ?? 0}%`,
                        name,
                      ]}
                    />
                    <Pie
                      data={models}
                      dataKey="pct"
                      nameKey="family"
                      innerRadius={40}
                      outerRadius={58}
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
                  <span className="font-mono text-base font-bold tabular-nums text-[var(--color-text-primary)]">
                    {topModel.pct}%
                  </span>
                  <span className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
                    {topModel.family}
                  </span>
                </div>
              </div>
              <ul className="w-full space-y-1.5">
                {models.map((m) => (
                  <li key={m.family} className="flex items-center gap-2 text-xs">
                    <span
                      aria-hidden
                      className="h-2 w-2 rounded-sm"
                      style={{ backgroundColor: MODEL_COLORS[m.family] ?? MODEL_COLORS.Other }}
                    />
                    <span className="text-[var(--color-text-primary)]">{m.family}</span>
                    <span className="ml-auto font-mono tabular-nums text-[var(--color-text-secondary)]">
                      {m.pct}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No model data yet.</p>
          )}
          <p className="mt-auto pt-2 text-[10px] leading-relaxed text-[var(--color-text-muted)]">
            Share of tokens processed — not share of developers.
          </p>
        </motion.section>

        {hallOfFame.length > 0 ? (
          <motion.section
            variants={reducedMotion ? undefined : riseIn}
            className={`${CARD} lg:col-span-2`}
          >
            <SectionTitle title="Hall of Fame" caption={hofCaption} />
            <div className="space-y-5">
              {hallOfFame.map((entry) => (
                <div key={entry.month}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
                      {new Date(`${entry.month}T00:00:00Z`).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                    {entry.topCountry && (
                      <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                        Country champion{" "}
                        <FlagIcon countryCode={entry.topCountry.countryCode} size="xs" />
                      </span>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {entry.users.map((u) => (
                      <Link
                        key={u.rank}
                        href={`/leaderboard?u=${encodeURIComponent(u.username)}`}
                        className={`flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-[var(--color-bg-card-hover)] ${
                          u.rank === 1
                            ? "border-[var(--stats-chart-1)]/60 bg-[var(--color-bg-elevated)]/60"
                            : "border-[var(--border-default)] bg-[var(--color-bg-elevated)]/40"
                        }`}
                      >
                        <span className="text-lg">
                          {u.rank === 1 ? "🥇" : u.rank === 2 ? "🥈" : "🥉"}
                        </span>
                        {u.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.avatarUrl}
                            alt=""
                            width={36}
                            height={36}
                            className="h-9 w-9 shrink-0 rounded-full border border-[var(--border-default)] object-cover"
                          />
                        ) : (
                          <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--color-bg-elevated)]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                              {u.displayName || u.username}
                            </span>
                            {u.countryCode && <FlagIcon countryCode={u.countryCode} size="xs" />}
                          </div>
                          <div className="font-mono text-xs tabular-nums text-[var(--stats-chart-1)]">
                            {formatCompact(u.tokens)} tokens
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        ) : (
          <motion.section
            variants={reducedMotion ? undefined : riseIn}
            className={`${CARD} border-[var(--stats-chart-1)]/40 lg:col-span-2`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden className="shrink-0 text-2xl">
                  🏆
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[var(--color-text-primary)]">
                    Season 1 · July 2026 — {tagline}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">{subline}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-baseline gap-2 text-left sm:block sm:gap-0 sm:text-center">
                <div className="font-mono text-xl font-bold tabular-nums leading-none text-[var(--stats-chart-1)]">
                  {daysToReset}d
                </div>
                <div className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] sm:mt-1">
                  {countdownLabel}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <SeasonChampions champions={seasonCategories} />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {topRacer && (
                <Link
                  href={`/leaderboard?u=${encodeURIComponent(topRacer.username)}`}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--color-bg-elevated)]/40 p-3 transition-colors hover:bg-[var(--color-bg-card-hover)]"
                >
                  <div className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
                    {crownLabel}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {topRacer.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={topRacer.avatarUrl}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7 shrink-0 rounded-full border border-[var(--border-default)] object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 truncate text-xs font-semibold text-[var(--color-text-primary)]">
                      {topRacer.displayName || topRacer.username}
                    </span>
                    {topRacer.countryCode && (
                      <FlagIcon countryCode={topRacer.countryCode} size="xs" />
                    )}
                    <span className="ml-auto font-mono text-xs font-bold tabular-nums text-[var(--stats-chart-1)]">
                      {formatCompact(topRacer.tokens)}
                    </span>
                  </div>
                  {runnerUp && (
                    <div className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">
                      @{runnerUp.username} needs{" "}
                      <span className="font-mono font-semibold tabular-nums text-[var(--stats-chart-3)]">
                        {formatCompact(userGap)}
                      </span>{" "}
                      to steal it
                    </div>
                  )}
                </Link>
              )}

              {topCountry && (
                <Link
                  href="/leaderboard"
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--color-bg-elevated)]/40 p-3 transition-colors hover:bg-[var(--color-bg-card-hover)]"
                >
                  <div className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
                    {flagLabel}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <FlagIcon countryCode={topCountry.countryCode} size="sm" />
                    <span className="min-w-0 truncate text-xs font-semibold text-[var(--color-text-primary)]">
                      {getCountryName(topCountry.countryCode)}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      {NUM.format(topCountry.users)} devs
                    </span>
                    <span className="ml-auto font-mono text-xs font-bold tabular-nums text-[var(--stats-chart-1)]">
                      {formatCompact(topCountry.tokens)}
                    </span>
                  </div>
                  {runnerCountry && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                      <FlagIcon countryCode={runnerCountry.countryCode} size="xs" />
                      {getCountryName(runnerCountry.countryCode)} is{" "}
                      <span className="font-mono font-semibold tabular-nums text-[var(--stats-chart-3)]">
                        {formatCompact(countryGap)}
                      </span>{" "}
                      behind
                    </div>
                  )}
                </Link>
              )}
            </div>
          </motion.section>
        )}
      </div>
    </motion.div>
  );
}
