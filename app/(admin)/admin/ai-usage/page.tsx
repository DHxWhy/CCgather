"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// Token costs per 1M tokens (Gemini - currently used)
const GEMINI_TOKEN_COSTS = {
  "gemini-3-flash-preview": { input: 0.5, output: 3.0, name: "Gemini 3 Flash", role: "뉴스 처리" },
} as const;

// Token costs per 1M tokens (Claude - reserved for future)
const CLAUDE_TOKEN_COSTS = {
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0, name: "Haiku 3.5", role: "검증" },
  "claude-opus-4-5-20250514": { input: 15.0, output: 75.0, name: "Opus 4.5", role: "요약" },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0, name: "Sonnet 4", role: "범용" },
} as const;

// Combined for lookups
const TOKEN_COSTS = { ...GEMINI_TOKEN_COSTS, ...CLAUDE_TOKEN_COSTS } as const;

// Image generation costs (Google AI pricing, per image)
const IMAGE_COSTS = {
  "imagen-4.0-generate-001": { cost: 0.04, name: "Imagen 4", role: "썸네일" },
  "gemini-2.5-flash-image": { cost: 0.039, name: "Gemini Flash Image", role: "썸네일" },
  "gemini-2.0-flash": { cost: 0.0001, name: "Gemini Flash Vision", role: "OG 분석" },
} as const;

interface AIUsageStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokensUsed: number;
  totalCost: number;
  requestsByDay: { date: string; count: number; tokens: number; cost: number }[];
  topModels: {
    model: string;
    count: number;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }[];
  byOperation: {
    operation: string;
    count: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }[];
  byModelAndOperation: {
    model: string;
    operation: string;
    count: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }[];
}

// Pricing Modal Component
function PricingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] rounded-lg border border-white/10 p-4 w-[380px] shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-white">AI API 단가표</h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Gemini LLM Section - Currently Used */}
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[10px] text-white/40">Gemini LLM (100만 토큰 당)</div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
            사용중
          </span>
        </div>
        <div className="space-y-2">
          {Object.entries(GEMINI_TOKEN_COSTS).map(([model, costs]) => (
            <div key={model} className="bg-blue-500/5 rounded-lg p-2.5 border border-blue-500/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-medium text-white">{costs.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                  {costs.role}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Input</span>
                  <span className="text-emerald-400 font-mono">${costs.input.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Output</span>
                  <span className="text-amber-400 font-mono">${costs.output.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Gemini Image Section */}
        <div className="text-[10px] text-white/40 mb-2 mt-4">Gemini 이미지 생성 (이미지 당)</div>
        <div className="space-y-2">
          {Object.entries(IMAGE_COSTS).map(([model, costs]) => (
            <div
              key={model}
              className="bg-purple-500/5 rounded-lg p-2.5 border border-purple-500/10"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-white">{costs.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                    {costs.role}
                  </span>
                  <span className="text-emerald-400 font-mono text-[11px]">
                    ${costs.cost.toFixed(costs.cost < 0.01 ? 4 : 3)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Claude API Section - Not Currently Used */}
        <div className="flex items-center gap-2 mb-2 mt-4">
          <div className="text-[10px] text-white/40">Claude API (100만 토큰 당)</div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">미사용</span>
        </div>
        <div className="space-y-2 opacity-50">
          {Object.entries(CLAUDE_TOKEN_COSTS).map(([model, costs]) => (
            <div key={model} className="bg-white/5 rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-medium text-white">{costs.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                  {costs.role}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Input</span>
                  <span className="text-emerald-400 font-mono">${costs.input.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Output</span>
                  <span className="text-[var(--color-claude-coral)] font-mono">
                    ${costs.output.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <div className="text-[10px] text-white/30 space-y-0.5">
            <div>* 현재 뉴스 처리에 Gemini 3 Flash 사용</div>
            <div>* 썸네일 생성에 Gemini Flash Image 사용</div>
            <div>* Output이 Input보다 비용이 높음</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Chart Tooltip
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length || !payload[0]) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-[11px]">
      <div className="text-white/50">{label}</div>
      <div className="text-white font-medium">{payload[0].value.toLocaleString()} 토큰</div>
    </div>
  );
}

// Metric Card Component
function MetricCard({
  title,
  value,
  subValue,
  color = "white",
  icon,
}: {
  title: string;
  value: string;
  subValue?: string;
  color?: "white" | "coral" | "emerald" | "blue";
  icon?: string;
}) {
  const colorClass = {
    white: "text-white",
    coral: "text-[var(--color-claude-coral)]",
    emerald: "text-emerald-400",
    blue: "text-blue-400",
  }[color];

  return (
    <div className="bg-[#161616] rounded-lg p-3 border border-white/[0.06]">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-[12px]">{icon}</span>}
        <div className="text-[10px] text-white/50 uppercase tracking-wide">{title}</div>
      </div>
      <div className={`text-lg font-semibold ${colorClass}`}>{value}</div>
      {subValue && <div className="text-[10px] text-white/30 mt-0.5">{subValue}</div>}
    </div>
  );
}

// Model Name Helper
function getModelDisplayName(model: string): string {
  const tokenModel = TOKEN_COSTS[model as keyof typeof TOKEN_COSTS];
  if (tokenModel) return tokenModel.name;

  const imageModel = IMAGE_COSTS[model as keyof typeof IMAGE_COSTS];
  if (imageModel) return imageModel.name;

  return model.split("-").slice(-1)[0] || model;
}

// Operation Name Helper
function getOperationDisplayName(operation: string): string {
  const names: Record<string, string> = {
    validate: "검증 (Validation)",
    summarize: "요약 (Summarize)",
    thumbnail_imagen: "썸네일 (Imagen)",
    thumbnail_gemini: "썸네일 (Gemini Flash)",
    thumbnail_og_fusion: "썸네일 (OG+AI 융합)",
    image_generation: "이미지 생성",
    unknown: "기타",
  };
  return names[operation] || operation;
}

export default function AdminAIUsagePage() {
  const [stats, setStats] = useState<AIUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("7d");
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [period]);

  async function fetchStats() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/ai-usage?period=${period}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch AI usage stats:", error);
    } finally {
      setLoading(false);
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toFixed(0);
  };

  const formatCost = (cost: number) => {
    if (cost >= 1) return `$${cost.toFixed(2)}`;
    if (cost >= 0.01) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(4)}`;
  };

  const chartData =
    stats?.requestsByDay?.map((d) => ({
      date: d.date?.split("-").slice(1).join("/") || "",
      tokens: d.tokens || 0,
      cost: d.cost || 0,
    })) || [];

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">AI 사용량</h1>
          <p className="text-[12px] text-white/50 mt-0.5">Claude API 사용량 및 비용 모니터링</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Pricing Button */}
          <button
            onClick={() => setShowPricing(true)}
            className="px-2.5 py-1.5 rounded text-[11px] bg-white/5 text-white/60 hover:text-white/80 hover:bg-white/10 transition-colors flex items-center gap-1"
          >
            <span>💰</span>
            <span>단가표</span>
          </button>

          {/* Period Selector */}
          <div className="flex gap-1">
            {(["7d", "30d", "all"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors ${
                  period === p
                    ? "bg-[var(--color-claude-coral)] text-white"
                    : "bg-white/5 text-white/50 hover:text-white/70"
                }`}
              >
                {p === "7d" ? "7일" : p === "30d" ? "30일" : "전체"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Modal */}
      <PricingModal open={showPricing} onClose={() => setShowPricing(false)} />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              title="총 비용"
              value={formatCost(stats?.totalCost || 0)}
              subValue={`${stats?.totalRequests || 0}회 요청`}
              color="emerald"
              icon="💵"
            />
            <MetricCard
              title="총 토큰"
              value={formatNumber(stats?.totalTokensUsed || 0)}
              subValue="Input + Output"
              color="coral"
              icon="🔢"
            />
            <MetricCard
              title="입력 토큰"
              value={formatNumber(stats?.totalInputTokens || 0)}
              subValue="프롬프트 비용"
              color="blue"
              icon="📥"
            />
            <MetricCard
              title="출력 토큰"
              value={formatNumber(stats?.totalOutputTokens || 0)}
              subValue="응답 비용 (더 비쌈)"
              color="coral"
              icon="📤"
            />
          </div>

          {/* Usage Chart */}
          {chartData.length > 0 && (
            <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
              <div className="text-[12px] text-white/50 mb-3">일별 토큰 사용량</div>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
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
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v)}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="tokens"
                      stroke="var(--color-claude-coral)"
                      strokeWidth={2}
                      fill="url(#colorTokens)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Two Column Layout: Models + Operations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Model Breakdown */}
            <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
              <div className="text-[12px] text-white/50 mb-3">모델별 비용</div>
              {stats?.topModels && stats.topModels.length > 0 ? (
                <div className="space-y-2">
                  {stats.topModels.map((model) => {
                    const costPercent =
                      stats.totalCost > 0 ? (model.cost / stats.totalCost) * 100 : 0;
                    return (
                      <div key={model.model} className="p-2 bg-white/[0.02] rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] text-white font-medium">
                            {getModelDisplayName(model.model)}
                          </span>
                          <span className="text-[12px] text-emerald-400 font-mono">
                            {formatCost(model.cost)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded overflow-hidden mb-1.5">
                          <div
                            className="h-full bg-[var(--color-claude-coral)]"
                            style={{ width: `${costPercent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-white/40">
                          <span>{model.count}회 요청</span>
                          <span>
                            In: {formatNumber(model.inputTokens)} / Out:{" "}
                            {formatNumber(model.outputTokens)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-[12px] text-white/30">데이터가 없습니다</div>
              )}
            </div>

            {/* Operation Breakdown */}
            <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
              <div className="text-[12px] text-white/50 mb-3">역할별 비용</div>
              {stats?.byOperation && stats.byOperation.length > 0 ? (
                <div className="space-y-2">
                  {stats.byOperation.map((op) => {
                    const costPercent = stats.totalCost > 0 ? (op.cost / stats.totalCost) * 100 : 0;
                    return (
                      <div key={op.operation} className="p-2 bg-white/[0.02] rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] text-white font-medium">
                            {getOperationDisplayName(op.operation)}
                          </span>
                          <span className="text-[12px] text-emerald-400 font-mono">
                            {formatCost(op.cost)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded overflow-hidden mb-1.5">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${costPercent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-white/40">
                          <span>{op.count}회 호출</span>
                          <span>
                            In: {formatNumber(op.inputTokens)} / Out:{" "}
                            {formatNumber(op.outputTokens)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-[12px] text-white/30">데이터가 없습니다</div>
              )}
            </div>
          </div>

          {/* Detailed Model + Operation Breakdown */}
          {stats?.byModelAndOperation && stats.byModelAndOperation.length > 0 && (
            <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
              <div className="text-[12px] text-white/50 mb-3">상세 내역 (모델 + 역할)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-2 py-2 text-left text-white/40 font-medium">모델</th>
                      <th className="px-2 py-2 text-left text-white/40 font-medium">역할</th>
                      <th className="px-2 py-2 text-right text-white/40 font-medium">요청</th>
                      <th className="px-2 py-2 text-right text-white/40 font-medium">Input</th>
                      <th className="px-2 py-2 text-right text-white/40 font-medium">Output</th>
                      <th className="px-2 py-2 text-right text-white/40 font-medium">비용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byModelAndOperation.map((item, idx) => (
                      <tr key={idx} className="border-b border-white/[0.03]">
                        <td className="px-2 py-2 text-white">{getModelDisplayName(item.model)}</td>
                        <td className="px-2 py-2 text-white/60">
                          {getOperationDisplayName(item.operation)}
                        </td>
                        <td className="px-2 py-2 text-right text-white/50 font-mono">
                          {item.count}
                        </td>
                        <td className="px-2 py-2 text-right text-blue-400 font-mono">
                          {formatNumber(item.inputTokens)}
                        </td>
                        <td className="px-2 py-2 text-right text-[var(--color-claude-coral)] font-mono">
                          {formatNumber(item.outputTokens)}
                        </td>
                        <td className="px-2 py-2 text-right text-emerald-400 font-mono">
                          {formatCost(item.cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/[0.1]">
                      <td colSpan={2} className="px-2 py-2 text-white font-medium">
                        합계
                      </td>
                      <td className="px-2 py-2 text-right text-white font-mono">
                        {stats.totalRequests}
                      </td>
                      <td className="px-2 py-2 text-right text-blue-400 font-mono">
                        {formatNumber(stats.totalInputTokens)}
                      </td>
                      <td className="px-2 py-2 text-right text-[var(--color-claude-coral)] font-mono">
                        {formatNumber(stats.totalOutputTokens)}
                      </td>
                      <td className="px-2 py-2 text-right text-emerald-400 font-mono font-semibold">
                        {formatCost(stats.totalCost)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-[11px] text-blue-400">
              뉴스 요약(Opus), 팩트체크(Haiku) 등 CCgather 서비스 운영에 사용된 Claude API 호출을
              집계합니다. Output 토큰이 Input보다 비용이 높으므로 응답 길이 최적화가 비용 절감의
              핵심입니다.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
