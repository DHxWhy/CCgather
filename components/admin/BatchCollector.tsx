"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, CheckCircle, XCircle, SkipForward, Play, Square, Trash2 } from "lucide-react";

interface LogEntry {
  type: "progress" | "success" | "error" | "skip" | "complete";
  index: number;
  total: number;
  url?: string;
  title?: string;
  message?: string;
  stats?: { success: number; failed: number; skipped: number };
}

// Category options - must match DB check constraint
// Valid values: 'version_update', 'official', 'press', 'community', 'youtube'
const CATEGORY_OPTIONS = [
  { value: "official", label: "🏢 Official" },
  { value: "press", label: "📰 Press" },
  { value: "community", label: "👥 Community" },
  { value: "version_update", label: "🔄 Version Update" },
  { value: "youtube", label: "📺 YouTube" },
];

export default function BatchCollector({ onComplete }: { onComplete?: () => void }) {
  const [urlInput, setUrlInput] = useState("");
  const [category, setCategory] = useState("official");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState({ success: 0, failed: 0, skipped: 0 });
  const [delaySeconds, setDelaySeconds] = useState(60);
  const [autoPublish, setAutoPublish] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Parse URLs from input
  const parsedUrls = urlInput
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.startsWith("http"));

  const totalArticles = parsedUrls.length;

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const startBatchCollection = async () => {
    if (totalArticles === 0) return;

    setIsRunning(true);
    setLogs([]);
    setCurrentIndex(0);
    setStats({ success: 0, failed: 0, skipped: 0 });

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/admin/batch-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: parsedUrls.map((url) => ({ url, category })),
          delayMs: delaySeconds * 1000,
          autoPublish,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to start batch collection");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6)) as LogEntry;
              setLogs((prev) => [...prev, event]);
              setCurrentIndex(event.index);

              if (event.type === "complete" && event.stats) {
                setStats(event.stats);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setLogs((prev) => [
          ...prev,
          {
            type: "error",
            index: currentIndex,
            total: totalArticles,
            message: "수집이 중단되었습니다",
          },
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          {
            type: "error",
            index: currentIndex,
            total: totalArticles,
            message: `오류: ${(error as Error).message}`,
          },
        ]);
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
      onComplete?.();
    }
  };

  const stopBatchCollection = () => {
    abortControllerRef.current?.abort();
  };

  const clearUrls = () => {
    setUrlInput("");
    setLogs([]);
    setStats({ success: 0, failed: 0, skipped: 0 });
  };

  const estimatedMinutes = Math.ceil((totalArticles * delaySeconds) / 60);
  const estimatedTimeText =
    estimatedMinutes >= 60
      ? `${Math.floor(estimatedMinutes / 60)}시간 ${estimatedMinutes % 60}분`
      : `${estimatedMinutes}분`;

  return (
    <div className="bg-[#161616] rounded-lg border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[14px] font-semibold text-white">📚 배치 수집</h3>
          {totalArticles > 0 && (
            <span className="text-[11px] text-white/40">{totalArticles}개 URL</span>
          )}
        </div>
        <p className="text-[11px] text-white/50">
          URL을 줄바꿈으로 구분하여 입력하세요. 순차적으로 수집됩니다.
        </p>
      </div>

      {/* URL Input */}
      <div className="p-4 border-b border-white/[0.06] space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-white/50">수집할 URL 목록</label>
            {urlInput.length > 0 && (
              <button
                onClick={clearUrls}
                disabled={isRunning}
                className="flex items-center gap-1 text-[10px] text-white/40 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                초기화
              </button>
            )}
          </div>
          <textarea
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={isRunning}
            placeholder={`https://example.com/article-1\nhttps://example.com/article-2\nhttps://example.com/article-3`}
            className="w-full h-32 px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-[12px] text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--color-claude-coral)]/50 resize-none font-mono disabled:opacity-50"
          />
          <div className="flex items-center justify-between text-[10px] text-white/30">
            <span>한 줄에 하나의 URL</span>
            <span>{parsedUrls.length}개 유효한 URL</span>
          </div>
        </div>

        {/* Category Selection */}
        <div className="space-y-2">
          <label className="text-[11px] text-white/50">카테고리</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setCategory(opt.value)}
                disabled={isRunning}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  category === opt.value
                    ? "bg-[var(--color-claude-coral)] text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                } disabled:opacity-50`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 border-b border-white/[0.06] space-y-3">
        {/* Delay Setting */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-white/50">요청 간격</label>
            <span className="text-[12px] text-white/70 font-medium">
              {delaySeconds >= 60
                ? `${Math.floor(delaySeconds / 60)}분 ${delaySeconds % 60}초`
                : `${delaySeconds}초`}
            </span>
          </div>
          <input
            type="range"
            min={15}
            max={180}
            step={15}
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(Number(e.target.value))}
            disabled={isRunning}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-claude-coral)]"
          />
          <div className="flex justify-between text-[9px] text-white/30">
            <span>15초 (빠름)</span>
            <span>1분</span>
            <span>2분</span>
            <span>3분 (안전)</span>
          </div>
        </div>

        {/* Auto Publish Option */}
        <div className="flex items-center justify-between py-2 px-3 bg-white/[0.03] rounded-lg">
          <div>
            <div className="text-[11px] text-white/70 font-medium">자동 게시</div>
            <div className="text-[10px] text-white/40">
              {autoPublish ? "수집 즉시 게시됩니다" : "수집 후 검토 대기 상태로 저장됩니다"}
            </div>
          </div>
          <button
            onClick={() => setAutoPublish(!autoPublish)}
            disabled={isRunning}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              autoPublish ? "bg-emerald-500" : "bg-white/20"
            } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                autoPublish ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Estimated Time */}
        {totalArticles > 0 && (
          <div className="text-[11px] text-white/40 text-center">
            예상 소요 시간: ~{estimatedTimeText}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={totalArticles === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-claude-coral)] text-white rounded text-[12px] font-medium hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              수집 시작
            </button>
          ) : (
            <button
              onClick={stopBatchCollection}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded text-[12px] font-medium hover:opacity-90 transition-colors"
            >
              <Square className="w-4 h-4" />
              중단
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-white/50">
              <span>진행률</span>
              <span>
                {currentIndex + 1} / {totalArticles}
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-claude-coral)] transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / totalArticles) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      {(isRunning || logs.length > 0) && (
        <div className="px-4 py-2 border-b border-white/[0.06] flex gap-4">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-emerald-400">{stats.success} 성공</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[11px] text-red-400">{stats.failed} 실패</span>
          </div>
          <div className="flex items-center gap-1.5">
            <SkipForward className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[11px] text-yellow-400">{stats.skipped} 건너뜀</span>
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 bg-black/20">
          {logs.map((log, i) => (
            <LogItem key={i} log={log} />
          ))}
          <div ref={logsEndRef} />
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-lg w-full max-w-md border border-white/10 shadow-xl">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="text-[14px] font-semibold text-white">배치 수집 확인</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-[12px] text-white/70 space-y-2">
                <p>다음 설정으로 배치 수집을 시작합니다:</p>
                <ul className="space-y-1.5 pl-4">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[var(--color-claude-coral)] rounded-full" />
                    <span>
                      총 <strong className="text-white">{totalArticles}개</strong> URL
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[var(--color-claude-coral)] rounded-full" />
                    <span>
                      카테고리:{" "}
                      <strong className="text-white">
                        {CATEGORY_OPTIONS.find((o) => o.value === category)?.label}
                      </strong>
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[var(--color-claude-coral)] rounded-full" />
                    <span>
                      요청 간격:{" "}
                      <strong className="text-white">
                        {delaySeconds >= 60
                          ? `${Math.floor(delaySeconds / 60)}분 ${delaySeconds % 60 > 0 ? `${delaySeconds % 60}초` : ""}`
                          : `${delaySeconds}초`}
                      </strong>
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[var(--color-claude-coral)] rounded-full" />
                    <span>
                      예상 소요 시간: <strong className="text-white">~{estimatedTimeText}</strong>
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 ${autoPublish ? "bg-emerald-500" : "bg-yellow-500"} rounded-full`}
                    />
                    <span>
                      게시 상태:{" "}
                      <strong className={autoPublish ? "text-emerald-400" : "text-yellow-400"}>
                        {autoPublish ? "자동 게시" : "검토 대기"}
                      </strong>
                    </span>
                  </li>
                </ul>
              </div>
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-[11px] text-yellow-400">
                ⚠️ 수집이 시작되면 창을 닫지 마세요. 중간에 중단할 수 있습니다.
              </div>
            </div>
            <div className="p-4 border-t border-white/[0.06] flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 bg-white/5 text-white/70 rounded text-[12px] hover:bg-white/10 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  startBatchCollection();
                }}
                className="flex-1 px-4 py-2 bg-[var(--color-claude-coral)] text-white rounded text-[12px] font-medium hover:opacity-90 transition-colors"
              >
                수집 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LogItem({ log }: { log: LogEntry }) {
  const icons = {
    progress: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
    success: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
    error: <XCircle className="w-3.5 h-3.5 text-red-400" />,
    skip: <SkipForward className="w-3.5 h-3.5 text-yellow-400" />,
    complete: <CheckCircle className="w-3.5 h-3.5 text-purple-400" />,
  };

  const colors = {
    progress: "text-white/70",
    success: "text-emerald-400",
    error: "text-red-400",
    skip: "text-yellow-400",
    complete: "text-purple-400",
  };

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded bg-white/[0.02] hover:bg-white/[0.04]">
      <div className="flex-shrink-0 mt-0.5">{icons[log.type]}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] ${colors[log.type]} break-words`}>{log.message}</p>
        {log.url && (
          <p className="text-[10px] text-white/30 truncate" title={log.url}>
            {log.url}
          </p>
        )}
      </div>
      <span className="text-[10px] text-white/30 flex-shrink-0">
        {log.index + 1}/{log.total}
      </span>
    </div>
  );
}
