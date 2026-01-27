"use client";

import { useState } from "react";
import { useAnalyticsFunnels } from "@/lib/hooks/useAdminAnalytics";
import { InfoPopover, METRIC_INFO } from "@/components/admin/InfoPopover";

const DATE_RANGES = [
  { label: "7일", value: "-7d" },
  { label: "14일", value: "-14d" },
  { label: "30일", value: "-30d" },
  { label: "90일", value: "-90d" },
];

const FUNNEL_TYPES = [
  {
    value: "signup",
    label: "가입 퍼널",
    description: "방문자가 가입까지 이어지는 과정",
    steps: ["페이지 방문", "가입 완료", "프로필 완성"],
  },
  {
    value: "engagement",
    label: "참여 퍼널",
    description: "가입자가 핵심 기능을 사용하는 과정",
    steps: ["페이지 방문", "리더보드 조회", "프로필 패널", "CLI 설치 클릭"],
  },
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
    return <div className="text-center py-8 text-[12px] text-white/30">퍼널 데이터가 없습니다</div>;
  }

  const maxCount = Math.max(...steps.map((s) => s.count), 1);

  // 전환율 색상
  const getConversionColor = (rate: number) => {
    if (rate >= 50) return "text-emerald-400";
    if (rate >= 20) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-5">
      {/* Overall Conversion */}
      <div className="text-center pb-4 border-b border-white/[0.06]">
        <div className={`text-3xl font-bold ${getConversionColor(overallConversion)}`}>
          {overallConversion.toFixed(1)}%
        </div>
        <div className="text-[11px] text-white/50 mt-1">전체 전환율</div>
      </div>

      {/* Funnel Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.name} className="relative">
            <div className="flex items-center gap-3">
              {/* Step Number */}
              <div className="w-7 h-7 rounded-full bg-[var(--color-claude-coral)]/20 flex items-center justify-center text-[12px] font-semibold text-[var(--color-claude-coral)] flex-shrink-0">
                {index + 1}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] text-white font-medium truncate">{step.name}</span>
                  <span className="text-[12px] text-white/50 font-mono ml-2">
                    {step.count.toLocaleString()}명
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-6 bg-white/5 rounded overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--color-claude-coral)] to-[var(--color-claude-coral)]/60 flex items-center justify-end pr-2 transition-all duration-500"
                    style={{ width: `${Math.max((step.count / maxCount) * 100, 5)}%` }}
                  >
                    <span className="text-[10px] font-medium text-white">{step.percentage}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drop-off Indicator */}
            {index < steps.length - 1 && step.dropOff > 0 && (
              <div className="ml-10 mt-2 mb-1 flex items-center gap-2 text-[11px]">
                <div className="flex-1 border-l-2 border-dashed border-red-500/30 h-4 ml-0.5" />
                <div className="text-red-400/80 flex items-center gap-1.5 bg-red-500/10 rounded px-2 py-0.5">
                  <span>↓</span>
                  <span>{step.dropOff.toLocaleString()}명 이탈</span>
                  <span className="text-white/30">({step.dropOffPercent.toFixed(1)}%)</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FunnelInsights({
  steps,
}: {
  steps: Array<{
    name: string;
    count: number;
    percentage: number;
    dropOff: number;
    dropOffPercent: number;
  }>;
}) {
  if (!steps?.length) return null;

  // 가장 큰 이탈 지점 찾기
  let maxDropOff = { index: -1, percent: 0, name: "" };
  steps.forEach((step, i) => {
    if (step.dropOffPercent > maxDropOff.percent) {
      maxDropOff = { index: i, percent: step.dropOffPercent, name: step.name };
    }
  });

  // 전환율 평가
  const overallRate = steps[steps.length - 1]?.percentage || 0;
  const isGood = overallRate >= 30;

  return (
    <div className="bg-[#0d0d0d] rounded-lg p-4 space-y-3">
      <div className="text-[11px] text-white/40 uppercase tracking-wide">💡 인사이트</div>

      {maxDropOff.index >= 0 && (
        <div className="flex items-start gap-2">
          <span className="text-red-400 mt-0.5">⚠️</span>
          <div>
            <p className="text-[12px] text-white/70">
              <span className="text-white font-medium">"{maxDropOff.name}"</span> 단계에서 가장 많은
              이탈이 발생합니다.
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {maxDropOff.percent.toFixed(1)}%의 사용자가 이 단계에서 이탈합니다.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2">
        <span className={isGood ? "text-emerald-400" : "text-yellow-400"}>
          {isGood ? "✅" : "📊"}
        </span>
        <div>
          <p className="text-[12px] text-white/70">
            전체 전환율이 {overallRate.toFixed(1)}%입니다.
          </p>
          <p className="text-[11px] text-white/40 mt-0.5">
            {isGood
              ? "양호한 수준입니다. 현재 흐름을 유지하세요."
              : "개선이 필요합니다. 이탈이 많은 단계를 집중 분석하세요."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FunnelsAnalyticsPage() {
  const [dateRange, setDateRange] = useState("-7d");
  const [funnelType, setFunnelType] = useState<"signup" | "engagement">("signup");
  const {
    data: funnelData,
    isLoading,
    error,
  } = useAnalyticsFunnels({
    dateFrom: dateRange,
    funnel: funnelType,
  });

  const selectedFunnel = FUNNEL_TYPES.find((f) => f.value === funnelType);

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">퍼널 분석</h1>
          <p className="text-[12px] text-white/50 mt-0.5">사용자 전환 과정 추적 (PostHog 기반)</p>
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
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="text-[13px] text-red-400 font-medium mb-1">⚠️ 데이터 로드 실패</div>
          <p className="text-[12px] text-white/50">PostHog 연결을 확인해주세요.</p>
        </div>
      )}

      {/* Funnel Content */}
      {!isLoading && funnelData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Funnel Visualization */}
          <div className="bg-[#161616] rounded-lg p-5 border border-white/[0.06]">
            <div className="flex items-center gap-1 mb-4">
              <span className="text-[12px] text-white/50">{funnelData.funnel}</span>
              <InfoPopover
                title={
                  selectedFunnel?.value === "signup"
                    ? METRIC_INFO.signup_funnel.title
                    : METRIC_INFO.submit_funnel.title
                }
                description={
                  selectedFunnel?.value === "signup"
                    ? METRIC_INFO.signup_funnel.description
                    : METRIC_INFO.submit_funnel.description
                }
                insights={
                  selectedFunnel?.value === "signup"
                    ? METRIC_INFO.signup_funnel.insights
                    : METRIC_INFO.submit_funnel.insights
                }
              />
            </div>
            <FunnelVisualization
              steps={funnelData.steps}
              overallConversion={funnelData.overallConversion}
            />
          </div>

          {/* Funnel Details & Insights */}
          <div className="space-y-4">
            {/* Details Table */}
            <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
              <div className="text-[12px] text-white/50 mb-3">단계별 상세</div>
              {funnelData.steps?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="px-2 py-2 text-left text-[10px] font-medium text-white/40 uppercase">
                          단계
                        </th>
                        <th className="px-2 py-2 text-right text-[10px] font-medium text-white/40 uppercase">
                          사용자
                        </th>
                        <th className="px-2 py-2 text-right text-[10px] font-medium text-white/40 uppercase">
                          전환율
                        </th>
                        <th className="px-2 py-2 text-right text-[10px] font-medium text-white/40 uppercase">
                          이탈율
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {funnelData.steps.map((step, index) => (
                        <tr key={step.name} className="border-b border-white/[0.03]">
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-[var(--color-claude-coral)]/20 flex items-center justify-center text-[10px] text-[var(--color-claude-coral)]">
                                {index + 1}
                              </span>
                              <span className="text-[12px] text-white truncate max-w-[100px]">
                                {step.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right text-[11px] text-white font-mono">
                            {step.count.toLocaleString()}
                          </td>
                          <td className="px-2 py-2 text-right text-[11px] text-[var(--color-claude-coral)]">
                            {step.percentage}%
                          </td>
                          <td className="px-2 py-2 text-right text-[11px] text-red-400">
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

            {/* Insights */}
            <FunnelInsights steps={funnelData.steps} />
          </div>
        </div>
      )}

      {/* Funnel Type Cards */}
      <div className="grid grid-cols-2 gap-3">
        {FUNNEL_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => setFunnelType(type.value as "signup" | "engagement")}
            className={`bg-[#161616] rounded-lg p-4 border text-left transition-colors ${
              funnelType === type.value
                ? "border-[var(--color-claude-coral)]/50 bg-[var(--color-claude-coral)]/5"
                : "border-white/[0.06] hover:border-white/10"
            }`}
          >
            <h3 className="text-[13px] font-semibold text-white mb-1">{type.label}</h3>
            <p className="text-[11px] text-white/50 mb-3">{type.description}</p>
            <div className="text-[10px] text-white/30 space-y-0.5">
              {type.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-white/10 flex items-center justify-center text-[8px]">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
