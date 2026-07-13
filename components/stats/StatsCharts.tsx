"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { getCountryName } from "@/lib/constants/countries";
import type { PublicStats } from "@/lib/services/publicStats";

const CORAL = "#da7756";

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatMonthDay(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const MODEL_COLORS: Record<string, string> = {
  Opus: CORAL,
  Sonnet: "#8b8bf5",
  Haiku: "#5fb88a",
  Other: "#71717a",
};

function StatCard({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--color-bg-card)] p-5">
      <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">{value}</div>
      {caption && <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{caption}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--color-bg-card)] p-5">
      <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">{title}</h2>
      {children}
    </section>
  );
}

const tooltipStyle = {
  backgroundColor: "var(--color-bg-secondary)",
  border: "1px solid var(--border-default)",
  borderRadius: "8px",
  fontSize: "12px",
};

export function StatsCharts({ stats }: { stats: PublicStats }) {
  const { summary, growth, countries, visitors, models } = stats;
  const maxCountryUsers = countries.length > 0 ? countries[0]!.users : 1;
  const modelTotal = models.reduce((a, m) => a + m.totalTokens, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Developers" value={summary.totalUsers.toLocaleString()} />
        <StatCard label="Countries" value={summary.totalCountries.toLocaleString()} />
        <StatCard
          label="Tokens · 30 days"
          value={formatCompact(summary.tokens30d)}
          caption="input + output + cache"
        />
        <StatCard label="Active devs · 30 days" value={summary.activeDevs30d.toLocaleString()} />
      </div>

      <Section title="Community growth">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growth} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CORAL} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={CORAL} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-default)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatMonthDay}
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                tickLine={false}
                axisLine={false}
                width={36}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={formatMonthDay}
                formatter={(value: number | undefined, name: string | undefined) => [
                  value?.toLocaleString() ?? "0",
                  name === "cumulative" ? "Total developers" : name,
                ]}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={CORAL}
                strokeWidth={2}
                fill="url(#growthFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Top countries">
          <ul className="space-y-3">
            {countries.map((c, i) => (
              <li key={c.countryCode} className="flex items-center gap-3">
                <span className="w-5 text-right text-xs text-[var(--color-text-muted)]">
                  {i + 1}
                </span>
                <FlagIcon countryCode={c.countryCode} size="sm" />
                <span className="w-28 truncate text-sm text-[var(--color-text-primary)]">
                  {getCountryName(c.countryCode)}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max((c.users / maxCountryUsers) * 100, 4)}%`,
                      backgroundColor: CORAL,
                    }}
                  />
                </div>
                <span className="w-10 text-right text-sm font-medium text-[var(--color-text-secondary)]">
                  {c.users}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Model usage · tokens">
          {modelTotal > 0 ? (
            <div className="space-y-4">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                {models.map((m) => (
                  <div
                    key={m.family}
                    style={{
                      width: `${m.pct}%`,
                      backgroundColor: MODEL_COLORS[m.family] ?? MODEL_COLORS.Other,
                    }}
                  />
                ))}
              </div>
              <ul className="space-y-2">
                {models.map((m) => (
                  <li key={m.family} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: MODEL_COLORS[m.family] ?? MODEL_COLORS.Other }}
                    />
                    <span className="text-[var(--color-text-primary)]">{m.family}</span>
                    <span className="ml-auto text-[var(--color-text-secondary)]">
                      {formatCompact(m.totalTokens)} · {m.pct}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No model data yet.</p>
          )}
        </Section>
      </div>

      <Section title="Daily visitors">
        {visitors.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visitors} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="visitorsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CORAL} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CORAL} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-default)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatMonthDay}
                  tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={formatMonthDay} />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  stroke={CORAL}
                  strokeWidth={2}
                  fill="url(#visitorsFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            Data collection started July 2026 — charts will grow daily.
          </p>
        )}
      </Section>
    </div>
  );
}
