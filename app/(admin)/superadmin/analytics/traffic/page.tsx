"use client";

import { useState, Fragment } from "react";
import { useTrafficSources } from "@/hooks/use-admin-analytics";

const DATE_RANGES = [
  { label: "오늘", value: "-1d" },
  { label: "7일", value: "-7d" },
  { label: "14일", value: "-14d" },
  { label: "30일", value: "-30d" },
  { label: "90일", value: "-90d" },
];

type SourceType = "direct" | "search" | "social" | "referral";

const SOURCE_LABELS: Record<SourceType, { label: string; description: string }> = {
  direct: {
    label: "직접 방문",
    description: "URL 직접 입력 또는 북마크를 통한 방문",
  },
  search: {
    label: "검색 유입",
    description: "Google, Bing, Naver 등 검색 엔진을 통한 방문",
  },
  social: {
    label: "소셜 미디어",
    description: "Twitter, Reddit, LinkedIn 등 SNS를 통한 방문",
  },
  referral: {
    label: "외부 링크",
    description: "블로그, 뉴스, 다른 웹사이트의 백링크를 통한 방문",
  },
};

const SOURCE_COLORS: Record<SourceType, { bg: string; text: string; bar: string }> = {
  direct: { bg: "bg-blue-500/10", text: "text-blue-400", bar: "bg-blue-500" },
  search: { bg: "bg-emerald-500/10", text: "text-emerald-400", bar: "bg-emerald-500" },
  social: { bg: "bg-purple-500/10", text: "text-purple-400", bar: "bg-purple-500" },
  referral: { bg: "bg-orange-500/10", text: "text-orange-400", bar: "bg-orange-500" },
};

function SourceCard({
  type,
  count,
  percent,
  icon,
}: {
  type: SourceType;
  count: number;
  percent: number;
  icon: string;
}) {
  const colors = SOURCE_COLORS[type];
  const labels = SOURCE_LABELS[type];

  return (
    <div className={`${colors.bg} rounded-lg px-3 py-2 border border-white/[0.06]`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm shrink-0">{icon}</span>
          <span className={`text-[11px] font-medium ${colors.text} truncate`}>{labels.label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-base font-bold text-white">{count.toLocaleString()}</span>
          <span className="text-[10px] text-white/40 font-mono">{percent}%</span>
        </div>
      </div>
      <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors.bar} transition-all duration-500`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function TrendChart({
  data,
}: {
  data: Array<{
    date: string;
    direct: number;
    search: number;
    social: number;
    referral: number;
  }>;
}) {
  if (!data?.length) {
    return (
      <div className="text-center py-8 text-[12px] text-white/30">트렌드 데이터가 없습니다</div>
    );
  }

  // 일별 총합 계산 및 최대값
  const dailyTotals = data.map((d) => d.direct + d.search + d.social + d.referral);
  const maxTotal = Math.max(...dailyTotals, 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-white/50">직접</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-white/50">검색</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-white/50">소셜</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-white/50">외부링크</span>
        </div>
      </div>

      <div className="flex items-end gap-1 h-32">
        {data.map((item, index) => {
          const total = item.direct + item.search + item.social + item.referral;
          const scale = total / maxTotal;
          const date = new Date(item.date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          return (
            <div
              key={item.date}
              className="flex-1 flex flex-col items-center gap-1"
              title={`${item.date}: ${total}명`}
            >
              <div
                className="w-full rounded-t flex flex-col-reverse overflow-hidden transition-all duration-300"
                style={{ height: `${Math.max(scale * 100, 4)}%` }}
              >
                {item.direct > 0 && (
                  <div className="bg-blue-500 min-h-[1px]" style={{ flexGrow: item.direct }} />
                )}
                {item.search > 0 && (
                  <div className="bg-emerald-500 min-h-[1px]" style={{ flexGrow: item.search }} />
                )}
                {item.social > 0 && (
                  <div className="bg-purple-500 min-h-[1px]" style={{ flexGrow: item.social }} />
                )}
                {item.referral > 0 && (
                  <div className="bg-orange-500 min-h-[1px]" style={{ flexGrow: item.referral }} />
                )}
              </div>
              {index % 2 === 0 && (
                <span className={`text-[9px] ${isWeekend ? "text-white/20" : "text-white/40"}`}>
                  {date.getMonth() + 1}/{date.getDate()}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DomainDetail {
  url: string;
  count: number;
  percent: number;
}

interface DomainData {
  domain: string;
  count: number;
  percent: number;
  type: SourceType;
  icon: string;
  details?: DomainDetail[];
}

type SortType = "count" | "percent" | "domain";

function TopDomainsTable({ domains }: { domains: DomainData[] }) {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortType>("count");
  const [sortDesc, setSortDesc] = useState(true);

  const toggleExpand = (domain: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  const handleSort = (type: SortType) => {
    if (sortBy === type) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(type);
      setSortDesc(true);
    }
  };

  // Dynamic scaling: calculate max percent among displayed domains for relative bar widths
  const maxPercent = Math.max(...domains.map((d: DomainData) => d.percent), 1);

  const sortedDomains = [...domains].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "count":
        cmp = a.count - b.count;
        break;
      case "percent":
        cmp = a.percent - b.percent;
        break;
      case "domain":
        cmp = a.domain.localeCompare(b.domain);
        break;
    }
    return sortDesc ? -cmp : cmp;
  });

  if (!domains?.length) {
    return (
      <div className="text-center py-8 text-[12px] text-white/30">도메인 데이터가 없습니다</div>
    );
  }

  const SortIcon = ({ active, desc }: { active: boolean; desc: boolean }) => (
    <span className={`ml-1 text-[8px] ${active ? "text-white/60" : "text-white/20"}`}>
      {active ? (desc ? "▼" : "▲") : "▼"}
    </span>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th
              className="px-3 py-2 text-left text-[10px] font-medium text-white/40 uppercase cursor-pointer hover:text-white/60 transition-colors"
              onClick={() => handleSort("domain")}
            >
              도메인
              <SortIcon active={sortBy === "domain"} desc={sortDesc} />
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-white/40 uppercase">
              유형
            </th>
            <th
              className="px-3 py-2 text-right text-[10px] font-medium text-white/40 uppercase cursor-pointer hover:text-white/60 transition-colors"
              onClick={() => handleSort("count")}
            >
              방문자
              <SortIcon active={sortBy === "count"} desc={sortDesc} />
            </th>
            <th
              className="px-3 py-2 text-right text-[10px] font-medium text-white/40 uppercase cursor-pointer hover:text-white/60 transition-colors"
              onClick={() => handleSort("percent")}
            >
              비율
              <SortIcon active={sortBy === "percent"} desc={sortDesc} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedDomains.map((domain, index) => {
            const colors = SOURCE_COLORS[domain.type];
            const labels = SOURCE_LABELS[domain.type];
            const isExpanded = expandedDomains.has(domain.domain);
            const hasDetails = domain.details && domain.details.length > 0;

            return (
              <Fragment key={domain.domain}>
                <tr
                  className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${
                    index === 0 ? "bg-white/[0.02]" : ""
                  } ${hasDetails ? "cursor-pointer" : ""}`}
                  onClick={() => hasDetails && toggleExpand(domain.domain)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {hasDetails && (
                        <span
                          className={`text-[10px] text-white/40 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        >
                          ▶
                        </span>
                      )}
                      <span className="text-sm">{domain.icon}</span>
                      <span className="text-[12px] text-white font-medium truncate max-w-[180px]">
                        {domain.domain}
                      </span>
                      {index === 0 && (
                        <span className="text-[9px] bg-[var(--color-claude-coral)]/20 text-[var(--color-claude-coral)] px-1.5 py-0.5 rounded">
                          TOP
                        </span>
                      )}
                      {hasDetails && (
                        <span className="text-[9px] text-white/30">({domain.details!.length})</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}
                    >
                      {labels.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-[12px] text-white font-mono">
                    {domain.count.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colors.bar}`}
                          style={{
                            width: `${Math.min((domain.percent / maxPercent) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-white/50 font-mono w-10 text-right">
                        {domain.percent}%
                      </span>
                    </div>
                  </td>
                </tr>
                {/* Expanded details */}
                {isExpanded && hasDetails && (
                  <tr>
                    <td colSpan={4} className="px-0 py-0">
                      <div className="bg-white/[0.02] border-b border-white/[0.03]">
                        {domain.details!.map((detail) => (
                          <div
                            key={detail.url}
                            className="flex items-center justify-between px-6 py-1.5 border-b border-white/[0.02] last:border-b-0 hover:bg-white/[0.02]"
                          >
                            <span className="text-[11px] text-white/60 truncate max-w-[350px] font-mono">
                              {detail.url}
                            </span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[11px] text-white/50 font-mono">
                                {detail.count.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-white/30 font-mono w-10 text-right">
                                {detail.percent}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TrafficInsights({
  summary,
  topDomains,
}: {
  summary: {
    direct: { count: number; percent: number };
    search: { count: number; percent: number };
    social: { count: number; percent: number };
    referral: { count: number; percent: number };
  };
  topDomains: Array<{ domain: string; count: number; type: SourceType }>;
}) {
  // 가장 높은 유입 소스 찾기
  const sources = [
    { type: "direct" as SourceType, ...summary.direct },
    { type: "search" as SourceType, ...summary.search },
    { type: "social" as SourceType, ...summary.social },
    { type: "referral" as SourceType, ...summary.referral },
  ];
  const topSource = sources.reduce((a, b) => (a.percent > b.percent ? a : b));

  // 검색 유입 비율 평가
  const searchPercent = summary.search.percent;
  const isSearchGood = searchPercent >= 30;

  // 상위 외부 도메인
  const topReferral = topDomains.find((d) => d.type === "referral");

  return (
    <div className="bg-[#0d0d0d] rounded-lg p-4 space-y-3">
      <div className="text-[11px] text-white/40 uppercase tracking-wide">💡 인사이트</div>

      <div className="flex items-start gap-2">
        <span className="text-blue-400 mt-0.5">📊</span>
        <div>
          <p className="text-[12px] text-white/70">
            <span className="text-white font-medium">{SOURCE_LABELS[topSource.type].label}</span>이
            주요 유입 경로입니다.
          </p>
          <p className="text-[11px] text-white/40 mt-0.5">
            전체 트래픽의 {topSource.percent}%를 차지합니다.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <span className={isSearchGood ? "text-emerald-400" : "text-yellow-400"}>
          {isSearchGood ? "✅" : "🔍"}
        </span>
        <div>
          <p className="text-[12px] text-white/70">검색 유입이 {searchPercent}%입니다.</p>
          <p className="text-[11px] text-white/40 mt-0.5">
            {isSearchGood
              ? "SEO가 잘 작동하고 있습니다."
              : "SEO 개선으로 검색 유입을 늘릴 수 있습니다."}
          </p>
        </div>
      </div>

      {topReferral && (
        <div className="flex items-start gap-2">
          <span className="text-orange-400 mt-0.5">🔗</span>
          <div>
            <p className="text-[12px] text-white/70">
              <span className="text-white font-medium">{topReferral.domain}</span>에서 가장 많은
              외부 유입이 발생합니다.
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">해당 채널에서의 활동을 강화해보세요.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrafficSourcesPage() {
  const [dateRange, setDateRange] = useState("-7d");
  const { data, isLoading, error } = useTrafficSources({ dateFrom: dateRange });

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">유입 경로</h1>
          <p className="text-[12px] text-white/50 mt-0.5">
            방문자가 어디서 왔는지 분석합니다 (PostHog 기반)
          </p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="bg-[#161616] text-white/80 border border-white/[0.06] rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-white/20"
        >
          {DATE_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              최근 {r.label}
            </option>
          ))}
        </select>
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
          <div className="text-[13px] text-red-400 font-medium mb-1">⚠️ 데이터 로드 실패</div>
          <p className="text-[12px] text-white/50">
            {error instanceof Error ? error.message : "PostHog 연결을 확인해주세요."}
          </p>
          <p className="text-[11px] text-white/30 mt-2">
            확인: POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID 환경 변수 설정
          </p>
        </div>
      )}

      {/* PostHog 미설정 경고 */}
      {data?.error && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="text-[13px] text-yellow-400 font-medium mb-1">⚠️ PostHog 미설정</div>
          <p className="text-[12px] text-white/50">{data.error}</p>
        </div>
      )}

      {/* Content */}
      {!isLoading && data && !data.error && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SourceCard
              type="direct"
              count={data.summary.direct.count}
              percent={data.summary.direct.percent}
              icon={data.summary.direct.icon}
            />
            <SourceCard
              type="search"
              count={data.summary.search.count}
              percent={data.summary.search.percent}
              icon={data.summary.search.icon}
            />
            <SourceCard
              type="social"
              count={data.summary.social.count}
              percent={data.summary.social.percent}
              icon={data.summary.social.icon}
            />
            <SourceCard
              type="referral"
              count={data.summary.referral.count}
              percent={data.summary.referral.percent}
              icon={data.summary.referral.icon}
            />
          </div>

          {/* Trend + Insights Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Trend Chart */}
            <div className="lg:col-span-2 bg-[#161616] rounded-lg p-5 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[12px] text-white/50">일별 유입 트렌드</span>
                <span className="text-[11px] text-white/30">
                  총 {data.totalVisitors.toLocaleString()}명
                </span>
              </div>
              <TrendChart data={data.trend} />
            </div>

            {/* Insights */}
            <TrafficInsights summary={data.summary} topDomains={data.topDomains} />
          </div>

          {/* Top Domains Table - Expanded */}
          <div className="bg-[#161616] rounded-lg p-5 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-white/60 font-medium">상위 유입 도메인</span>
                <span className="text-[10px] text-white/30 px-1.5 py-0.5 bg-white/5 rounded">
                  {data.topDomains.length}개
                </span>
              </div>
              <span className="text-[10px] text-white/30">최대 100개</span>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              <TopDomainsTable domains={data.topDomains} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
