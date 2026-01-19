"use client";

import { useState } from "react";
import Image from "next/image";
import { useSubmitLogs, type SubmitLogItem } from "@/hooks/useAdminAnalytics";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

const SOURCE_OPTIONS = [
  { label: "전체", value: "" },
  { label: "CLI", value: "cli" },
  { label: "Hook", value: "hook" },
  { label: "API", value: "api" },
];

const DATE_RANGE_OPTIONS = [
  { label: "7일", days: 7 },
  { label: "14일", days: 14 },
  { label: "30일", days: 30 },
  { label: "90일", days: 90 },
];

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

function PlanBadge({ plan }: { plan: string | null }) {
  if (!plan) return null;

  const config: Record<string, { bg: string; text: string }> = {
    free: { bg: "bg-white/10", text: "text-white/50" },
    pro: { bg: "bg-blue-500/20", text: "text-blue-400" },
    max: { bg: "bg-purple-500/20", text: "text-purple-400" },
    team: { bg: "bg-orange-500/20", text: "text-orange-400" },
    enterprise: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  };

  const style = config[plan.toLowerCase()] || { bg: "bg-white/10", text: "text-white/50" };

  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-medium uppercase ${style.bg} ${style.text}`}
    >
      {plan}
    </span>
  );
}

function LogRow({ log }: { log: SubmitLogItem }) {
  const dateRange =
    log.date_from === log.date_to
      ? formatDate(log.date_from)
      : `${formatDate(log.date_from)}~${formatDate(log.date_to)}`;

  return (
    <tr className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
      {/* 제출 시간 */}
      <td className="px-3 py-3">
        <div className="text-[12px] text-white/80 font-mono">
          {formatDateTime(log.submitted_at)}
        </div>
      </td>

      {/* 사용자 */}
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
          <div>
            <div className="text-[13px] text-white font-medium">{log.username}</div>
            <div className="flex items-center gap-1.5">
              <PlanBadge plan={log.ccplan} />
            </div>
          </div>
        </div>
      </td>

      {/* 기간 */}
      <td className="px-3 py-3">
        <div className="text-[12px] text-white/70">{dateRange}</div>
        <div className="text-[10px] text-white/40">{log.days_count}일</div>
      </td>

      {/* 토큰 */}
      <td className="px-3 py-3 text-right">
        <div className="text-[13px] text-white font-mono">{formatTokens(log.total_tokens)}</div>
      </td>

      {/* 비용 */}
      <td className="px-3 py-3 text-right">
        <div className="text-[13px] text-emerald-400 font-mono">{formatCost(log.total_cost)}</div>
      </td>

      {/* 모델 */}
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

      {/* 소스 */}
      <td className="px-3 py-3 text-center">
        <SourceBadge source={log.submission_source} />
      </td>
    </tr>
  );
}

export default function SubmitLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [source, setSource] = useState("");
  const [dateRangeDays, setDateRangeDays] = useState(30);

  // 날짜 범위 계산
  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - dateRangeDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, isLoading, error } = useSubmitLogs({
    page,
    pageSize: 50,
    search,
    source,
    startDate,
    endDate,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleSourceChange = (newSource: string) => {
    setSource(newSource);
    setPage(1);
  };

  const handleDateRangeChange = (days: number) => {
    setDateRangeDays(days);
    setPage(1);
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Submit Logs</h1>
          <p className="text-[12px] text-white/50 mt-0.5">CLI 제출 로그 · 제출 1회당 1건 표시</p>
        </div>

        <div className="flex items-center gap-2">
          {/* 기간 선택 */}
          <select
            value={dateRangeDays}
            onChange={(e) => handleDateRangeChange(Number(e.target.value))}
            className="bg-[#161616] text-white/80 border border-white/[0.06] rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-white/20"
          >
            {DATE_RANGE_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>
                최근 {opt.label}
              </option>
            ))}
          </select>

          {/* 소스 필터 */}
          <select
            value={source}
            onChange={(e) => handleSourceChange(e.target.value)}
            className="bg-[#161616] text-white/80 border border-white/[0.06] rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-white/20"
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 검색 */}
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="사용자 검색..."
              className="bg-[#161616] text-white/80 border border-white/[0.06] rounded pl-8 pr-3 py-1.5 text-[12px] focus:outline-none focus:border-white/20 w-40"
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          </form>
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
          <div className="text-[13px] text-red-400 font-medium mb-1">데이터 로드 실패</div>
          <p className="text-[12px] text-white/50">잠시 후 다시 시도해주세요.</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && data && (
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
                {data.logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[13px] text-white/30">
                      {search ? `"${search}" 검색 결과가 없습니다` : "제출 로그가 없습니다"}
                    </td>
                  </tr>
                ) : (
                  data.logs.map((log, index) => (
                    <LogRow key={`${log.submitted_at}_${log.user_id}_${index}`} log={log} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
              <div className="text-[12px] text-white/40">
                총 {data.pagination.totalCount.toLocaleString()}건
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-white/70" />
                </button>
                <span className="text-[12px] text-white/70">
                  {page} / {data.pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page === data.pagination.totalPages}
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
      {!isLoading && data && data.logs.length > 0 && (
        <div className="text-[11px] text-white/30 text-right">
          마지막 업데이트: {new Date(data.generatedAt).toLocaleString("ko-KR")}
        </div>
      )}
    </div>
  );
}
