"use client";

import { useState } from "react";
import {
  useAnalyticsOverview,
  useAnalyticsTrends,
  useAnalyticsHealth,
} from "@/hooks/useAdminAnalytics";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { MetricWithTrend } from "@/types/analytics";

const DATE_RANGES = [
  { label: "7일", value: "-7d" },
  { label: "14일", value: "-14d" },
  { label: "30일", value: "-30d" },
];

// 컴팩트 메트릭 카드
function MetricCard({
  title,
  metric,
  format = "number",
}: {
  title: string;
  metric: MetricWithTrend;
  format?: "number" | "percent" | "duration";
}) {
  const formatValue = (value: number) => {
    if (format === "percent") return `${value.toFixed(1)}%`;
    if (format === "duration") return `${Math.round(value)}s`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const trendColor = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-white/40",
  }[metric.trend];

  const trendIcon = { up: "↑", down: "↓", neutral: "→" }[metric.trend];

  return (
    <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
      <div className="text-[11px] text-white/50 mb-1 uppercase tracking-wide">{title}</div>
      <div className="text-xl font-semibold text-white">{formatValue(metric.value)}</div>
      <div className={`text-[11px] flex items-center gap-1 mt-1 ${trendColor}`}>
        <span>{trendIcon}</span>
        <span>{Math.abs(metric.changePercent).toFixed(1)}%</span>
        <span className="text-white/30">vs 이전</span>
      </div>
    </div>
  );
}

// PostHog 상태 표시
function HealthBadge({ status, latency }: { status: string; latency: number }) {
  const statusConfig = {
    healthy: { color: "bg-emerald-500", text: "연결됨" },
    degraded: { color: "bg-yellow-500", text: "지연" },
    unhealthy: { color: "bg-red-500", text: "오류" },
    not_configured: { color: "bg-gray-500", text: "미설정" },
  }[status] || { color: "bg-gray-500", text: status };

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-white/50">
      <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.color}`} />
      <span>PostHog {statusConfig.text}</span>
      {latency > 0 && <span className="text-white/30">({latency}ms)</span>}
    </div>
  );
}

// Recharts 커스텀 툴팁
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !payload[0]) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-[11px]">
      <div className="text-white/50">{label}</div>
      <div className="text-white font-medium">{payload[0].value.toLocaleString()}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState("-7d");

  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview({
    dateFrom: dateRange,
  });
  const { data: trends, isLoading: trendsLoading } = useAnalyticsTrends({
    dateFrom: dateRange,
    events: ["$pageview", "user_signup", "leaderboard_view"],
  });
  const { data: health } = useAnalyticsHealth();

  const isLoading = overviewLoading || trendsLoading;

  // 차트 데이터 변환
  const chartData =
    trends?.results?.[0]?.data?.map((d) => ({
      date: d.date?.split("T")[0]?.slice(5) || "",
      value: d.count || 0,
    })) || [];

  return (
    <div className="space-y-5 max-w-6xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Analytics Overview</h1>
          <p className="text-[12px] text-white/50 mt-0.5">PostHog 기반 사용자 분석</p>
        </div>
        <div className="flex items-center gap-3">
          {health && (
            <HealthBadge status={health.posthog.status} latency={health.posthog.latency_ms} />
          )}
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
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* 메트릭 그리드 */}
      {!isLoading && overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard title="DAU" metric={overview.metrics.dau} />
          <MetricCard title="총 이벤트" metric={overview.metrics.totalEvents} />
          <MetricCard title="신규 가입" metric={overview.metrics.signups} />
          <MetricCard
            title="평균 세션"
            metric={overview.metrics.avgSessionDuration}
            format="duration"
          />
        </div>
      )}

      {/* 페이지뷰 트렌드 차트 (Recharts) */}
      {!isLoading && chartData.length > 0 && (
        <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
          <div className="text-[12px] text-white/50 mb-3">페이지뷰 트렌드</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-claude-coral)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-claude-coral)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  width={35}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-claude-coral)"
                  strokeWidth={2}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Events */}
      {!isLoading && overview?.topEvents && overview.topEvents.length > 0 && (
        <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
          <div className="text-[12px] text-white/50 mb-3">Top Events</div>
          <div className="space-y-2">
            {overview.topEvents.map((event) => (
              <div key={event.event} className="flex items-center justify-between text-[13px]">
                <span className="text-white/70 font-mono">{event.event}</span>
                <span className="text-white/50">{event.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PostHog 미설정 경고 */}
      {health?.posthog.status === "not_configured" && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="text-[13px] text-yellow-400 font-medium mb-1">⚠️ PostHog 설정 필요</div>
          <p className="text-[12px] text-white/50">환경 변수를 설정해주세요.</p>
        </div>
      )}
    </div>
  );
}
