"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  useSubmitLogs,
  useFailedAttempts,
  type SubmitLogItem,
  type DailyDetail,
  type FailedAttemptItem,
} from "@/hooks/use-admin-analytics";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ============================================
// Constants
// ============================================

const SOURCE_OPTIONS = [
  { label: "전체", value: "" },
  { label: "CLI", value: "cli" },
  { label: "Hook", value: "hook" },
  { label: "API", value: "api" },
];

const REASON_OPTIONS = [
  { label: "전체", value: "" },
  { label: "세션 없음", value: "no_sessions" },
  { label: "데이터 없음", value: "no_data" },
  { label: "스캔 실패", value: "scan_failed" },
  { label: "인증 실패", value: "auth_failed" },
  { label: "네트워크 오류", value: "network_error" },
  { label: "알 수 없음", value: "unknown" },
];

const DATE_RANGE_OPTIONS = [
  { label: "7일", days: 7 },
  { label: "14일", days: 14 },
  { label: "30일", days: 30 },
  { label: "90일", days: 90 },
];

// ============================================
// Utility Functions
// ============================================

function formatTokens(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================
// Badge Components
// ============================================

function SourceBadge({ source }: { source: string }) {
  const config = {
    cli: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "CLI" },
    hook: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Hook" },
    api: { bg: "bg-purple-500/20", text: "text-purple-400", label: "API" },
  }[source] || { bg: "bg-white/10", text: "text-white/50", label: source };

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function ReasonBadge({ reason }: { reason: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    no_sessions: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "세션 없음" },
    no_data: { bg: "bg-orange-500/20", text: "text-orange-400", label: "데이터 없음" },
    scan_failed: { bg: "bg-red-500/20", text: "text-red-400", label: "스캔 실패" },
    auth_failed: { bg: "bg-red-500/20", text: "text-red-400", label: "인증 실패" },
    network_error: { bg: "bg-purple-500/20", text: "text-purple-400", label: "네트워크" },
    unknown: { bg: "bg-white/10", text: "text-white/50", label: "알 수 없음" },
  };

  const style = config[reason] || { bg: "bg-white/10", text: "text-white/50", label: reason };

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function PlanBadge({
  plan,
  rateLimitTier,
}: {
  plan: string | null;
  rateLimitTier?: string | null;
}) {
  if (!plan) return null;

  const config: Record<string, { bg: string; text: string }> = {
    free: { bg: "bg-white/10", text: "text-white/50" },
    pro: { bg: "bg-blue-500/20", text: "text-blue-400" },
    max: { bg: "bg-purple-500/20", text: "text-purple-400" },
    team: { bg: "bg-orange-500/20", text: "text-orange-400" },
    enterprise: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
    api: { bg: "bg-pink-500/20", text: "text-pink-400" },
  };

  const style = config[plan.toLowerCase()] || { bg: "bg-white/10", text: "text-white/50" };
  const tooltipText = rateLimitTier ? `Rate Limit: ${rateLimitTier}` : plan;

  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-medium uppercase ${style.bg} ${style.text} cursor-help`}
      title={tooltipText}
    >
      {plan}
    </span>
  );
}

function LeagueReasonBadge({ reason, details }: { reason: string | null; details: string | null }) {
  if (!reason) return <span className="text-[10px] text-white/30">-</span>;

  const config: Record<string, { icon: string; label: string; color: string }> = {
    opus: { icon: "🚀", label: "Opus", color: "text-purple-400" },
    credential: { icon: "📋", label: "Cred", color: "text-blue-400" },
    user_choice: { icon: "👆", label: "Pick", color: "text-orange-400" },
  };

  const cfg = config[reason] || { icon: "?", label: reason, color: "text-white/50" };

  return (
    <span className={`text-[10px] ${cfg.color}`} title={details || reason}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span className="text-[10px] text-white/30">-</span>;

  const config: Record<string, { icon: string; color: string }> = {
    darwin: { icon: "🍎", color: "text-white/70" },
    win32: { icon: "🪟", color: "text-blue-400" },
    linux: { icon: "🐧", color: "text-yellow-400" },
  };

  const cfg = config[platform.toLowerCase()] || { icon: "💻", color: "text-white/50" };

  return (
    <span className={`text-[11px] ${cfg.color}`} title={platform}>
      {cfg.icon} {platform}
    </span>
  );
}

// ============================================
// Success Log Components
// ============================================

function DailyDetailRow({ detail }: { detail: DailyDetail }) {
  return (
    <tr className="bg-white/[0.01]">
      <td className="px-3 py-1.5 pl-10">
        <div className="text-[11px] text-white/40">└</div>
      </td>
      <td className="px-3 py-1.5" colSpan={2}></td>
      <td className="px-3 py-1.5">
        <div className="flex items-center">
          <span className="text-[11px] text-white/50 font-mono">{formatDate(detail.date)}</span>
          {detail.device_id && detail.device_id !== "legacy" && (
            <span
              className="ml-1 text-[9px] text-cyan-400/50"
              title={`Device: ${detail.device_id}`}
            >
              +PC
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-1.5 text-right">
        <div className="text-[11px] text-[var(--color-claude-coral)]/70 font-mono">
          {formatTokens(detail.total_tokens)}
        </div>
      </td>
      <td className="px-3 py-1.5 text-right">
        <div className="text-[11px] text-yellow-400/70 font-mono">
          {formatCost(detail.cost_usd)}
        </div>
      </td>
      <td className="px-3 py-1.5">
        <div className="text-[10px] text-white/30 truncate max-w-[80px]">
          {detail.primary_model
            ? detail.primary_model.replace(/^claude-/, "").replace(/-\d{8}$/, "")
            : "-"}
        </div>
      </td>
      <td className="px-3 py-1.5"></td>
    </tr>
  );
}

function SuccessLogRow({ log }: { log: SubmitLogItem }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = log.daily_details && log.daily_details.length > 1;

  const dateRange =
    log.date_from === log.date_to
      ? formatDate(log.date_from)
      : `${formatDate(log.date_from)}~${formatDate(log.date_to)}`;

  return (
    <>
      <tr
        className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${hasDetails ? "cursor-pointer" : ""}`}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            {hasDetails ? (
              isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-white/40" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-white/40" />
              )
            ) : (
              <div className="w-3.5" />
            )}
            <div className="text-[12px] text-white/80 font-mono">
              {formatDateTime(log.submitted_at)}
            </div>
          </div>
        </td>

        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            {log.avatar_url ? (
              <Image
                src={log.avatar_url}
                alt={log.username}
                width={28}
                height={28}
                className="rounded-full"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] text-white/50">
                {log.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="text-[13px] text-white font-medium">{log.username}</div>
            {log.device_count && log.device_count > 1 && (
              <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-400">
                {log.device_count}PC
              </span>
            )}
          </div>
        </td>

        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <PlanBadge plan={log.ccplan} rateLimitTier={log.rate_limit_tier} />
            <LeagueReasonBadge reason={log.league_reason} details={log.league_reason_details} />
          </div>
        </td>

        <td className="px-3 py-3">
          <div className="text-[12px] text-white/70">
            <span className="text-white/40">({log.days_count}일)</span> {dateRange}
          </div>
        </td>

        <td className="px-3 py-3 text-right">
          <div className="text-[13px] text-[var(--color-claude-coral)] font-mono font-semibold">
            {formatTokens(log.total_tokens)}
          </div>
        </td>

        <td className="px-3 py-3 text-right">
          <div className="text-[13px] text-yellow-400 font-mono font-semibold">
            {formatCost(log.total_cost)}
          </div>
        </td>

        <td className="px-3 py-3">
          <div
            className="text-[11px] text-white/50 truncate max-w-[100px]"
            title={log.primary_model || ""}
          >
            {log.primary_model
              ? log.primary_model.replace(/^claude-/, "").replace(/-\d{8}$/, "")
              : "-"}
          </div>
        </td>

        <td className="px-3 py-3 text-center">
          <SourceBadge source={log.submission_source} />
        </td>
      </tr>

      {isExpanded &&
        log.daily_details?.map((detail, idx) => (
          <DailyDetailRow key={`${log.submitted_at}_${detail.date}_${idx}`} detail={detail} />
        ))}
    </>
  );
}

// ============================================
// Failed Log Components
// ============================================

function FailedLogRow({ log }: { log: FailedAttemptItem }) {
  const [showDebug, setShowDebug] = useState(false);

  return (
    <>
      <tr
        className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${log.debug_info ? "cursor-pointer" : ""}`}
        onClick={() => log.debug_info && setShowDebug(!showDebug)}
      >
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            {log.debug_info ? (
              showDebug ? (
                <ChevronUp className="w-3.5 h-3.5 text-white/40" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-white/40" />
              )
            ) : (
              <div className="w-3.5" />
            )}
            <div className="text-[12px] text-white/80 font-mono">
              {formatDateTime(log.created_at)}
            </div>
          </div>
        </td>

        <td className="px-3 py-3">
          {log.username ? (
            <div className="flex items-center gap-2">
              {log.avatar_url ? (
                <Image
                  src={log.avatar_url}
                  alt={log.username}
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] text-white/50">
                  {log.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-[13px] text-white font-medium">{log.username}</div>
            </div>
          ) : (
            <div className="text-[12px] text-white/40 italic">익명</div>
          )}
        </td>

        <td className="px-3 py-3">
          <ReasonBadge reason={log.reason} />
        </td>

        <td className="px-3 py-3">
          <PlatformBadge platform={log.platform} />
        </td>

        <td className="px-3 py-3">
          <div className="text-[11px] text-white/50 font-mono">{log.cli_version || "-"}</div>
        </td>

        <td className="px-3 py-3">
          <div
            className="text-[11px] text-white/40 font-mono truncate max-w-[120px]"
            title={log.ip_address || ""}
          >
            {log.ip_address || "-"}
          </div>
        </td>
      </tr>

      {showDebug && log.debug_info && (
        <tr className="bg-white/[0.01]">
          <td colSpan={6} className="px-6 py-3">
            <div className="text-[11px] text-white/50 font-mono bg-black/30 rounded p-3 overflow-x-auto">
              <pre>{JSON.stringify(log.debug_info, null, 2)}</pre>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================
// Main Component
// ============================================

export default function SubmitLogsPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"success" | "failed">("success");

  // Success logs state
  const [successPage, setSuccessPage] = useState(1);
  const [successSearch, setSuccessSearch] = useState("");
  const [successSearchInput, setSuccessSearchInput] = useState("");
  const [successSource, setSuccessSource] = useState("");
  const [successDateRangeDays, setSuccessDateRangeDays] = useState(30);

  // Failed logs state
  const [failedPage, setFailedPage] = useState(1);
  const [failedSearch, setFailedSearch] = useState("");
  const [failedSearchInput, setFailedSearchInput] = useState("");
  const [failedReason, setFailedReason] = useState("");
  const [failedDateRangeDays, setFailedDateRangeDays] = useState(30);

  // Date range calculations
  const successDates = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - successDateRangeDays * 24 * 60 * 60 * 1000);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [successDateRangeDays]);

  const failedDates = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - failedDateRangeDays * 24 * 60 * 60 * 1000);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [failedDateRangeDays]);

  // Queries
  const successData = useSubmitLogs({
    page: successPage,
    pageSize: 50,
    search: successSearch,
    source: successSource,
    startDate: successDates.startDate,
    endDate: successDates.endDate,
    enabled: activeTab === "success",
  });

  const failedData = useFailedAttempts({
    page: failedPage,
    pageSize: 50,
    search: failedSearch,
    reason: failedReason,
    startDate: failedDates.startDate,
    endDate: failedDates.endDate,
    enabled: activeTab === "failed",
  });

  // Handlers
  const handleSuccessSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessSearch(successSearchInput);
    setSuccessPage(1);
  };

  const handleFailedSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFailedSearch(failedSearchInput);
    setFailedPage(1);
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Submit Logs</h1>
          <p className="text-[12px] text-white/50 mt-0.5">CLI 제출 로그 · 성공/실패 기록</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#161616] rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("success")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-colors ${
            activeTab === "success"
              ? "bg-emerald-500/20 text-emerald-400"
              : "text-white/50 hover:text-white/70 hover:bg-white/5"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          성공 로그
          {successData.data && (
            <span className="text-[11px] opacity-70">
              ({successData.data.pagination.totalCount})
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("failed")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-colors ${
            activeTab === "failed"
              ? "bg-red-500/20 text-red-400"
              : "text-white/50 hover:text-white/70 hover:bg-white/5"
          }`}
        >
          <XCircle className="w-4 h-4" />
          실패 로그
          {failedData.data && (
            <span className="text-[11px] opacity-70">({failedData.data.stats.total})</span>
          )}
        </button>
      </div>

      {/* Success Tab Content */}
      {activeTab === "success" && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={successDateRangeDays}
              onChange={(e) => {
                setSuccessDateRangeDays(Number(e.target.value));
                setSuccessPage(1);
              }}
              className="bg-[#161616] text-white/80 border border-white/[0.06] rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-white/20"
            >
              {DATE_RANGE_OPTIONS.map((opt) => (
                <option key={opt.days} value={opt.days}>
                  최근 {opt.label}
                </option>
              ))}
            </select>

            <select
              value={successSource}
              onChange={(e) => {
                setSuccessSource(e.target.value);
                setSuccessPage(1);
              }}
              className="bg-[#161616] text-white/80 border border-white/[0.06] rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-white/20"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <form onSubmit={handleSuccessSearch} className="relative">
              <input
                type="text"
                value={successSearchInput}
                onChange={(e) => setSuccessSearchInput(e.target.value)}
                placeholder="사용자 검색..."
                className="bg-[#161616] text-white/80 border border-white/[0.06] rounded pl-8 pr-3 py-1.5 text-[12px] focus:outline-none focus:border-white/20 w-40"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            </form>
          </div>

          {/* Loading */}
          {successData.isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error */}
          {successData.error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="text-[13px] text-red-400 font-medium mb-1">데이터 로드 실패</div>
              <p className="text-[12px] text-white/50">잠시 후 다시 시도해주세요.</p>
            </div>
          )}

          {/* Table */}
          {!successData.isLoading && successData.data && (
            <div className="bg-[#161616] rounded-lg border border-white/[0.06] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                        제출 시간
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                        사용자
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                        플랜/근거
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                        기간
                      </th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-medium text-white/40 uppercase">
                        토큰
                      </th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-medium text-white/40 uppercase">
                        비용
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                        모델
                      </th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-medium text-white/40 uppercase">
                        소스
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {successData.data.logs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[13px] text-white/30">
                          {successSearch
                            ? `"${successSearch}" 검색 결과가 없습니다`
                            : "제출 로그가 없습니다"}
                        </td>
                      </tr>
                    ) : (
                      successData.data.logs.map((log, index) => (
                        <SuccessLogRow
                          key={`${log.submitted_at}_${log.user_id}_${index}`}
                          log={log}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {successData.data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
                  <div className="text-[12px] text-white/40">
                    총 {successData.data.pagination.totalCount.toLocaleString()}건
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSuccessPage((p) => Math.max(1, p - 1))}
                      disabled={successPage === 1}
                      className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-white/70" />
                    </button>
                    <span className="text-[12px] text-white/70">
                      {successPage} / {successData.data.pagination.totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setSuccessPage((p) =>
                          Math.min(successData.data!.pagination.totalPages, p + 1)
                        )
                      }
                      disabled={successPage === successData.data.pagination.totalPages}
                      className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-white/70" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {!successData.isLoading && successData.data && successData.data.logs.length > 0 && (
            <div className="text-[11px] text-white/30 text-right">
              마지막 업데이트: {new Date(successData.data.generatedAt).toLocaleString("ko-KR")}
            </div>
          )}
        </>
      )}

      {/* Failed Tab Content */}
      {activeTab === "failed" && (
        <>
          {/* Stats Summary */}
          {failedData.data && failedData.data.stats.total > 0 && (
            <div className="flex gap-2 flex-wrap">
              {Object.entries(failedData.data.stats.byReason).map(([reason, count]) => (
                <div
                  key={reason}
                  className="bg-[#161616] border border-white/[0.06] rounded px-3 py-2 text-[12px]"
                >
                  <ReasonBadge reason={reason} />
                  <span className="ml-2 text-white/70 font-mono">{count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={failedDateRangeDays}
              onChange={(e) => {
                setFailedDateRangeDays(Number(e.target.value));
                setFailedPage(1);
              }}
              className="bg-[#161616] text-white/80 border border-white/[0.06] rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-white/20"
            >
              {DATE_RANGE_OPTIONS.map((opt) => (
                <option key={opt.days} value={opt.days}>
                  최근 {opt.label}
                </option>
              ))}
            </select>

            <select
              value={failedReason}
              onChange={(e) => {
                setFailedReason(e.target.value);
                setFailedPage(1);
              }}
              className="bg-[#161616] text-white/80 border border-white/[0.06] rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-white/20"
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <form onSubmit={handleFailedSearch} className="relative">
              <input
                type="text"
                value={failedSearchInput}
                onChange={(e) => setFailedSearchInput(e.target.value)}
                placeholder="사용자/IP 검색..."
                className="bg-[#161616] text-white/80 border border-white/[0.06] rounded pl-8 pr-3 py-1.5 text-[12px] focus:outline-none focus:border-white/20 w-40"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            </form>
          </div>

          {/* Loading */}
          {failedData.isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error */}
          {failedData.error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="text-[13px] text-red-400 font-medium mb-1">데이터 로드 실패</div>
              <p className="text-[12px] text-white/50">잠시 후 다시 시도해주세요.</p>
            </div>
          )}

          {/* Table */}
          {!failedData.isLoading && failedData.data && (
            <div className="bg-[#161616] rounded-lg border border-white/[0.06] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                        시간
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                        사용자
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                        실패 사유
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                        플랫폼
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                        CLI 버전
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                        IP
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedData.data.logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[13px] text-white/30">
                          {failedSearch
                            ? `"${failedSearch}" 검색 결과가 없습니다`
                            : "실패 로그가 없습니다"}
                        </td>
                      </tr>
                    ) : (
                      failedData.data.logs.map((log) => <FailedLogRow key={log.id} log={log} />)
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {failedData.data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
                  <div className="text-[12px] text-white/40">
                    총 {failedData.data.pagination.totalCount.toLocaleString()}건
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFailedPage((p) => Math.max(1, p - 1))}
                      disabled={failedPage === 1}
                      className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-white/70" />
                    </button>
                    <span className="text-[12px] text-white/70">
                      {failedPage} / {failedData.data.pagination.totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setFailedPage((p) =>
                          Math.min(failedData.data!.pagination.totalPages, p + 1)
                        )
                      }
                      disabled={failedPage === failedData.data.pagination.totalPages}
                      className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-white/70" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {!failedData.isLoading && failedData.data && failedData.data.logs.length > 0 && (
            <div className="text-[11px] text-white/30 text-right">
              마지막 업데이트: {new Date(failedData.data.generatedAt).toLocaleString("ko-KR")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
