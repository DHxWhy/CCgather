"use client";

import { useState } from "react";
import TargetManager from "@/components/admin/TargetManager";
import CronScheduler from "@/components/admin/CronScheduler";

type TabType = "targets" | "cron" | "history";

export default function AdminAutomationPage() {
  const [activeTab, setActiveTab] = useState<TabType>("targets");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-white">뉴스 자동화</h1>
        <p className="text-[12px] text-white/50 mt-0.5">Claude Code 관련 뉴스 자동 수집 및 관리</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        <TabButton
          active={activeTab === "targets"}
          onClick={() => setActiveTab("targets")}
          label="수집 대상"
        />
        <TabButton
          active={activeTab === "cron"}
          onClick={() => setActiveTab("cron")}
          label="스케줄러"
        />
        <TabButton
          active={activeTab === "history"}
          onClick={() => setActiveTab("history")}
          label="실행 기록"
        />
      </div>

      {/* Tab Content */}
      <div key={refreshKey}>
        {activeTab === "targets" && <TargetManager onRefresh={handleRefresh} />}
        {activeTab === "cron" && <CronScheduler onRefresh={handleRefresh} />}
        {activeTab === "history" && <HistoryView />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-[12px] font-medium relative transition-colors ${
        active ? "text-white" : "text-white/40 hover:text-white/60"
      }`}
    >
      {label}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-claude-coral)]" />
      )}
    </button>
  );
}

function HistoryView() {
  const [history, setHistory] = useState<
    Array<{
      id: string;
      status: string;
      started_at: string;
      duration_ms?: number;
      items_found: number;
      items_valid: number;
      items_saved: number;
      items_skipped: number;
      error_message?: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    async function fetchHistory() {
      try {
        const response = await fetch("/api/admin/cron?history=true&limit=20");
        if (response.ok) {
          const data = await response.json();
          setHistory(data.history || []);
        }
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[12px] text-white/50">실행 기록</div>

      {history.length === 0 ? (
        <div className="text-center py-8 text-[12px] text-white/30">실행 기록이 없습니다</div>
      ) : (
        <div className="space-y-2">
          {history.map((run) => (
            <div key={run.id} className="bg-[#161616] rounded-lg p-3 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={run.status} />
                  <span className="text-[12px] text-white">
                    {new Date(run.started_at).toLocaleString("ko-KR")}
                  </span>
                </div>
                {run.duration_ms && (
                  <span className="text-[11px] text-white/40">
                    {(run.duration_ms / 1000).toFixed(1)}초
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3 text-[11px]">
                <div>
                  <div className="text-white/40">발견</div>
                  <div className="text-white font-medium">{run.items_found}개</div>
                </div>
                <div>
                  <div className="text-white/40">유효</div>
                  <div className="text-white font-medium">{run.items_valid}개</div>
                </div>
                <div>
                  <div className="text-white/40">저장</div>
                  <div className="text-emerald-400 font-medium">{run.items_saved}개</div>
                </div>
                <div>
                  <div className="text-white/40">스킵</div>
                  <div className="text-white/50 font-medium">{run.items_skipped}개</div>
                </div>
              </div>

              {run.error_message && (
                <div className="mt-2 p-2 bg-red-500/10 rounded text-[11px] text-red-400">
                  {run.error_message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    success: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "성공" },
    failed: { bg: "bg-red-500/20", text: "text-red-400", label: "실패" },
    running: { bg: "bg-blue-500/20", text: "text-blue-400", label: "실행 중" },
    cancelled: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "취소됨" },
  };

  const style = styles[status] ?? styles.running;

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] ${style?.bg ?? ""} ${style?.text ?? ""}`}>
      {style?.label ?? status}
    </span>
  );
}
