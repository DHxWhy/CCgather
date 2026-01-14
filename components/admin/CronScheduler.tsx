"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { CronJob, CronRunHistory, CronLogEntry, TargetCategory } from "@/types/automation";

interface CronSchedulerProps {
  onRefresh?: () => void;
}

// Available cron jobs
const CRON_JOBS = [
  { id: "news-collector", name: "뉴스 수집", icon: "📰", desc: "Claude Code 관련 뉴스 수집" },
];

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

const CATEGORY_OPTIONS: Array<{ value: TargetCategory; label: string; color: string }> = [
  { value: "official", label: "공식", color: "bg-blue-500" },
  { value: "claude_code", label: "Claude Code", color: "bg-orange-500" },
  { value: "press", label: "AI 뉴스", color: "bg-green-500" },
  { value: "youtube", label: "YouTube", color: "bg-red-500" },
];

export default function CronScheduler({ onRefresh }: CronSchedulerProps) {
  const [selectedJobId, setSelectedJobId] = useState(CRON_JOBS[0]!.id);
  const [job, setJob] = useState<CronJob | null>(null);
  const [history, setHistory] = useState<CronRunHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showScheduleEdit, setShowScheduleEdit] = useState(false);
  const [customSchedule, setCustomSchedule] = useState("");

  // Manual URL collection state
  const [manualUrl, setManualUrl] = useState("");
  const [manualCategory, setManualCategory] = useState<TargetCategory>("press");
  const [manualCollecting, setManualCollecting] = useState(false);
  const [manualProgress, setManualProgress] = useState<{
    stage: string;
    message: string;
    progress?: number;
    steps?: Array<{ stage: string; message: string; completed: boolean }>;
  } | null>(null);
  const manualAbortRef = useRef<AbortController | null>(null);

  // Log modal state for batch collection
  const [showLogModal, setShowLogModal] = useState(false);

  // Force re-collection dialog state
  const [showForceDialog, setShowForceDialog] = useState(false);
  const [forceDialogData, setForceDialogData] = useState<{
    url: string;
    category: TargetCategory;
    existingId: string;
    existingStatus: string;
    existingStatusLabel: string;
    existingTitle: string;
  } | null>(null);

  // Live progress polling state
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [liveProgress, setLiveProgress] = useState<CronLogEntry[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const batchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchJobStatus();
  }, [selectedJobId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setCurrentRunId(null);
  }, []);

  const pollProgress = useCallback(
    async (runId: string) => {
      try {
        const response = await fetch(`/api/admin/cron/status?runId=${runId}`);
        if (response.ok) {
          const data = await response.json();
          setLiveProgress(data.log || []);

          // Check if run is complete
          if (data.status !== "running") {
            stopPolling();
            setRunning(false);
            fetchJobStatus();
            onRefresh?.();
          }
        }
      } catch (error) {
        console.error("Failed to poll progress:", error);
      }
    },
    [stopPolling, onRefresh]
  );

  const startPolling = useCallback(
    (runId: string) => {
      setCurrentRunId(runId);
      setLiveProgress([]);

      // Poll immediately
      pollProgress(runId);

      // Then poll every 2 seconds
      pollingRef.current = setInterval(() => {
        pollProgress(runId);
      }, 2000);
    },
    [pollProgress]
  );

  async function fetchJobStatus() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/cron?jobId=${selectedJobId}&history=true&limit=5`);
      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
        setHistory(data.history || []);
        setCustomSchedule(data.job?.schedule || "0 0 * * *");

        // Check if there's a running job and start polling
        if (data.job?.is_running && data.history?.[0]?.status === "running") {
          startPolling(data.history[0].id);
          setRunning(true);
        }
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
        body: JSON.stringify({ jobId: selectedJobId, is_enabled: !job.is_enabled }),
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
        body: JSON.stringify({ jobId: selectedJobId, schedule }),
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

    // Create new AbortController for batch collection
    batchAbortRef.current = new AbortController();

    setRunning(true);
    setLiveProgress([]);

    try {
      const response = await fetch("/api/admin/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId }),
        signal: batchAbortRef.current.signal,
      });

      if (response.ok) {
        const data = await response.json();
        startPolling(data.run_id);
      } else {
        const data = await response.json();
        alert(data.error || "실행 실패");
        setRunning(false);
      }
    } catch (error) {
      // Handle abort error
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Failed to trigger cron:", error);
      setRunning(false);
    }
  }

  // Cancel batch collection
  async function cancelBatchCollection() {
    // Abort the fetch request if it's still pending
    if (batchAbortRef.current) {
      batchAbortRef.current.abort();
      batchAbortRef.current = null;
    }

    // Stop polling
    stopPolling();

    // Call the cancel API
    try {
      const params = new URLSearchParams({ jobId: selectedJobId });
      if (currentRunId) {
        params.append("runId", currentRunId);
      }

      await fetch(`/api/admin/cron?${params.toString()}`, {
        method: "DELETE",
      });

      // Add cancelled message to live progress
      setLiveProgress((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          level: "warn",
          message: "수집이 사용자에 의해 취소되었습니다.",
        },
      ]);
    } catch (error) {
      console.error("Failed to cancel cron:", error);
    } finally {
      setRunning(false);
      setCurrentRunId(null);
      // Refresh status after a short delay
      setTimeout(() => {
        fetchJobStatus();
        onRefresh?.();
      }, 1000);
    }
  }

  // Cancel manual URL collection
  function cancelManualCollection() {
    if (manualAbortRef.current) {
      manualAbortRef.current.abort();
      manualAbortRef.current = null;
      setManualProgress({ stage: "cancelled", message: "수집이 취소되었습니다." });
      setManualCollecting(false);
      setTimeout(() => setManualProgress(null), 2000);
    }
  }

  // Manual URL collection with streaming progress
  async function collectSingleUrl(forceRecollect = false) {
    if (!manualUrl.trim() || manualCollecting) return;

    // Basic URL validation
    try {
      new URL(manualUrl);
    } catch {
      alert("유효한 URL을 입력해주세요.");
      return;
    }

    // Create new AbortController
    manualAbortRef.current = new AbortController();

    setManualCollecting(true);

    // Initialize progress with steps
    const initialSteps = [
      { stage: "checking", message: "기존 콘텐츠 확인", completed: false },
      { stage: "fetching", message: "웹 페이지 분석", completed: false },
      { stage: "ai_stage1", message: "AI Stage 1: 팩트 추출", completed: false },
      { stage: "ai_stage2", message: "AI Stage 2: 기사 리라이팅", completed: false },
      { stage: "ai_stage3", message: "AI Stage 3: 팩트 검증", completed: false },
      { stage: "saving", message: "데이터베이스 저장", completed: false },
      { stage: "thumbnail", message: "썸네일 생성", completed: false },
    ];
    setManualProgress({
      stage: "starting",
      message: "수집 시작 중...",
      progress: 0,
      steps: initialSteps,
    });

    try {
      const response = await fetch("/api/admin/collect-single/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: manualUrl.trim(),
          category: manualCategory,
          force: forceRecollect,
        }),
        signal: manualAbortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Stream connection failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));

              // Update progress based on event
              setManualProgress((prev) => {
                const updatedSteps = (prev?.steps || initialSteps).map((step) => ({
                  ...step,
                  completed: getStageOrder(step.stage) < getStageOrder(event.stage),
                }));

                return {
                  stage: event.stage,
                  message: event.message,
                  progress: event.progress || prev?.progress,
                  steps: updatedSteps,
                };
              });

              // Handle conflict (URL already exists)
              if (event.stage === "conflict" && event.data?.can_force) {
                setForceDialogData({
                  url: manualUrl.trim(),
                  category: manualCategory,
                  existingId: event.data.existing_id as string,
                  existingStatus: event.data.existing_status as string,
                  existingStatusLabel: event.data.existing_status_label as string,
                  existingTitle: event.data.existing_title as string,
                });
                setShowForceDialog(true);
                setManualProgress(null);
                setManualCollecting(false);
                return;
              }

              // Handle completion
              if (event.stage === "complete" && event.data?.success) {
                const data = event.data;
                const statusInfo = data.needs_review
                  ? " (재검토 필요)"
                  : (data.retry_count as number) > 0
                    ? ` (재시도 ${data.retry_count}회)`
                    : "";
                setManualProgress({
                  stage: "complete",
                  message: `${event.message}${statusInfo}`,
                  progress: 100,
                  steps: initialSteps.map((s) => ({ ...s, completed: true })),
                });
                setManualUrl("");
                onRefresh?.();

                // Reset progress after a delay
                setTimeout(() => {
                  setManualProgress(null);
                }, 5000);
              }

              // Handle error
              if (event.stage === "error") {
                setManualProgress({
                  stage: "error",
                  message: event.message,
                  progress: 0,
                });
              }
            } catch {
              // JSON parse error, ignore
            }
          }
        }
      }
    } catch (error) {
      // Handle abort error
      if (error instanceof Error && error.name === "AbortError") {
        // Already handled in cancelManualCollection
        return;
      }
      console.error("Failed to collect URL:", error);
      setManualProgress({ stage: "error", message: "수집 중 오류 발생" });
    } finally {
      manualAbortRef.current = null;
      setManualCollecting(false);
    }
  }

  // Helper to get stage order for progress tracking
  function getStageOrder(stage: string): number {
    const order: Record<string, number> = {
      checking: 1,
      fetching: 2,
      ai_stage1: 3,
      ai_stage2: 4,
      ai_stage3: 5,
      saving: 6,
      thumbnail: 7,
      complete: 8,
    };
    return order[stage] || 0;
  }

  // Force re-collection after user confirmation
  async function handleForceRecollect() {
    if (!forceDialogData) return;

    setShowForceDialog(false);
    setManualUrl(forceDialogData.url);
    setManualCategory(forceDialogData.category);

    // Small delay to ensure state is updated
    setTimeout(() => {
      collectSingleUrl(true);
    }, 100);
  }

  // Cancel force dialog
  function handleCancelForce() {
    setShowForceDialog(false);
    setForceDialogData(null);
    setManualProgress(null);
  }

  if (loading) {
    return <div className="text-center py-8 text-white/40">로딩 중...</div>;
  }

  const selectedJobInfo = CRON_JOBS.find((j) => j.id === selectedJobId);

  return (
    <div className="space-y-6">
      {/* Job Selector */}
      <div className="flex gap-2">
        {CRON_JOBS.map((cronJob) => (
          <button
            key={cronJob.id}
            onClick={() => setSelectedJobId(cronJob.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedJobId === cronJob.id
                ? "bg-[var(--color-claude-coral)] text-white"
                : "bg-white/10 text-white/60 hover:text-white hover:bg-white/20"
            }`}
          >
            <span>{cronJob.icon}</span>
            <span>{cronJob.name}</span>
          </button>
        ))}
      </div>

      {/* Job not initialized */}
      {!job && (
        <div className="text-center py-8">
          <p className="text-white/40 mb-4">
            {selectedJobInfo?.icon} {selectedJobInfo?.name} 작업이 아직 초기화되지 않았습니다.
          </p>
          <button
            onClick={triggerManualRun}
            disabled={running}
            className="px-6 py-3 bg-[var(--color-claude-coral)] text-white rounded-xl hover:opacity-90 transition-colors disabled:opacity-50"
          >
            {running ? "초기화 중..." : "🚀 첫 실행으로 초기화"}
          </button>
        </div>
      )}

      {/* Job exists */}
      {job && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {selectedJobInfo?.icon} {job?.name || selectedJobInfo?.name}
              </h3>
              <p className="text-sm text-white/60">{job?.description || selectedJobInfo?.desc}</p>
            </div>
            <button
              onClick={toggleEnabled}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                job?.is_enabled
                  ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                  : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              }`}
            >
              {job?.is_enabled ? "활성화됨" : "비활성화됨"}
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
                  {job.last_run_duration_ms &&
                    ` (${(job.last_run_duration_ms / 1000).toFixed(1)}초)`}
                </span>
              )}
            </div>

            {/* Statistics */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/40 mb-1">통계</div>
              <div className="text-white font-medium">
                {job.success_count} / {job.run_count} 성공
              </div>
              <div className="text-xs text-white/30 mt-1">
                총 수집: {job.total_items_collected}개
              </div>
            </div>
          </div>

          {/* Manual Run Button */}
          <div className="flex gap-3">
            {running || job.is_running ? (
              <button
                onClick={cancelBatchCollection}
                className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <span>⏹️</span> 수집 중지
              </button>
            ) : (
              <button
                onClick={triggerManualRun}
                className="px-6 py-3 bg-[var(--color-claude-coral)] text-white rounded-xl hover:opacity-90 transition-colors flex items-center gap-2"
              >
                🚀 전체 수집 실행
              </button>
            )}
            <button
              onClick={() => setShowLogModal(true)}
              className="px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2"
              title="실행 로그"
            >
              📋 로그
            </button>
            <button
              onClick={() => {
                stopPolling();
                fetchJobStatus();
              }}
              className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
            >
              🔄 새로고침
            </button>
          </div>

          {/* Live Progress Panel */}
          {(running || liveProgress.length > 0) && (
            <div className="bg-black/30 rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                  {running ? <span className="animate-pulse">🔄</span> : <span>📋</span>}
                  {running ? "실행 진행 상황" : "실행 로그"}
                </h4>
                {running && (
                  <button
                    onClick={cancelBatchCollection}
                    className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                  >
                    중지
                  </button>
                )}
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
                {liveProgress.length === 0 ? (
                  <div className="text-white/40">대기 중...</div>
                ) : (
                  liveProgress.map((log, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-2 ${
                        log.level === "error"
                          ? "text-red-400"
                          : log.level === "warn"
                            ? "text-yellow-400"
                            : "text-white/70"
                      }`}
                    >
                      <span className="text-white/30 flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString("ko-KR")}
                      </span>
                      <span>{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

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
                      id="cron-schedule"
                      name="cron-schedule"
                      type="text"
                      value={customSchedule}
                      onChange={(e) => setCustomSchedule(e.target.value)}
                      placeholder="0 0 * * *"
                      autoComplete="off"
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
        </>
      )}

      {/* Manual URL Collection Section - Below News Collector */}
      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl p-4 border border-purple-500/20">
        <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <span>🔗</span> URL 직접 수집
        </h4>
        <p className="text-xs text-white/50 mb-3">
          URL을 입력하면 AI가 콘텐츠를 분석하고 재작성합니다. 검토 후 게시할 수 있습니다.
        </p>

        <div className="flex gap-2 mb-3">
          <input
            id="manual-url"
            name="manual-url"
            type="url"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="https://example.com/article"
            disabled={manualCollecting}
            autoComplete="url"
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
          />
          <select
            id="manual-category"
            name="manual-category"
            value={manualCategory}
            onChange={(e) => setManualCategory(e.target.value as TargetCategory)}
            disabled={manualCollecting}
            className="px-3 py-2 bg-[#2a2a2a] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#2a2a2a] text-white">
                {opt.label}
              </option>
            ))}
          </select>
          {manualCollecting ? (
            <button
              onClick={cancelManualCollection}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors flex items-center gap-2"
            >
              <span>⏹️</span> 중지
            </button>
          ) : (
            <button
              onClick={() => collectSingleUrl(false)}
              disabled={!manualUrl.trim()}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              ✨ AI 수집
            </button>
          )}
        </div>

        {/* AI Thinking Style Progress Display */}
        {manualProgress && (
          <div className="space-y-3">
            {/* Progress Bar */}
            {manualProgress.progress !== undefined && manualProgress.stage !== "error" && (
              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 ease-out"
                  style={{ width: `${manualProgress.progress}%` }}
                />
              </div>
            )}

            {/* Steps Progress */}
            {manualProgress.steps &&
              manualProgress.stage !== "error" &&
              manualProgress.stage !== "complete" && (
                <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                  <div className="space-y-2">
                    {manualProgress.steps.map((step, idx) => {
                      const isActive = step.stage === manualProgress.stage;
                      const isPast = step.completed;
                      return (
                        <div
                          key={step.stage}
                          className={`flex items-center gap-3 text-xs transition-all duration-300 ${
                            isActive
                              ? "text-blue-400"
                              : isPast
                                ? "text-green-400/70"
                                : "text-white/30"
                          }`}
                        >
                          <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                            {isPast ? (
                              <span className="text-green-400">✓</span>
                            ) : isActive ? (
                              <span className="animate-spin text-blue-400">⚙️</span>
                            ) : (
                              <span className="text-white/20">{idx + 1}</span>
                            )}
                          </span>
                          <span className={isActive ? "font-medium" : ""}>
                            {step.message}
                            {isActive && <span className="animate-pulse ml-1">...</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Current Status Message */}
            <div
              className={`p-3 rounded-lg text-sm ${
                manualProgress.stage === "error"
                  ? "bg-red-500/20 text-red-400"
                  : manualProgress.stage === "complete"
                    ? "bg-green-500/20 text-green-400"
                    : manualProgress.stage === "cancelled"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-blue-500/20 text-blue-400"
              }`}
            >
              <div className="flex items-center gap-2">
                {manualProgress.stage === "error" ? (
                  <span>❌</span>
                ) : manualProgress.stage === "complete" ? (
                  <span>✅</span>
                ) : manualProgress.stage === "cancelled" ? (
                  <span>⚠️</span>
                ) : (
                  <span className="animate-pulse">🔄</span>
                )}
                <span className="flex-1">{manualProgress.message}</span>
                {manualProgress.progress !== undefined &&
                  manualProgress.stage !== "error" &&
                  manualProgress.stage !== "complete" && (
                    <span className="text-white/50">{manualProgress.progress}%</span>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Log Modal for Batch Collection */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-2xl p-6 border border-white/10 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xl font-bold text-white flex items-center gap-2">
                <span>📋</span> 수집 실행 로그
              </h4>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-white/40 hover:text-white transition-colors text-xl"
              >
                ✕
              </button>
            </div>

            {/* Current Run Status */}
            {(running || job?.is_running) && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 flex items-center gap-3">
                <span className="animate-spin">⚙️</span>
                <span className="text-blue-400 text-sm font-medium">수집 진행 중...</span>
              </div>
            )}

            {/* Log Entries */}
            <div className="flex-1 overflow-y-auto bg-black/30 rounded-xl p-4 font-mono text-xs space-y-1 min-h-[300px]">
              {liveProgress.length === 0 ? (
                <div className="text-white/40 text-center py-8">
                  {running
                    ? "로그 대기 중..."
                    : "실행 기록이 없습니다.\n\n'전체 수집 실행'을 클릭하면 로그가 표시됩니다."}
                </div>
              ) : (
                liveProgress.map((log, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 py-1 ${
                      log.level === "error"
                        ? "text-red-400"
                        : log.level === "warn"
                          ? "text-yellow-400"
                          : log.level === "success"
                            ? "text-green-400"
                            : "text-white/70"
                    }`}
                  >
                    <span className="text-white/30 flex-shrink-0 min-w-[70px]">
                      {new Date(log.timestamp).toLocaleTimeString("ko-KR")}
                    </span>
                    <span
                      className={`flex-shrink-0 min-w-[50px] uppercase text-[10px] px-1.5 py-0.5 rounded ${
                        log.level === "error"
                          ? "bg-red-500/20"
                          : log.level === "warn"
                            ? "bg-yellow-500/20"
                            : log.level === "success"
                              ? "bg-green-500/20"
                              : "bg-white/10"
                      }`}
                    >
                      {log.level || "info"}
                    </span>
                    <span className="break-words">{log.message}</span>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
              <span className="text-xs text-white/40">
                {liveProgress.length > 0 ? `${liveProgress.length}개 로그 항목` : ""}
              </span>
              <button
                onClick={() => setShowLogModal(false)}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Force Re-collection Confirmation Dialog */}
      {showForceDialog && forceDialogData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-md p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚠️</span>
              <h4 className="text-xl font-bold text-white">이미 수집된 URL</h4>
            </div>

            <div className="space-y-4">
              {/* Existing content info */}
              <div className="bg-white/5 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      forceDialogData.existingStatus === "published"
                        ? "bg-green-500/20 text-green-400"
                        : forceDialogData.existingStatus === "pending"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : forceDialogData.existingStatus === "needs_review"
                            ? "bg-orange-500/20 text-orange-400"
                            : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {forceDialogData.existingStatusLabel}
                  </span>
                </div>
                <p className="text-sm text-white font-medium line-clamp-2">
                  {forceDialogData.existingTitle || "제목 없음"}
                </p>
                <p className="text-xs text-white/40 truncate">{forceDialogData.url}</p>
              </div>

              {/* Warning message */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-sm text-red-400">
                  <strong>주의:</strong> 재수집 시 기존 콘텐츠가 삭제되고 새로 수집됩니다. 이 작업은
                  되돌릴 수 없습니다.
                </p>
              </div>

              {/* Confirmation question */}
              <p className="text-white text-center">정말 재수집하시겠습니까?</p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCancelForce}
                className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleForceRecollect}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                <span>🔄</span> 재수집
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
