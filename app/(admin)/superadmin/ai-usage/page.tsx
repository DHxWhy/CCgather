"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle } from "lucide-react";

// =====================================================
// Model Configuration with Pricing & Lifecycle Info
// =====================================================

interface ModelConfig {
  name: string;
  role: string;
  input?: number; // per 1M tokens
  output?: number; // per 1M tokens
  perImage?: number; // per image
  status: "ga" | "preview";
  endDate?: string; // ISO date string (e.g., "2026-03-03")
  note?: string;
}

// Gemini LLM Models (per 1M tokens)
const GEMINI_LLM_MODELS: Record<string, ModelConfig> = {
  "gemini-3-flash-preview": {
    name: "Gemini 3 Flash",
    role: "News Processing",
    input: 0.5,
    output: 3.0,
    status: "preview",
    endDate: undefined, // New model, no deprecation announced
    note: "Latest model - no end date announced",
  },
  "gemini-2.0-flash": {
    name: "Gemini 2.0 Flash",
    role: "Tools Analysis / OG Vision",
    input: 0.1,
    output: 0.4,
    status: "ga",
    endDate: "2026-03-03",
    note: "Will be retired March 3, 2026",
  },
};

// Image Generation Models (per image)
const IMAGE_MODELS: Record<string, ModelConfig> = {
  "imagen-4.0-generate-001": {
    name: "Imagen 4",
    role: "Thumbnail (AI Generation)",
    perImage: 0.04,
    status: "ga",
    note: "Stable GA version",
  },
  "gemini-2.5-flash-image": {
    name: "Gemini 2.5 Flash Image",
    role: "Thumbnail (Nano Banana)",
    perImage: 0.039,
    status: "ga",
    note: "Stable GA version - successor to preview",
  },
};

// Claude API Models (reserved for future use)
const CLAUDE_MODELS: Record<string, ModelConfig> = {
  "claude-3-5-haiku-20241022": {
    name: "Haiku 3.5",
    role: "Verification",
    input: 0.8,
    output: 4.0,
    status: "ga",
  },
  "claude-opus-4-5-20250514": {
    name: "Opus 4.5",
    role: "Summary",
    input: 15.0,
    output: 75.0,
    status: "ga",
  },
  "claude-sonnet-4-20250514": {
    name: "Sonnet 4",
    role: "General",
    input: 3.0,
    output: 15.0,
    status: "ga",
  },
};

// Combined lookups
const ALL_MODELS: Record<string, ModelConfig> = {
  ...GEMINI_LLM_MODELS,
  ...IMAGE_MODELS,
  ...CLAUDE_MODELS,
};

// =====================================================
// Types
// =====================================================

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

// =====================================================
// Helper Components
// =====================================================

// Status Badge Component
function StatusBadge({ config }: { config: ModelConfig }) {
  const isPreview = config.status === "preview";
  const hasEndDate = !!config.endDate;
  const endDate = config.endDate ? new Date(config.endDate) : null;
  const isEndingSoon = endDate && endDate.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000; // 30 days

  if (!isPreview) {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
        GA
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span
        className={`text-[9px] px-1.5 py-0.5 rounded ${
          isEndingSoon ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
        }`}
      >
        Preview
      </span>
      {hasEndDate ? (
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded ${
            isEndingSoon ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white/60"
          }`}
        >
          ~{config.endDate}
        </span>
      ) : (
        <span className="text-amber-400" title="End date not announced">
          <AlertTriangle className="w-3 h-3" />
        </span>
      )}
    </div>
  );
}

// Pricing Modal Component
function PricingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] rounded-lg border border-white/10 p-4 w-[420px] shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-white">AI API Pricing & Status</h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Gemini LLM Section */}
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[10px] text-white/40">Gemini LLM (per 1M tokens)</div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
            Active
          </span>
        </div>
        <div className="space-y-2">
          {Object.entries(GEMINI_LLM_MODELS).map(([model, config]) => (
            <div key={model} className="bg-blue-500/5 rounded-lg p-2.5 border border-blue-500/10">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-white">{config.name}</span>
                  <StatusBadge config={config} />
                </div>
              </div>
              <div className="text-[10px] text-white/50 mb-1.5">{config.role}</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Input</span>
                  <span className="text-emerald-400 font-mono">${config.input?.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Output</span>
                  <span className="text-amber-400 font-mono">${config.output?.toFixed(2)}</span>
                </div>
              </div>
              {config.note && <div className="mt-1.5 text-[9px] text-white/30">{config.note}</div>}
            </div>
          ))}
        </div>

        {/* Image Generation Section */}
        <div className="flex items-center gap-2 mb-2 mt-4">
          <div className="text-[10px] text-white/40">Image Generation (per image)</div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
            Active
          </span>
        </div>
        <div className="space-y-2">
          {Object.entries(IMAGE_MODELS)
            .filter(([model]) => !model.includes("-preview")) // Avoid duplicates
            .map(([model, config]) => (
              <div
                key={model}
                className="bg-purple-500/5 rounded-lg p-2.5 border border-purple-500/10"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-white">{config.name}</span>
                    <StatusBadge config={config} />
                  </div>
                  <span className="text-emerald-400 font-mono text-[11px]">
                    ${config.perImage?.toFixed(config.perImage < 0.01 ? 4 : 3)}
                  </span>
                </div>
                <div className="text-[10px] text-white/50">{config.role}</div>
                {config.note && (
                  <div className="mt-1.5 text-[9px] text-white/30">{config.note}</div>
                )}
              </div>
            ))}
        </div>

        {/* Claude API Section - Not Currently Used */}
        <div className="flex items-center gap-2 mb-2 mt-4">
          <div className="text-[10px] text-white/40">Claude API (per 1M tokens)</div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">
            Not in use
          </span>
        </div>
        <div className="space-y-2 opacity-50">
          {Object.entries(CLAUDE_MODELS).map(([model, config]) => (
            <div key={model} className="bg-white/5 rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-medium text-white">{config.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                  {config.role}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Input</span>
                  <span className="text-emerald-400 font-mono">${config.input?.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Output</span>
                  <span className="text-[var(--color-claude-coral)] font-mono">
                    ${config.output?.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <div className="text-[10px] text-white/30 space-y-0.5">
            <div>* News processing uses Gemini 3 Flash</div>
            <div>* Thumbnail generation uses Imagen 4 / Gemini Flash Image</div>
            <div>* Tools analysis uses Gemini 2.0 Flash</div>
            <div className="text-amber-400/70 flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3 h-3" />
              <span>Preview models may be discontinued</span>
            </div>
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
      <div className="text-white font-medium">{payload[0].value.toLocaleString()} tokens</div>
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

// Model Display Helper
function getModelInfo(modelId: string): { name: string; role: string; config?: ModelConfig } {
  const config = ALL_MODELS[modelId];
  if (config) {
    return { name: config.name, role: config.role, config };
  }
  // Fallback for unknown models
  return {
    name: modelId.split("-").slice(-2).join(" ") || modelId,
    role: "Unknown",
  };
}

// Operation Name Helper
function getOperationDisplayName(operation: string): string {
  const names: Record<string, string> = {
    // News Processing Pipeline
    gemini_pipeline: "News Pipeline",

    // Thumbnail Generation
    thumbnail_imagen: "Thumbnail (Imagen)",
    thumbnail_gemini: "Thumbnail (Gemini Flash)",
    thumbnail_style_transfer: "Thumbnail (Style Transfer)",
    thumbnail_og_fusion: "Thumbnail (OG+AI Fusion)",
    thumbnail_generate: "Thumbnail (AI)",

    // Tool Analysis
    tool_analysis: "Tool Analysis",

    // Legacy/Other
    validate: "Validation",
    summarize: "Summarize",
    image_generation: "Image Generation",
    unknown: "Other",
  };
  return names[operation] || operation;
}

// =====================================================
// Main Component
// =====================================================

export default function AdminAIUsagePage() {
  const [stats, setStats] = useState<AIUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("7d");
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => {
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
    fetchStats();
  }, [period]);

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
          <h1 className="text-lg font-semibold text-white">AI Usage</h1>
          <p className="text-[12px] text-white/50 mt-0.5">
            Gemini & Imagen API usage and cost monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Pricing Button */}
          <button
            onClick={() => setShowPricing(true)}
            className="px-2.5 py-1.5 rounded text-[11px] bg-white/5 text-white/60 hover:text-white/80 hover:bg-white/10 transition-colors flex items-center gap-1"
          >
            <span>💰</span>
            <span>Pricing</span>
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
                {p === "7d" ? "7D" : p === "30d" ? "30D" : "All"}
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
              title="Total Cost"
              value={formatCost(stats?.totalCost || 0)}
              subValue={`${stats?.totalRequests || 0} requests`}
              color="emerald"
              icon="💵"
            />
            <MetricCard
              title="Total Tokens"
              value={formatNumber(stats?.totalTokensUsed || 0)}
              subValue="Input + Output"
              color="coral"
              icon="🔢"
            />
            <MetricCard
              title="Input Tokens"
              value={formatNumber(stats?.totalInputTokens || 0)}
              subValue="Prompt cost"
              color="blue"
              icon="📥"
            />
            <MetricCard
              title="Output Tokens"
              value={formatNumber(stats?.totalOutputTokens || 0)}
              subValue="Response cost (higher)"
              color="coral"
              icon="📤"
            />
          </div>

          {/* Usage Chart */}
          {chartData.length > 0 && (
            <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
              <div className="text-[12px] text-white/50 mb-3">Daily Token Usage</div>
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
              <div className="text-[12px] text-white/50 mb-3">Cost by Model</div>
              {stats?.topModels && stats.topModels.length > 0 ? (
                <div className="space-y-2">
                  {stats.topModels.map((model) => {
                    const costPercent =
                      stats.totalCost > 0 ? (model.cost / stats.totalCost) * 100 : 0;
                    const modelInfo = getModelInfo(model.model);
                    return (
                      <div key={model.model} className="p-2.5 bg-white/[0.02] rounded">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-white font-medium">
                              {modelInfo.name}
                            </span>
                            {modelInfo.config && <StatusBadge config={modelInfo.config} />}
                          </div>
                          <span className="text-[12px] text-emerald-400 font-mono">
                            {formatCost(model.cost)}
                          </span>
                        </div>
                        <div className="text-[10px] text-white/40 mb-1.5">{modelInfo.role}</div>
                        <div className="h-1.5 bg-white/5 rounded overflow-hidden mb-1.5">
                          <div
                            className="h-full bg-[var(--color-claude-coral)]"
                            style={{ width: `${costPercent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-white/40">
                          <span>{model.count} requests</span>
                          {modelInfo.config?.perImage ? (
                            <span className="text-white/20">per-image pricing</span>
                          ) : (
                            <span>
                              In: {formatNumber(model.inputTokens)} / Out:{" "}
                              {formatNumber(model.outputTokens)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-[12px] text-white/30">No data</div>
              )}
            </div>

            {/* Operation Breakdown */}
            <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
              <div className="text-[12px] text-white/50 mb-3">Cost by Operation</div>
              {stats?.byOperation && stats.byOperation.length > 0 ? (
                <div className="space-y-2">
                  {stats.byOperation.map((op) => {
                    const costPercent = stats.totalCost > 0 ? (op.cost / stats.totalCost) * 100 : 0;
                    return (
                      <div key={op.operation} className="p-2.5 bg-white/[0.02] rounded">
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
                          <span>{op.count} calls</span>
                          {op.operation.startsWith("thumbnail_") ||
                          op.operation === "image_generation" ? (
                            <span className="text-white/20">per-image pricing</span>
                          ) : (
                            <span>
                              In: {formatNumber(op.inputTokens)} / Out:{" "}
                              {formatNumber(op.outputTokens)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-[12px] text-white/30">No data</div>
              )}
            </div>
          </div>

          {/* Detailed Model + Operation Breakdown */}
          {stats?.byModelAndOperation && stats.byModelAndOperation.length > 0 && (
            <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
              <div className="text-[12px] text-white/50 mb-3">
                Detailed Breakdown (Model + Operation)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-2 py-2 text-left text-white/40 font-medium">Model</th>
                      <th className="px-2 py-2 text-left text-white/40 font-medium">Role</th>
                      <th className="px-2 py-2 text-left text-white/40 font-medium">Operation</th>
                      <th className="px-2 py-2 text-right text-white/40 font-medium">Requests</th>
                      <th className="px-2 py-2 text-right text-white/40 font-medium">Input</th>
                      <th className="px-2 py-2 text-right text-white/40 font-medium">Output</th>
                      <th className="px-2 py-2 text-right text-white/40 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byModelAndOperation.map((item, idx) => {
                      const modelInfo = getModelInfo(item.model);
                      return (
                        <tr key={idx} className="border-b border-white/[0.03]">
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-white">{modelInfo.name}</span>
                              {modelInfo.config?.status === "preview" && (
                                <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                  P
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-white/40">{modelInfo.role}</td>
                          <td className="px-2 py-2 text-white/60">
                            {getOperationDisplayName(item.operation)}
                          </td>
                          <td className="px-2 py-2 text-right text-white/50 font-mono">
                            {item.count}
                          </td>
                          <td className="px-2 py-2 text-right text-blue-400 font-mono">
                            {modelInfo.config?.perImage ? (
                              <span className="text-white/30">-</span>
                            ) : (
                              formatNumber(item.inputTokens)
                            )}
                          </td>
                          <td className="px-2 py-2 text-right text-[var(--color-claude-coral)] font-mono">
                            {modelInfo.config?.perImage ? (
                              <span className="text-white/30">-</span>
                            ) : (
                              formatNumber(item.outputTokens)
                            )}
                          </td>
                          <td className="px-2 py-2 text-right text-emerald-400 font-mono">
                            {formatCost(item.cost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/[0.1]">
                      <td colSpan={3} className="px-2 py-2 text-white font-medium">
                        Total
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
              Tracking Gemini API usage for news processing, tool analysis, and thumbnail
              generation. Output tokens are more expensive than input - optimize response length for
              cost savings.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
