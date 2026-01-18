"use client";

import { useState } from "react";
import { useCoreKPI, useRetentionDB, useAnalyticsHealth } from "@/hooks/useAdminAnalytics";
import { InfoPopover, METRIC_INFO } from "@/components/admin/InfoPopover";

const PERIOD_OPTIONS = [
  { label: "7일", value: 7 },
  { label: "14일", value: 14 },
  { label: "30일", value: 30 },
];

// 핵심 지표 카드
function CoreMetricCard({
  title,
  subtitle,
  value,
  changePercent,
  trend,
  format = "number",
  infoKey,
}: {
  title: string;
  subtitle: string;
  value: number;
  changePercent: number;
  trend: "up" | "down" | "neutral";
  format?: "number" | "percent";
  infoKey: keyof typeof METRIC_INFO;
}) {
  const formatValue = (v: number) => {
    if (format === "percent") return `${v.toFixed(1)}%`;
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toLocaleString();
  };

  const trendColor = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-white/40",
  }[trend];

  const trendIcon = { up: "↑", down: "↓", neutral: "→" }[trend];
  const info = METRIC_INFO[infoKey];

  return (
    <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06] hover:border-white/10 transition-colors">
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[11px] text-white/50 uppercase tracking-wide">{title}</span>
        <InfoPopover
          title={info.title}
          description={info.description}
          formula={"formula" in info ? info.formula : undefined}
          insights={info.insights}
        />
      </div>
      <div className="text-[10px] text-white/30 mb-2">{subtitle}</div>
      <div className="text-2xl font-semibold text-white">{formatValue(value)}</div>
      <div className={`text-[11px] flex items-center gap-1 mt-1.5 ${trendColor}`}>
        <span>{trendIcon}</span>
        <span>{Math.abs(changePercent).toFixed(1)}%</span>
        <span className="text-white/30">vs 이전 기간</span>
      </div>
    </div>
  );
}

// 리텐션 요약 카드
function RetentionSummaryCard({ w1, w4 }: { w1: number; w4: number }) {
  const getRetentionColor = (value: number) => {
    if (value >= 40) return "text-emerald-400";
    if (value >= 20) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
      <div className="flex items-center gap-1 mb-3">
        <span className="text-[12px] text-white/50">제출 리텐션</span>
        <InfoPopover
          title="제출 리텐션"
          description="첫 제출 후 이후 주차에도 다시 제출한 사용자 비율입니다."
          insights={["W1 40% 이상이면 양호한 수준입니다", "W4 20% 이상이면 장기 유지율이 좋습니다"]}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] text-white/40 mb-1">W1 리텐션</div>
          <div className={`text-xl font-semibold ${getRetentionColor(w1)}`}>{w1}%</div>
        </div>
        <div>
          <div className="text-[10px] text-white/40 mb-1">W4 리텐션</div>
          <div className={`text-xl font-semibold ${getRetentionColor(w4)}`}>{w4}%</div>
        </div>
      </div>
    </div>
  );
}

// 분포 차트 (가로 바)
function DistributionChart({
  title,
  data,
  labelKey,
  infoKey,
}: {
  title: string;
  data: Array<{ count: number; percentage: number; [key: string]: unknown }>;
  labelKey: string;
  infoKey: keyof typeof METRIC_INFO;
}) {
  const info = METRIC_INFO[infoKey];
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  if (!data || data.length === 0) {
    return (
      <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
        <div className="flex items-center gap-1 mb-3">
          <span className="text-[12px] text-white/50">{title}</span>
          <InfoPopover title={info.title} description={info.description} insights={info.insights} />
        </div>
        <div className="text-center py-4 text-[12px] text-white/30">데이터 없음</div>
      </div>
    );
  }

  return (
    <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
      <div className="flex items-center gap-1 mb-3">
        <span className="text-[12px] text-white/50">{title}</span>
        <InfoPopover title={info.title} description={info.description} insights={info.insights} />
      </div>
      <div className="space-y-2">
        {data.slice(0, 5).map((item, i) => {
          const label = String(item[labelKey] || "unknown");
          const displayLabel = labelKey === "code" ? getFlagEmoji(label) + " " + label : label;

          return (
            <div key={i} className="flex items-center gap-2">
              <div className="w-20 text-[11px] text-white/70 truncate" title={displayLabel}>
                {displayLabel}
              </div>
              <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--color-claude-coral)] to-[var(--color-claude-coral)]/60 transition-all duration-500"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
              <div className="w-12 text-right text-[10px] text-white/50">{item.percentage}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 국기 이모지 헬퍼
function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// PostHog 상태 배지
function HealthBadge({ status, latency }: { status: string; latency: number }) {
  const statusConfig = {
    healthy: { color: "bg-emerald-500", text: "PostHog 연결됨" },
    degraded: { color: "bg-yellow-500", text: "PostHog 지연" },
    unhealthy: { color: "bg-red-500", text: "PostHog 오류" },
    not_configured: { color: "bg-gray-500", text: "PostHog 미설정" },
  }[status] || { color: "bg-gray-500", text: status };

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-white/50">
      <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.color}`} />
      <span>{statusConfig.text}</span>
      {latency > 0 && <span className="text-white/30">({latency}ms)</span>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(7);

  const { data: coreKPI, isLoading: coreLoading } = useCoreKPI({ days });
  const { data: retention, isLoading: retentionLoading } = useRetentionDB({ weeks: 8 });
  const { data: health } = useAnalyticsHealth();

  const isLoading = coreLoading || retentionLoading;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Analytics Overview</h1>
          <p className="text-[12px] text-white/50 mt-0.5">
            DB 기반 핵심 KPI · 전체 활성 사용자:{" "}
            {coreKPI?.totals.activeUsers.toLocaleString() || "-"}명
          </p>
        </div>
        <div className="flex items-center gap-3">
          {health && (
            <HealthBadge status={health.posthog.status} latency={health.posthog.latency_ms} />
          )}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-[#161616] text-white/80 border border-white/[0.06] rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-white/20"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                최근 {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* 핵심 KPI */}
      {!isLoading && coreKPI && (
        <>
          {/* 활성 사용자 지표 */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <CoreMetricCard
              title="WAU"
              subtitle="Weekly Active Submitters"
              value={coreKPI.metrics.wauSubmitters.value}
              changePercent={coreKPI.metrics.wauSubmitters.changePercent}
              trend={coreKPI.metrics.wauSubmitters.trend}
              infoKey="wau_submitters"
            />
            <CoreMetricCard
              title="MAU"
              subtitle="Monthly Active Submitters"
              value={coreKPI.metrics.mauSubmitters.value}
              changePercent={coreKPI.metrics.mauSubmitters.changePercent}
              trend={coreKPI.metrics.mauSubmitters.trend}
              infoKey="mau_submitters"
            />
            <CoreMetricCard
              title="WAU/MAU"
              subtitle="Stickiness"
              value={coreKPI.metrics.stickiness.value}
              changePercent={coreKPI.metrics.stickiness.changePercent}
              trend={coreKPI.metrics.stickiness.trend}
              format="percent"
              infoKey="stickiness"
            />
          </div>

          {/* 기타 핵심 지표 */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <CoreMetricCard
              title="제출 수"
              subtitle="Total Submissions"
              value={coreKPI.metrics.totalSubmissions.value}
              changePercent={coreKPI.metrics.totalSubmissions.changePercent}
              trend={coreKPI.metrics.totalSubmissions.trend}
              infoKey="total_submissions"
            />
            <CoreMetricCard
              title="신규 가입"
              subtitle="New Signups"
              value={coreKPI.metrics.newSignups.value}
              changePercent={coreKPI.metrics.newSignups.changePercent}
              trend={coreKPI.metrics.newSignups.trend}
              infoKey="new_signups"
            />
            <CoreMetricCard
              title="첫 제출율"
              subtitle="First Submit Rate"
              value={coreKPI.metrics.firstSubmitRate.value}
              changePercent={coreKPI.metrics.firstSubmitRate.changePercent}
              trend={coreKPI.metrics.firstSubmitRate.trend}
              format="percent"
              infoKey="first_submit_rate"
            />
          </div>

          {/* 리텐션 + 분포 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {retention && (
              <RetentionSummaryCard
                w1={retention.summary.w1Retention}
                w4={retention.summary.w4Retention}
              />
            )}
            <DistributionChart
              title="플랜별 분포"
              data={coreKPI.distributions.plan.map((p) => ({ ...p, plan: p.plan }))}
              labelKey="plan"
              infoKey="plan_distribution"
            />
            <DistributionChart
              title="모델별 분포"
              data={coreKPI.distributions.model.map((m) => ({ ...m, model: m.model }))}
              labelKey="model"
              infoKey="model_distribution"
            />
          </div>

          {/* 국가별 분포 */}
          <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
            <div className="flex items-center gap-1 mb-3">
              <span className="text-[12px] text-white/50">국가별 분포</span>
              <InfoPopover
                title={METRIC_INFO.country_distribution.title}
                description={METRIC_INFO.country_distribution.description}
                insights={METRIC_INFO.country_distribution.insights}
              />
            </div>
            {coreKPI.distributions.country.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {coreKPI.distributions.country.slice(0, 10).map((country) => (
                  <div
                    key={country.code}
                    className="flex items-center gap-2 bg-white/[0.02] rounded px-2 py-1.5"
                  >
                    <span className="text-sm">{getFlagEmoji(country.code || "")}</span>
                    <span className="text-[12px] text-white/70">{country.code}</span>
                    <span className="text-[11px] text-white/40 ml-auto">{country.percentage}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-[12px] text-white/30">국가 데이터 없음</div>
            )}
          </div>
        </>
      )}

      {/* 리텐션 코호트 히트맵 */}
      {!isLoading && retention && retention.cohorts.length > 0 && (
        <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
          <div className="flex items-center gap-1 mb-3">
            <span className="text-[12px] text-white/50">리텐션 코호트</span>
            <InfoPopover
              title="리텐션 코호트"
              description="주차별 첫 제출 사용자 그룹이 이후 주차에 다시 제출한 비율입니다."
              insights={[
                "대각선으로 읽으면 각 코호트의 시간 경과에 따른 유지율을 볼 수 있습니다",
                "색이 진할수록 리텐션이 높습니다",
              ]}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1.5 text-white/40 font-medium">코호트</th>
                  <th className="text-center px-2 py-1.5 text-white/40 font-medium">크기</th>
                  <th className="text-center px-2 py-1.5 text-white/40 font-medium">W0</th>
                  <th className="text-center px-2 py-1.5 text-white/40 font-medium">W1</th>
                  <th className="text-center px-2 py-1.5 text-white/40 font-medium">W2</th>
                  <th className="text-center px-2 py-1.5 text-white/40 font-medium">W3</th>
                  <th className="text-center px-2 py-1.5 text-white/40 font-medium">W4</th>
                </tr>
              </thead>
              <tbody>
                {retention.cohorts.slice(0, 6).map((cohort) => (
                  <tr key={cohort.cohortWeek} className="border-t border-white/[0.03]">
                    <td className="px-2 py-1.5 text-white/70 font-mono">{cohort.cohortWeek}</td>
                    <td className="px-2 py-1.5 text-center text-white/50">{cohort.cohortSize}</td>
                    {cohort.retentionByWeek.map((rate, weekIndex) => {
                      const opacity = rate / 100;
                      return (
                        <td
                          key={weekIndex}
                          className="px-2 py-1.5 text-center"
                          style={{
                            backgroundColor: `rgba(239, 68, 68, ${opacity * 0.5})`,
                          }}
                        >
                          <span className={rate >= 50 ? "text-white" : "text-white/70"}>
                            {rate}%
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 데이터 없음 안내 */}
      {!isLoading && coreKPI && coreKPI.totals.activeUsers === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="text-[13px] text-yellow-400 font-medium mb-1">📊 데이터 수집 중</div>
          <p className="text-[12px] text-white/50">
            아직 충분한 사용자 데이터가 없습니다. CLI를 통한 제출이 시작되면 지표가 표시됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
