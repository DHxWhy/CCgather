"use client";

import { useState } from "react";
import { useAnalyticsUsers } from "@/hooks/useAdminAnalytics";
import type { MetricWithTrend } from "@/types/analytics";

const DATE_RANGES = [
  { label: "7일", value: "-7d" },
  { label: "14일", value: "-14d" },
  { label: "30일", value: "-30d" },
  { label: "90일", value: "-90d" },
];

function MetricCard({
  title,
  subtitle,
  metric,
}: {
  title: string;
  subtitle: string;
  metric: MetricWithTrend;
}) {
  const trendColor = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-white/40",
  }[metric.trend];

  const trendIcon = { up: "↑", down: "↓", neutral: "→" }[metric.trend];

  return (
    <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
      <div className="text-[11px] text-white/50 uppercase tracking-wide">{title}</div>
      <div className="text-[10px] text-white/30 mb-1">{subtitle}</div>
      <div className="text-xl font-semibold text-white">{metric.value.toLocaleString()}</div>
      <div className={`text-[11px] flex items-center gap-1 mt-1 ${trendColor}`}>
        <span>{trendIcon}</span>
        <span>{Math.abs(metric.changePercent).toFixed(1)}%</span>
        <span className="text-white/30">vs 이전</span>
      </div>
    </div>
  );
}

function CountryTable({
  countries,
}: {
  countries: Array<{ country: string; countryCode: string; users: number; percentage: number }>;
}) {
  if (!countries?.length) {
    return (
      <div className="text-center py-6 text-[12px] text-white/30">국가별 데이터가 없습니다</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="px-3 py-2 text-left text-[11px] font-medium text-white/40 uppercase">
              #
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-medium text-white/40 uppercase">
              국가
            </th>
            <th className="px-3 py-2 text-right text-[11px] font-medium text-white/40 uppercase">
              사용자
            </th>
            <th className="px-3 py-2 text-right text-[11px] font-medium text-white/40 uppercase">
              비율
            </th>
          </tr>
        </thead>
        <tbody>
          {countries.map((country, index) => (
            <tr
              key={country.countryCode}
              className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-3 py-2 text-[12px] text-white/40">{index + 1}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{getFlagEmoji(country.countryCode)}</span>
                  <span className="text-[13px] text-white">{country.country}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-right text-[12px] text-white font-mono">
                {country.users.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-14 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-claude-coral)]"
                      style={{ width: `${country.percentage}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-white/50 w-10 text-right">
                    {country.percentage}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export default function UsersAnalyticsPage() {
  const [dateRange, setDateRange] = useState("-30d");
  const { data: usersData, isLoading } = useAnalyticsUsers({ dateFrom: dateRange });

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">사용자 분석</h1>
          <p className="text-[12px] text-white/50 mt-0.5">DAU, WAU, MAU 및 국가별 분석</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="bg-[#161616] text-white/80 border border-white/[0.06] rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-white/20 [&>option]:bg-[#161616] [&>option]:text-white"
        >
          {DATE_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              최근 {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Content */}
      {!isLoading && usersData && (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard title="DAU" subtitle="Daily Active Users" metric={usersData.metrics.dau} />
            <MetricCard title="WAU" subtitle="Weekly Active Users" metric={usersData.metrics.wau} />
            <MetricCard
              title="MAU"
              subtitle="Monthly Active Users"
              metric={usersData.metrics.mau}
            />
          </div>

          {/* Country Breakdown */}
          <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
            <div className="text-[12px] text-white/50 mb-3">국가별 사용자</div>
            <CountryTable countries={usersData.byCountry} />
          </div>
        </>
      )}
    </div>
  );
}
