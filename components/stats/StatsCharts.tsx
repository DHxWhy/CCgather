"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { FlagIcon } from "@/components/ui/FlagIcon";
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
  Sonnet: "var(--stats-chart-2)",
  Haiku: "var(--stats-chart-3)",
  Other: "var(--stats-chart-4)",
};

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return NUM.format(n);
}

function formatMonthDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
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

const tooltipStyle = {
  backgroundColor: "var(--color-bg-elevated)",
  border: "1px solid var(--border-default)",
  borderRadius: "8px",
  fontSize: "12px",
  fontFamily: "var(--font-mono, monospace)",
  color: "var(--color-text-primary)",
};

function ScopeChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
      {children}
    </span>
  );
}

function SectionTitle({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-1">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        {title}
      </h2>
      {caption && <span className="text-xs text-[var(--color-text-secondary)]">{caption}</span>}
    </div>
  );
}

interface TrendAreaProps {
  data: Record<string, string | number>[];
  dataKey: string;
  ariaLabel: string;
  stroke: string;
  gradientId: string;
  height: number;
  animate: boolean;
  tooltipLabel: string;
}

function TrendArea({
  data,
  dataKey,
  ariaLabel,
  stroke,
  gradientId,
  height,
  animate,
  tooltipLabel,
}: TrendAreaProps) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          accessibilityLayer={false}
          data={data}
          margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatMonthDay}
            tick={{
              fontSize: 10,
              fill: "var(--color-text-muted)",
              fontFamily: "var(--font-mono, monospace)",
            }}
            tickLine={false}
            axisLine={false}
            minTickGap={48}
          />
          <YAxis
            tick={{
              fontSize: 10,
              fill: "var(--color-text-muted)",
              fontFamily: "var(--font-mono, monospace)",
            }}
            tickLine={false}
            axisLine={false}
            width={38}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={formatMonthDay}
            formatter={(value: number | undefined) => [NUM.format(value ?? 0), tooltipLabel]}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={animate}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatsCharts({ stats }: { stats: PublicStats }) {
  const reducedMotion = useReducedMotion() ?? false;
  const { summary, growth, countries, visitors, models } = stats;
  const maxCountryUsers = countries.length > 0 ? countries[0]!.users : 1;
  const topModel = models[0];
  const growthSummary =
    growth.length > 0
      ? `Cumulative developers from ${formatMonthDay(growth[0]!.date)} (${growth[0]!.cumulative}) to ${formatMonthDay(growth[growth.length - 1]!.date)} (${growth[growth.length - 1]!.cumulative}).`
      : "";
  const visitorsSummary =
    visitors.length > 0
      ? `Daily unique visitors from ${formatMonthDay(visitors[0]!.date)} to ${formatMonthDay(visitors[visitors.length - 1]!.date)}, latest ${NUM.format(visitors[visitors.length - 1]!.visitors)}.`
      : "";

  return (
    <motion.div
      className="space-y-6"
      variants={reducedMotion ? undefined : staggerParent}
      initial={reducedMotion ? undefined : "hidden"}
      animate={reducedMotion ? undefined : "show"}
    >
      <motion.div variants={riseIn} className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="rounded-xl border border-[var(--color-claude-coral)]/40 bg-[var(--color-bg-card)] p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              Developers
            </span>
            <ScopeChip>All time</ScopeChip>
          </div>
          <div className="mt-2 font-mono text-5xl font-bold tabular-nums text-[var(--color-claude-coral)]">
            {NUM.format(summary.totalUsers)}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
            tracking their Claude Code journey
          </div>
        </div>

        {[
          { label: "Countries", value: NUM.format(summary.totalCountries), scope: "All time" },
          {
            label: "Tokens",
            value: formatCompact(summary.tokens30d),
            scope: "Last 30 days",
            caption: "input + output + cache",
          },
          {
            label: "Active devs",
            value: NUM.format(summary.activeDevs30d),
            scope: "Last 30 days",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-[var(--border-default)] bg-[var(--color-bg-card)] p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                {card.label}
              </span>
              <ScopeChip>{card.scope}</ScopeChip>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[var(--color-text-primary)]">
              {card.value}
            </div>
            {card.caption && (
              <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">{card.caption}</div>
            )}
          </div>
        ))}
      </motion.div>

      <motion.section
        variants={riseIn}
        className="rounded-xl border border-[var(--border-default)] bg-[var(--color-bg-card)] p-5"
      >
        <SectionTitle title="Community growth" caption="cumulative developers" />
        <p className="sr-only">{growthSummary}</p>
        <TrendArea
          data={growth}
          dataKey="cumulative"
          ariaLabel={`Community growth chart. ${growthSummary}`}
          stroke="var(--stats-chart-1)"
          gradientId="growthFill"
          height={224}
          animate={!reducedMotion}
          tooltipLabel="Total developers"
        />
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section
          variants={riseIn}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--color-bg-card)] p-5"
        >
          <SectionTitle title="Top countries" caption="developers per country" />
          <ol className="space-y-3">
            {countries.map((c, i) => (
              <li key={c.countryCode} className="flex items-center gap-3">
                <span className="w-5 text-right font-mono text-xs tabular-nums text-[var(--color-text-muted)]">
                  {i + 1}
                </span>
                <FlagIcon countryCode={c.countryCode} size="sm" />
                <span className="w-28 truncate text-sm text-[var(--color-text-primary)]">
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
                      opacity: Math.max(1 - i * 0.08, 0.35),
                    }}
                  />
                </div>
                <span className="w-10 text-right font-mono text-sm font-medium tabular-nums text-[var(--color-text-secondary)]">
                  {NUM.format(c.users)}
                </span>
              </li>
            ))}
          </ol>
        </motion.section>

        <motion.section
          variants={riseIn}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--color-bg-card)] p-5"
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
          <p className="mt-4 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            Share of tokens processed — not share of developers.
          </p>
        </motion.section>
      </div>

      <motion.section
        variants={riseIn}
        className="rounded-xl border border-[var(--border-default)] bg-[var(--color-bg-card)] p-5"
      >
        <SectionTitle title="Daily visitors" caption="unique visitors per day" />
        {visitors.length > 0 ? (
          <>
            <p className="sr-only">{visitorsSummary}</p>
            <TrendArea
              data={visitors}
              dataKey="visitors"
              ariaLabel={`Daily visitors chart. ${visitorsSummary}`}
              stroke="var(--stats-chart-4)"
              gradientId="visitorsFill"
              height={192}
              animate={!reducedMotion}
              tooltipLabel="Visitors"
            />
          </>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            Data collection started July 2026 — charts will grow daily.
          </p>
        )}
      </motion.section>
    </motion.div>
  );
}
