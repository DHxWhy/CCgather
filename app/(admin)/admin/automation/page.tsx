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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">뉴스 자동화</h2>
        <p className="text-white/60">Claude Code 관련 뉴스를 자동으로 수집하고 관리합니다.</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        <TabButton
          active={activeTab === "targets"}
          onClick={() => setActiveTab("targets")}
          icon="🎯"
          label="수집 대상"
        />
        <TabButton
          active={activeTab === "cron"}
          onClick={() => setActiveTab("cron")}
          icon="⏰"
          label="스케줄러"
        />
        <TabButton
          active={activeTab === "history"}
          onClick={() => setActiveTab("history")}
          icon="📋"
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
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-4 text-sm font-medium relative transition-colors ${
        active ? "text-white" : "text-white/40 hover:text-white/60"
      }`}
    >
      <span className="flex items-center gap-2">
        {icon} {label}
      </span>
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-claude-coral)]" />
      )}
    </button>
  );
}

function HistoryView() {
  const [history, setHistory] = useState<any[]>([]);
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
    return <div className="text-center py-8 text-white/40">로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">실행 기록</h3>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12 text-white/40">실행 기록이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {history.map((run) => (
            <div key={run.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <StatusBadge status={run.status} />
                  <span className="text-white font-medium">
                    {new Date(run.started_at).toLocaleString("ko-KR")}
                  </span>
                </div>
                {run.duration_ms && (
                  <span className="text-sm text-white/40">
                    {(run.duration_ms / 1000).toFixed(1)}초
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4 text-sm">
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
                  <div className="text-green-400 font-medium">{run.items_saved}개</div>
                </div>
                <div>
                  <div className="text-white/40">스킵</div>
                  <div className="text-white/60 font-medium">{run.items_skipped}개</div>
                </div>
              </div>

              {run.error_message && (
                <div className="mt-3 p-2 bg-red-500/10 rounded-lg text-sm text-red-400">
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
    success: { bg: "bg-green-500/20", text: "text-green-400", label: "성공" },
    failed: { bg: "bg-red-500/20", text: "text-red-400", label: "실패" },
    running: { bg: "bg-blue-500/20", text: "text-blue-400", label: "실행 중" },
    cancelled: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "취소됨" },
  };

  const style = styles[status] ?? styles.running;

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${style?.bg ?? ""} ${style?.text ?? ""}`}>
      {style?.label ?? status}
    </span>
  );
}
