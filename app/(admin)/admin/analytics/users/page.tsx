"use client";

import { useState } from "react";
import { useAnalyticsUsers } from "@/hooks/use-admin-analytics";
import { InfoPopover, METRIC_INFO } from "@/components/admin/InfoPopover";
import type { MetricWithTrend } from "@/lib/types/analytics";

const DATE_RANGES = [
  { label: "오늘", value: "-1d" },
  { label: "7일", value: "-7d" },
  { label: "14일", value: "-14d" },
  { label: "30일", value: "-30d" },
  { label: "90일", value: "-90d" },
];

function MetricCard({
  title,
  subtitle,
  metric,
  infoKey,
}: {
  title: string;
  subtitle: string;
  metric: MetricWithTrend;
  infoKey?: keyof typeof METRIC_INFO;
}) {
  const trendColor = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-white/40",
  }[metric.trend];

  const trendIcon = { up: "↑", down: "↓", neutral: "→" }[metric.trend];
  const info = infoKey ? METRIC_INFO[infoKey] : null;

  return (
    <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06] hover:border-white/10 transition-colors">
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[11px] text-white/50 uppercase tracking-wide">{title}</span>
        {info && (
          <InfoPopover title={info.title} description={info.description} insights={info.insights} />
        )}
      </div>
      <div className="text-[10px] text-white/30 mb-2">{subtitle}</div>
      <div className="text-2xl font-semibold text-white">{metric.value.toLocaleString()}</div>
      <div className={`text-[11px] flex items-center gap-1 mt-1.5 ${trendColor}`}>
        <span>{trendIcon}</span>
        <span>{Math.abs(metric.changePercent).toFixed(1)}%</span>
        <span className="text-white/30">vs 이전 기간</span>
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
      <div className="text-center py-8 text-[12px] text-white/30">국가별 데이터가 없습니다</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="px-3 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
              #
            </th>
            <th className="px-3 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
              국가
            </th>
            <th className="px-3 py-2.5 text-right text-[11px] font-medium text-white/40 uppercase">
              사용자
            </th>
            <th className="px-3 py-2.5 text-right text-[11px] font-medium text-white/40 uppercase">
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
              <td className="px-3 py-2.5 text-[12px] text-white/40">{index + 1}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{getFlagEmoji(country.countryCode)}</span>
                  <span className="text-[13px] text-white">{country.country}</span>
                  <span className="text-[10px] text-white/30">({country.countryCode})</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right text-[12px] text-white font-mono">
                {country.users.toLocaleString()}
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-claude-coral)]"
                      style={{ width: `${country.percentage}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-white/50 w-12 text-right">
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

// DAU/MAU 비율 (Stickiness) 계산
function StickinessCard({ dau, mau }: { dau: number; mau: number }) {
  const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;

  const getColor = (value: number) => {
    if (value >= 20) return "text-emerald-400";
    if (value >= 10) return "text-yellow-400";
    return "text-red-400";
  };

  const getLabel = (value: number) => {
    if (value >= 20) return "높음";
    if (value >= 10) return "보통";
    return "낮음";
  };

  return (
    <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
      <div className="flex items-center gap-1 mb-3">
        <span className="text-[12px] text-white/50">서비스 점착도</span>
        <InfoPopover
          title="서비스 점착도 (Stickiness)"
          description="DAU/MAU 비율로, 월간 사용자 중 매일 방문하는 사용자 비율을 나타냅니다."
          formula="(DAU / MAU) × 100"
          insights={[
            "20% 이상이면 높은 점착도입니다",
            "소셜 앱은 50%+, 유틸리티는 10-20%가 일반적입니다",
            "이 수치가 높을수록 사용자가 자주 재방문합니다",
          ]}
        />
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-2xl font-semibold ${getColor(stickiness)}`}>{stickiness}%</span>
        <span className={`text-[11px] mb-1 ${getColor(stickiness)}`}>{getLabel(stickiness)}</span>
      </div>
      <div className="text-[10px] text-white/30 mt-1">DAU/MAU 비율</div>
    </div>
  );
}

export default function UsersAnalyticsPage() {
  const [dateRange, setDateRange] = useState("-30d");
  const { data: usersData, isLoading, error } = useAnalyticsUsers({ dateFrom: dateRange });

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">웹 트래픽 분석</h1>
          <p className="text-[12px] text-white/50 mt-0.5">
            웹사이트 고유 방문자 수 (PostHog 기반) · 뉴스 SEO 유입 포함
          </p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="bg-[#161616] text-white/80 border border-white/[0.06] rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-white/20"
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
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="text-[13px] text-red-400 font-medium mb-1">⚠️ 데이터 로드 실패</div>
          <p className="text-[12px] text-white/50">
            PostHog 연결을 확인하거나 환경 변수가 올바르게 설정되었는지 확인해주세요.
          </p>
        </div>
      )}

      {/* Content */}
      {!isLoading && usersData && (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              title="DAU"
              subtitle="Daily Active Users"
              metric={usersData.metrics.dau}
              infoKey="dau"
            />
            <MetricCard
              title="WAU"
              subtitle="Weekly Active Users"
              metric={usersData.metrics.wau}
              infoKey="wau"
            />
            <MetricCard
              title="MAU"
              subtitle="Monthly Active Users"
              metric={usersData.metrics.mau}
              infoKey="mau"
            />
            <StickinessCard dau={usersData.metrics.dau.value} mau={usersData.metrics.mau.value} />
          </div>

          {/* Country Breakdown */}
          <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
            <div className="flex items-center gap-1 mb-4">
              <span className="text-[12px] text-white/50">국가별 가입 사용자</span>
              <InfoPopover
                title={METRIC_INFO.country_distribution.title}
                description={METRIC_INFO.country_distribution.description}
                insights={METRIC_INFO.country_distribution.insights}
              />
            </div>
            <CountryTable countries={usersData.byCountry} />
          </div>
        </>
      )}

      {/* No Data */}
      {!isLoading && usersData && usersData.metrics.mau.value === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="text-[13px] text-yellow-400 font-medium mb-1">📊 데이터 수집 중</div>
          <p className="text-[12px] text-white/50">
            PostHog에서 사용자 활동이 감지되면 지표가 표시됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
