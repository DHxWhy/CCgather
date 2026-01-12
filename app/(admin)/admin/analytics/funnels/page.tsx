"use client";

import { useState } from "react";
import { useAnalyticsFunnels } from "@/hooks/useAdminAnalytics";

const DATE_RANGES = [
  { label: "7일", value: "-7d" },
  { label: "14일", value: "-14d" },
  { label: "30일", value: "-30d" },
  { label: "90일", value: "-90d" },
];

const FUNNEL_TYPES = [
  { label: "가입 퍼널", value: "signup" },
  { label: "참여 퍼널", value: "engagement" },
];

function FunnelVisualization({
  steps,
  overallConversion,
}: {
  steps: Array<{
    name: string;
    count: number;
    percentage: number;
    dropOff: number;
    dropOffPercent: number;
  }>;
  overallConversion: number;
}) {
  if (!steps?.length) {
    return <div className="text-center py-6 text-[12px] text-white/30">퍼널 데이터가 없습니다</div>;
  }

  const maxCount = Math.max(...steps.map((s) => s.count), 1);

  return (
    <div className="space-y-4">
      {/* Overall Conversion */}
      <div className="text-center">
        <div className="text-2xl font-bold text-[var(--color-claude-coral)]">
          {overallConversion.toFixed(1)}%
        </div>
        <div className="text-[11px] text-white/50 mt-0.5">전체 전환율</div>
      </div>

      {/* Funnel Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.name} className="relative">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--color-claude-coral)]/20 flex items-center justify-center text-[11px] font-semibold text-[var(--color-claude-coral)]">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] text-white font-medium">{step.name}</span>
                  <span className="text-[12px] text-white/50 font-mono">
                    {step.count.toLocaleString()}
                  </span>
                </div>
                <div className="h-5 bg-white/5 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--color-claude-coral)] to-[var(--color-claude-coral)]/60 flex items-center justify-end pr-2 transition-all duration-500"
                    style={{ width: `${(step.count / maxCount) * 100}%`, minWidth: "40px" }}
                  >
                    <span className="text-[10px] font-medium text-white">{step.percentage}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drop-off */}
            {index < steps.length - 1 && step.dropOff > 0 && (
              <div className="ml-9 mt-1.5 mb-2 flex items-center gap-2 text-[11px]">
                <div className="flex-1 border-l-2 border-dashed border-red-500/30 h-4 ml-2" />
                <div className="text-red-400 flex items-center gap-1">
                  <span>↓</span>
                  <span>{step.dropOff.toLocaleString()}</span>
                  <span className="text-white/30">({step.dropOffPercent.toFixed(1)}% 이탈)</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FunnelsAnalyticsPage() {
  const [dateRange, setDateRange] = useState("-7d");
  const [funnelType, setFunnelType] = useState<"signup" | "engagement">("signup");
  const { data: funnelData, isLoading } = useAnalyticsFunnels({
    dateFrom: dateRange,
    funnel: funnelType,
  });

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">퍼널 분석</h1>
          <p className="text-[12px] text-white/50 mt-0.5">가입 및 참여 퍼널 전환율</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={funnelType}
            onChange={(e) => setFunnelType(e.target.value as "signup" | "engagement")}
            className="bg-[#161616] text-white/80 border border-white/[0.06] rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-white/20"
          >
            {FUNNEL_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
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
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Funnel Content */}
      {!isLoading && funnelData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Funnel Visualization */}
          <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
            <div className="text-[12px] text-white/50 mb-3">{funnelData.funnel}</div>
            <FunnelVisualization
              steps={funnelData.steps}
              overallConversion={funnelData.overallConversion}
            />
          </div>

          {/* Funnel Details Table */}
          <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
            <div className="text-[12px] text-white/50 mb-3">단계별 상세</div>
            {funnelData.steps?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-white/40 uppercase">
                        단계
                      </th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium text-white/40 uppercase">
                        사용자
                      </th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium text-white/40 uppercase">
                        전환율
                      </th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium text-white/40 uppercase">
                        이탈
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnelData.steps.map((step, index) => (
                      <tr key={step.name} className="border-b border-white/[0.03]">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[var(--color-claude-coral)]/20 flex items-center justify-center text-[10px] text-[var(--color-claude-coral)]">
                              {index + 1}
                            </span>
                            <span className="text-[13px] text-white">{step.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-[12px] text-white font-mono">
                          {step.count.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-[12px] text-[var(--color-claude-coral)]">
                          {step.percentage}%
                        </td>
                        <td className="px-3 py-2 text-right text-[12px] text-red-400">
                          {step.dropOff > 0 ? `-${step.dropOffPercent.toFixed(1)}%` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-[12px] text-white/30">데이터가 없습니다</div>
            )}
          </div>
        </div>
      )}

      {/* Funnel Type Descriptions */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className={`bg-[#161616] rounded-lg p-4 border transition-colors ${
            funnelType === "signup"
              ? "border-[var(--color-claude-coral)]/50"
              : "border-white/[0.06] opacity-60"
          }`}
        >
          <h3 className="text-[13px] font-semibold text-white mb-1">가입 퍼널</h3>
          <p className="text-[11px] text-white/50 mb-2">첫 방문 → 가입 과정</p>
          <div className="text-[10px] text-white/30 space-y-0.5">
            <div>1. 페이지 방문 ($pageview)</div>
            <div>2. 가입 완료 (user_signup)</div>
            <div>3. 프로필 완성 (profile_complete)</div>
          </div>
        </div>

        <div
          className={`bg-[#161616] rounded-lg p-4 border transition-colors ${
            funnelType === "engagement"
              ? "border-[var(--color-claude-coral)]/50"
              : "border-white/[0.06] opacity-60"
          }`}
        >
          <h3 className="text-[13px] font-semibold text-white mb-1">참여 퍼널</h3>
          <p className="text-[11px] text-white/50 mb-2">주요 기능 사용 과정</p>
          <div className="text-[10px] text-white/30 space-y-0.5">
            <div>1. 페이지 방문 ($pageview)</div>
            <div>2. 리더보드 조회 (leaderboard_view)</div>
            <div>3. 프로필 패널 열기 (profile_panel_open)</div>
            <div>4. CLI 설치 클릭 (cli_install_click)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
