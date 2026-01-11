"use client";

import { useState, useEffect } from "react";
import type { CronJob, CronRunHistory } from "@/types/automation";

interface CronSchedulerProps {
  onRefresh?: () => void;
}

const SCHEDULE_PRESETS = [
  { label: "매시간", value: "0 * * * *", desc: "매시 정각" },
  { label: "3시간마다", value: "0 */3 * * *", desc: "0시, 3시, 6시..." },
  { label: "6시간마다", value: "0 */6 * * *", desc: "0시, 6시, 12시, 18시" },
  { label: "12시간마다", value: "0 0,12 * * *", desc: "자정, 정오" },
  { label: "매일 (09:00 KST)", value: "0 0 * * *", desc: "UTC 0시 = KST 9시" },
  { label: "매일 (21:00 KST)", value: "0 12 * * *", desc: "UTC 12시 = KST 21시" },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  success: { bg: "bg-green-500/20", text: "text-green-400", label: "성공" },
  failed: { bg: "bg-red-500/20", text: "text-red-400", label: "실패" },
  running: { bg: "bg-blue-500/20", text: "text-blue-400", label: "실행 중" },
  cancelled: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "취소됨" },
};

export default function CronScheduler({ onRefresh }: CronSchedulerProps) {
  const [job, setJob] = useState<CronJob | null>(null);
  const [history, setHistory] = useState<CronRunHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showScheduleEdit, setShowScheduleEdit] = useState(false);
  const [customSchedule, setCustomSchedule] = useState("");

  useEffect(() => {
    fetchJobStatus();
  }, []);

  async function fetchJobStatus() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/cron?history=true&limit=5");
      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
        setHistory(data.history || []);
        setCustomSchedule(data.job?.schedule || "0 0 * * *");
      }
    } catch (error) {
      console.error("Failed to fetch cron status:", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleEnabled() {
    if (!job) return;

    try {
      const response = await fetch("/api/admin/cron", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled: !job.is_enabled }),
      });

      if (response.ok) {
        fetchJobStatus();
        onRefresh?.();
      }
    } catch (error) {
      console.error("Failed to toggle cron:", error);
    }
  }

  async function updateSchedule(schedule: string) {
    try {
      const response = await fetch("/api/admin/cron", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule }),
      });

      if (response.ok) {
        setShowScheduleEdit(false);
        fetchJobStatus();
        onRefresh?.();
      } else {
        const data = await response.json();
        alert(data.error || "스케줄 업데이트 실패");
      }
    } catch (error) {
      console.error("Failed to update schedule:", error);
    }
  }

  async function triggerManualRun() {
    if (running) return;

    setRunning(true);
    try {
      const response = await fetch("/api/admin/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`수집 시작됨 (Run ID: ${data.run_id})`);
        fetchJobStatus();
        onRefresh?.();
      } else {
        const data = await response.json();
        alert(data.error || "실행 실패");
      }
    } catch (error) {
      console.error("Failed to trigger cron:", error);
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-white/40">로딩 중...</div>;
  }

  if (!job) {
    return <div className="text-center py-8 text-white/40">Cron 작업을 찾을 수 없습니다.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{job.name}</h3>
          <p className="text-sm text-white/60">{job.description}</p>
        </div>
        <button
          onClick={toggleEnabled}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            job.is_enabled
              ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
              : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
          }`}
        >
          {job.is_enabled ? "활성화됨" : "비활성화됨"}
        </button>
      </div>

      {/* Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Schedule */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="text-sm text-white/40 mb-1">실행 주기</div>
          <div className="flex items-center justify-between">
            <code className="text-white font-mono text-sm">{job.schedule}</code>
            <button
              onClick={() => setShowScheduleEdit(true)}
              className="text-xs text-[var(--color-claude-coral)] hover:underline"
            >
              변경
            </button>
          </div>
          <div className="text-xs text-white/30 mt-1">
            {SCHEDULE_PRESETS.find((p) => p.value === job.schedule)?.desc || "커스텀 스케줄"}
          </div>
        </div>

        {/* Last Run */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="text-sm text-white/40 mb-1">마지막 실행</div>
          <div className="text-white font-medium">
            {job.last_run_at ? new Date(job.last_run_at).toLocaleString("ko-KR") : "없음"}
          </div>
          {job.last_run_status && (
            <span
              className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${
                STATUS_STYLES[job.last_run_status]?.bg
              } ${STATUS_STYLES[job.last_run_status]?.text}`}
            >
              {STATUS_STYLES[job.last_run_status]?.label}
              {job.last_run_duration_ms && ` (${(job.last_run_duration_ms / 1000).toFixed(1)}초)`}
            </span>
          )}
        </div>

        {/* Statistics */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="text-sm text-white/40 mb-1">통계</div>
          <div className="text-white font-medium">
            {job.success_count} / {job.run_count} 성공
          </div>
          <div className="text-xs text-white/30 mt-1">총 수집: {job.total_items_collected}개</div>
        </div>
      </div>

      {/* Manual Run Button */}
      <div className="flex gap-3">
        <button
          onClick={triggerManualRun}
          disabled={running || job.is_running}
          className="px-6 py-3 bg-[var(--color-claude-coral)] text-white rounded-xl hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {running || job.is_running ? (
            <>
              <span className="animate-spin">⏳</span> 실행 중...
            </>
          ) : (
            <>🚀 지금 실행</>
          )}
        </button>
        <button
          onClick={fetchJobStatus}
          className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
        >
          🔄 새로고침
        </button>
      </div>

      {/* Schedule Edit Modal */}
      {showScheduleEdit && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-md p-6">
            <h4 className="text-xl font-bold text-white mb-4">실행 주기 변경</h4>

            <div className="space-y-4">
              {/* Presets */}
              <div className="grid grid-cols-2 gap-2">
                {SCHEDULE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setCustomSchedule(preset.value)}
                    className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      customSchedule === preset.value
                        ? "bg-[var(--color-claude-coral)] text-white"
                        : "bg-white/10 text-white/60 hover:text-white"
                    }`}
                  >
                    <div className="font-medium">{preset.label}</div>
                    <div className="text-xs opacity-60">{preset.desc}</div>
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Cron 표현식 (UTC)
                </label>
                <input
                  type="text"
                  value={customSchedule}
                  onChange={(e) => setCustomSchedule(e.target.value)}
                  placeholder="0 0 * * *"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
                />
                <p className="text-xs text-white/30 mt-1">
                  분 시 일 월 요일 (예: 0 9 * * * = 매일 09:00)
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowScheduleEdit(false)}
                className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => updateSchedule(customSchedule)}
                className="flex-1 px-4 py-3 bg-[var(--color-claude-coral)] text-white rounded-xl hover:opacity-90 transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Run History */}
      <div>
        <h4 className="text-sm font-medium text-white/60 mb-3">실행 기록</h4>
        <div className="space-y-2">
          {history.length === 0 ? (
            <div className="text-center py-4 text-white/40 text-sm">실행 기록이 없습니다.</div>
          ) : (
            history.map((run) => (
              <div
                key={run.id}
                className="bg-white/5 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      STATUS_STYLES[run.status]?.bg
                    } ${STATUS_STYLES[run.status]?.text}`}
                  >
                    {STATUS_STYLES[run.status]?.label}
                  </span>
                  <span className="text-sm text-white/60">
                    {new Date(run.started_at).toLocaleString("ko-KR")}
                  </span>
                </div>
                <div className="text-sm text-white/40">
                  {run.items_saved}개 저장 / {run.items_found}개 발견
                  {run.duration_ms && (
                    <span className="ml-2">({(run.duration_ms / 1000).toFixed(1)}초)</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
