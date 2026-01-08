"use client";

import { useState, useEffect } from "react";

interface AIUsageStats {
  totalRequests: number;
  totalTokensUsed: number;
  totalCost: number;
  requestsByDay: { date: string; count: number; tokens: number }[];
  topModels: { model: string; count: number; tokens: number }[];
}

export default function AdminAIUsagePage() {
  const [stats, setStats] = useState<AIUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("7d");

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

  const formatCurrency = (num: number) => {
    return "$" + num.toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">AI 사용량</h2>
          <p className="text-white/60">CCgather 서비스의 AI API 사용량을 모니터링합니다.</p>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? "bg-[var(--color-claude-coral)] text-white"
                  : "bg-white/10 text-white/60 hover:text-white"
              }`}
            >
              {p === "7d" ? "7일" : p === "30d" ? "30일" : "전체"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="text-3xl font-bold text-white mb-1">
                {formatNumber(stats?.totalRequests || 0)}
              </div>
              <div className="text-sm text-white/60">총 요청 수</div>
            </div>
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="text-3xl font-bold text-[var(--color-claude-coral)] mb-1">
                {formatNumber(stats?.totalTokensUsed || 0)}
              </div>
              <div className="text-sm text-white/60">총 토큰 사용량</div>
            </div>
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="text-3xl font-bold text-green-400 mb-1">
                {formatCurrency(stats?.totalCost || 0)}
              </div>
              <div className="text-sm text-white/60">예상 비용</div>
            </div>
          </div>

          {/* Usage by Day */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">일별 사용량</h3>
            {stats?.requestsByDay && stats.requestsByDay.length > 0 ? (
              <div className="space-y-2">
                {stats.requestsByDay.slice(0, 10).map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center gap-4 py-2 border-b border-white/5 last:border-0"
                  >
                    <div className="w-24 text-white/60 text-sm">{day.date}</div>
                    <div className="flex-1">
                      <div
                        className="h-6 bg-[var(--color-claude-coral)]/30 rounded"
                        style={{
                          width: `${Math.min(100, (day.tokens / (stats.requestsByDay[0]?.tokens || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="w-20 text-right text-white text-sm">
                      {formatNumber(day.tokens)}
                    </div>
                    <div className="w-16 text-right text-white/40 text-sm">{day.count}건</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-white/40 py-8">데이터가 없습니다.</div>
            )}
          </div>

          {/* Top Models */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">모델별 사용량</h3>
            {stats?.topModels && stats.topModels.length > 0 ? (
              <div className="space-y-3">
                {stats.topModels.map((model, index) => (
                  <div key={model.model} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">{model.model}</div>
                      <div className="text-sm text-white/40">{model.count} 요청</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">{formatNumber(model.tokens)}</div>
                      <div className="text-sm text-white/40">토큰</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-white/40 py-8">데이터가 없습니다.</div>
            )}
          </div>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-400 text-sm">
              💡 AI 사용량은 뉴스 요약, YouTube 영상 분석 등 CCgather 서비스 운영에 사용된 Claude
              API 호출을 집계합니다.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
