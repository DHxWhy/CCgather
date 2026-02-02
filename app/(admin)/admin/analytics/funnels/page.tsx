"use client";

import { useState } from "react";
import { useFunnelAnalytics } from "@/hooks/use-admin-analytics";

const DATE_RANGES = [
  { label: "7일", value: 7 },
  { label: "14일", value: 14 },
  { label: "30일", value: 30 },
  { label: "90일", value: 90 },
];

function MetricCard({
  title,
  value,
  subValue,
  trend,
  icon,
}: {
  title: string;
  value: string | number;
  subValue?: string;
  trend?: "good" | "bad" | "neutral";
  icon: string;
}) {
  const trendColors = {
    good: "text-emerald-400",
    bad: "text-red-400",
    neutral: "text-white/50",
  };

  return (
    <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-[11px] text-white/50 uppercase tracking-wide">{title}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${trend ? trendColors[trend] : "text-white"}`}>
          {value}
        </span>
        {subValue && <span className="text-[12px] text-white/40">{subValue}</span>}
      </div>
    </div>
  );
}

function FunnelBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-white/70">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-white font-mono">{value.toLocaleString()}</span>
          <span className="text-[11px] text-white/40 font-mono w-12 text-right">{percent}%</span>
        </div>
      </div>
      <div className="h-6 bg-white/5 rounded overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function TimeDistributionChart({
  data,
}: {
  data: {
    within1Hour: number;
    within24Hours: number;
    within7Days: number;
    over7Days: number;
    never: number;
  };
}) {
  const total =
    data.within1Hour + data.within24Hours + data.within7Days + data.over7Days + data.never;

  const items = [
    { label: "1시간 이내", value: data.within1Hour, color: "bg-emerald-500" },
    { label: "24시간 이내", value: data.within24Hours, color: "bg-blue-500" },
    { label: "7일 이내", value: data.within7Days, color: "bg-purple-500" },
    { label: "7일 초과", value: data.over7Days, color: "bg-orange-500" },
    { label: "미제출", value: data.never, color: "bg-white/20" },
  ];

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return (
          <div key={item.label} className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${item.color} shrink-0`} />
            <span className="text-[12px] text-white/70 w-24">{item.label}</span>
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full ${item.color} transition-all duration-500`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-[11px] text-white/50 font-mono w-16 text-right">
              {item.value}명 ({percent}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DailyFunnelChart({
  data,
}: {
  data: Array<{
    date: string;
    signups: number;
    firstSubmits: number;
    conversionRate: number;
  }>;
}) {
  if (!data?.length) {
    return <div className="text-center py-8 text-[12px] text-white/30">데이터가 없습니다</div>;
  }

  const maxValue = Math.max(...data.map((d) => Math.max(d.signups, d.firstSubmits)), 1);

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-white/50">가입</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-white/50">첫 제출</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex items-end gap-1 h-32">
        {data.slice(-14).map((item) => {
          const signupHeight = (item.signups / maxValue) * 100;
          const submitHeight = (item.firstSubmits / maxValue) * 100;
          const date = new Date(item.date);

          return (
            <div
              key={item.date}
              className="flex-1 flex flex-col items-center gap-1"
              title={`${item.date}: 가입 ${item.signups}, 제출 ${item.firstSubmits}`}
            >
              <div className="w-full flex gap-0.5" style={{ height: "100px" }}>
                <div className="flex-1 flex flex-col justify-end">
                  <div
                    className="bg-blue-500/60 rounded-t transition-all duration-300"
                    style={{ height: `${Math.max(signupHeight, 2)}%` }}
                  />
                </div>
                <div className="flex-1 flex flex-col justify-end">
                  <div
                    className="bg-emerald-500 rounded-t transition-all duration-300"
                    style={{ height: `${Math.max(submitHeight, 2)}%` }}
                  />
                </div>
              </div>
              <span className="text-[9px] text-white/40">
                {date.getMonth() + 1}/{date.getDate()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentConversionsList({
  conversions,
}: {
  conversions: Array<{
    username: string;
    avatar_url: string | null;
    signed_up_at: string;
    first_submit_at: string;
    time_to_submit_hours: number;
  }>;
}) {
  if (!conversions?.length) {
    return (
      <div className="text-center py-6 text-[12px] text-white/30">최근 전환 데이터가 없습니다</div>
    );
  }

  const formatTimeAgo = (hours: number) => {
    if (hours < 1) return "1시간 미만";
    if (hours < 24) return `${hours}시간`;
    const days = Math.round(hours / 24);
    return `${days}일`;
  };

  const getSpeedBadge = (hours: number) => {
    if (hours <= 1) return { label: "즉시", color: "bg-emerald-500/20 text-emerald-400" };
    if (hours <= 24) return { label: "빠름", color: "bg-blue-500/20 text-blue-400" };
    if (hours <= 168) return { label: "보통", color: "bg-purple-500/20 text-purple-400" };
    return { label: "느림", color: "bg-orange-500/20 text-orange-400" };
  };

  return (
    <div className="space-y-2">
      {conversions.map((user, index) => {
        const badge = getSpeedBadge(user.time_to_submit_hours);
        return (
          <div
            key={`${user.username}-${index}`}
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden shrink-0">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-white/40">
                    {user.username?.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
              </div>
              <span className="text-[12px] text-white font-medium truncate max-w-[120px]">
                {user.username}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${badge.color}`}>
                {badge.label}
              </span>
              <span className="text-[11px] text-white/50 font-mono">
                {formatTimeAgo(user.time_to_submit_hours)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FunnelsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useFunnelAnalytics({ days });

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">퍼널 분석</h1>
          <p className="text-[12px] text-white/50 mt-0.5">가입 → 첫 제출 → 활성화 전환 추적</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
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
          <div className="text-[13px] text-red-400 font-medium mb-1">데이터 로드 실패</div>
          <p className="text-[12px] text-white/50">잠시 후 다시 시도해주세요.</p>
        </div>
      )}

      {/* Content */}
      {!isLoading && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon="👥"
              title="총 가입자"
              value={data.summary.totalSignups.toLocaleString()}
              subValue="명"
            />
            <MetricCard
              icon="📤"
              title="제출 완료"
              value={data.summary.usersWithSubmit.toLocaleString()}
              subValue={`(${data.summary.signupToSubmitRate}%)`}
              trend={data.summary.signupToSubmitRate >= 50 ? "good" : "neutral"}
            />
            <MetricCard
              icon="🔥"
              title="활성 사용자"
              value={data.summary.activatedUsers.toLocaleString()}
              subValue="2회+ 제출"
              trend={data.summary.activationRate >= 30 ? "good" : "neutral"}
            />
            <MetricCard
              icon="📊"
              title="활성화율"
              value={`${data.summary.activationRate}%`}
              subValue="제출자 중"
              trend={data.summary.activationRate >= 30 ? "good" : "neutral"}
            />
          </div>

          {/* Main Funnel */}
          <div className="bg-[#161616] rounded-lg p-5 border border-white/[0.06]">
            <div className="text-[13px] text-white/60 font-medium mb-4">핵심 퍼널</div>
            <div className="space-y-4">
              <FunnelBar
                label="1. 가입"
                value={data.summary.totalSignups}
                total={data.summary.totalSignups}
                color="bg-blue-500"
              />
              <FunnelBar
                label="2. 첫 CLI 제출"
                value={data.summary.usersWithSubmit}
                total={data.summary.totalSignups}
                color="bg-purple-500"
              />
              <FunnelBar
                label="3. 활성화 (2회+ 제출)"
                value={data.summary.activatedUsers}
                total={data.summary.totalSignups}
                color="bg-emerald-500"
              />
            </div>
          </div>

          {/* Time to First Submit & Recent Conversions Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Time to First Submit */}
            <div className="bg-[#161616] rounded-lg p-5 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[13px] text-white/60 font-medium">
                  ⏱️ 가입 → 첫 제출 시간 분포
                </div>
              </div>
              <TimeDistributionChart data={data.timeToFirstSubmit} />
            </div>

            {/* Recent Conversions */}
            <div className="bg-[#161616] rounded-lg p-5 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[13px] text-white/60 font-medium">🚀 최근 전환 사용자</div>
                <span className="text-[10px] text-white/30">최근 10명</span>
              </div>
              <RecentConversionsList conversions={data.recentConversions} />
            </div>
          </div>

          {/* Daily Funnel Trend */}
          <div className="bg-[#161616] rounded-lg p-5 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[13px] text-white/60 font-medium">📈 일별 가입 vs 첫 제출</div>
              <span className="text-[10px] text-white/30">최근 14일</span>
            </div>
            <DailyFunnelChart data={data.dailyFunnel} />
          </div>

          {/* Insights */}
          <div className="bg-[#0d0d0d] rounded-lg p-4 space-y-3">
            <div className="text-[11px] text-white/40 uppercase tracking-wide">💡 인사이트</div>

            {data.summary.signupToSubmitRate < 50 && (
              <div className="flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5">⚠️</span>
                <div>
                  <p className="text-[12px] text-white/70">
                    가입 → 제출 전환율이{" "}
                    <span className="text-yellow-400 font-medium">
                      {data.summary.signupToSubmitRate}%
                    </span>
                    로 낮습니다.
                  </p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    온보딩 개선 또는 CLI 실행 안내 강화를 고려하세요.
                  </p>
                </div>
              </div>
            )}

            {data.timeToFirstSubmit.never > data.timeToFirstSubmit.within24Hours && (
              <div className="flex items-start gap-2">
                <span className="text-orange-400 mt-0.5">📊</span>
                <div>
                  <p className="text-[12px] text-white/70">
                    미제출 사용자({data.timeToFirstSubmit.never}명)가 24시간 내 제출자보다 많습니다.
                  </p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    가입 직후 CLI 실행 유도가 핵심입니다.
                  </p>
                </div>
              </div>
            )}

            {data.summary.signupToSubmitRate >= 50 && (
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✅</span>
                <div>
                  <p className="text-[12px] text-white/70">
                    가입 → 제출 전환율{" "}
                    <span className="text-emerald-400 font-medium">
                      {data.summary.signupToSubmitRate}%
                    </span>
                    로 양호합니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
