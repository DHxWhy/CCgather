"use client";

import { useState, Fragment, useMemo } from "react";
import {
  AlertTriangle,
  ArrowDownAZ,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Compass,
  ExternalLink,
  Globe2,
  Hash,
  Lightbulb,
  Link2,
  Network,
  Percent,
  Search as SearchIcon,
  Share2,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTrafficSources } from "@/hooks/use-admin-analytics";

// =====================================================
// macOS Big Sur+ Easing — funnels / submit-logs / ai-usage 와 동일
// =====================================================
const MAC_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// =====================================================
// Period — funnels 와 동일 NSSegmentedControl 패턴
// API 값 "-1d/-7d/-14d/-30d/-90d" 100% 유지
// 90일 초과("-180d"/"all")는 서버가 analytics_daily 스냅샷으로 분기
// =====================================================
const PERIOD_OPTIONS = [
  { label: "오늘", value: "-1d" },
  { label: "7일", value: "-7d" },
  { label: "14일", value: "-14d" },
  { label: "30일", value: "-30d" },
  { label: "90일", value: "-90d" },
  { label: "180일", value: "-180d" },
  { label: "전체", value: "all" },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

// =====================================================
// Source Types & Labels — API 응답 100% 유지
// =====================================================
type SourceType = "direct" | "search" | "social" | "referral";

const SOURCE_LABELS: Record<SourceType, { label: string; caption: string }> = {
  direct: { label: "직접 방문", caption: "Direct" },
  search: { label: "검색 유입", caption: "Search" },
  social: { label: "소셜 미디어", caption: "Social" },
  referral: { label: "외부 링크", caption: "Referral" },
};

const SOURCE_ICONS: Record<SourceType, LucideIcon> = {
  direct: Compass,
  search: SearchIcon,
  social: Share2,
  referral: Link2,
};

// =====================================================
// Coral 단일 + intensity 위계 (funnels FunnelBar 패턴)
// 시멘틱 dot 으로 4유형 구분 (semantic, 시각 노이즈 X)
// =====================================================
const SOURCE_INTENSITY: Record<SourceType, number> = {
  direct: 1.0, // 가장 진함 (자체 브랜드 도달)
  search: 0.78, // SEO 강도
  social: 0.55, // 바이럴 강도
  referral: 0.35, // 외부 유입
};

const SOURCE_DOT: Record<SourceType, string> = {
  direct: "bg-[var(--color-claude-coral)]",
  search: "bg-emerald-300",
  social: "bg-sky-300",
  referral: "bg-amber-300",
};

// =====================================================
// GlassCard — frosted glass container (funnels 와 동일)
// =====================================================
function GlassCard({
  children,
  title,
  caption,
  icon: Icon,
  trailing,
  padded = true,
  className = "",
}: {
  children: React.ReactNode;
  title?: string;
  caption?: string;
  icon?: LucideIcon;
  trailing?: React.ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[9px] ring-1 ring-white/[0.08] ${padded ? "p-4" : ""} ${className}`}
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.18)",
      }}
    >
      {(title || trailing) && (
        <div
          className={`flex items-center justify-between gap-2 ${padded ? "mb-3" : "px-4 pt-3 pb-2.5"}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {Icon && (
              <Icon
                className="h-3 w-3 text-white/40 shrink-0"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            )}
            {title && (
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">
                {title}
              </h3>
            )}
            {caption && (
              <span className="text-[10.5px] text-white/30 tracking-[-0.005em]">{caption}</span>
            )}
          </div>
          {trailing}
        </div>
      )}
      {children}
    </div>
  );
}

// =====================================================
// PeriodSegmented — funnels 와 100% 동일 NSSegmentedControl
// =====================================================
function PeriodSegmented({
  value,
  onChange,
}: {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="기간 선택"
      className="inline-flex items-center rounded-[7px] p-0.5 ring-1 ring-white/[0.08]"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {PERIOD_OPTIONS.map((p) => {
        const active = value === p.value;
        return (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(p.value)}
            className={`relative inline-flex h-7 items-center px-2.5 text-[11.5px] font-medium tracking-[-0.005em] rounded-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98] ${
              active
                ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-white/55 hover:text-white/85"
            }`}
            style={{
              transition: `all 180ms ${MAC_EASE}`,
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// =====================================================
// SourceCard — funnels MetricCard 와 시각 일관
// coral 단일 + 시멘틱 dot 으로 유형 구분
// =====================================================
function SourceCard({
  type,
  count,
  percent,
}: {
  type: SourceType;
  count: number;
  percent: number;
}) {
  const labels = SOURCE_LABELS[type];
  const Icon = SOURCE_ICONS[type];
  const intensity = SOURCE_INTENSITY[type];
  const dot = SOURCE_DOT[type];

  // coral 단일 액센트 — intensity 로 단계 표현 (funnels FunnelBar 와 동일)
  const fillBg = `linear-gradient(90deg, rgba(218,119,86,${0.95 * intensity}) 0%, rgba(218,119,86,${0.7 * intensity}) 100%)`;

  return (
    <div
      className="relative overflow-hidden rounded-[9px] p-4 ring-1 ring-white/[0.08]"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.18)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/45">
              {labels.label}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-white/35 tracking-[-0.005em]">
            {labels.caption}
          </div>
          <div
            className="mt-2.5 text-[28px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-white"
            style={{ fontFeatureSettings: '"ss01", "tnum", "cv11"' }}
          >
            {count.toLocaleString("en-US")}
          </div>
          <div className="mt-2.5 flex items-center gap-2 min-h-[1rem]">
            <span
              className="inline-flex items-center gap-1 text-[10.5px] text-white/55 tabular-nums tracking-[-0.005em]"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              <Percent className="h-2.5 w-2.5 text-white/35" strokeWidth={2} aria-hidden="true" />
              <span>{percent}%</span>
            </span>
          </div>
        </div>
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ring-1 bg-white/[0.06] text-white/75 ring-white/[0.08]"
          aria-hidden="true"
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
      </div>
      {/* coral intensity bar — 단일 액센트, 시각 노이즈 없음 */}
      <div
        className="mt-3 h-1.5 rounded-[3px] overflow-hidden ring-1 ring-white/[0.04]"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        <div
          className="h-full rounded-[3px]"
          style={{
            width: `${Math.max(2, Math.min(percent, 100))}%`,
            background: fillBg,
            transition: `width 420ms ${MAC_EASE}`,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        />
      </div>
    </div>
  );
}

// =====================================================
// TrendChart — macOS Activity Monitor stacked bars
// coral intensity 4단계 (direct → search → social → referral)
// =====================================================
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
  const slice = useMemo(() => data ?? [], [data]);

  const maxTotal = useMemo(() => {
    if (!slice.length) return 1;
    const totals = slice.map((d) => d.direct + d.search + d.social + d.referral);
    return Math.max(...totals, 1);
  }, [slice]);

  if (!slice.length) {
    return (
      <div className="flex items-center justify-center py-8 text-[11.5px] text-white/35 tracking-[-0.005em]">
        트렌드 데이터 없음
      </div>
    );
  }

  const segmentTypes: SourceType[] = ["direct", "search", "social", "referral"];

  return (
    <div className="space-y-3">
      {/* Legend — coral intensity 단계 표시 */}
      <div className="flex items-center gap-3 text-[10.5px] tracking-[-0.005em] flex-wrap">
        {segmentTypes.map((t) => {
          const intensity = SOURCE_INTENSITY[t];
          return (
            <div key={t} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-sm ring-1 ring-white/10"
                style={{
                  background: `rgba(218,119,86,${0.95 * intensity})`,
                }}
              />
              <span className="text-white/55">{SOURCE_LABELS[t].label}</span>
            </div>
          );
        })}
        <span
          className="ml-auto text-[10px] text-white/30 tabular-nums tracking-[-0.005em]"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          최대 <span className="text-white/55 font-medium">{maxTotal.toLocaleString("en-US")}</span>
        </span>
      </div>

      {/* Chart */}
      <div
        className="flex items-end gap-1 h-[120px] px-0.5"
        role="img"
        aria-label={`일별 유입 추이 — ${slice.length}일`}
      >
        {slice.map((item, index) => {
          const total = item.direct + item.search + item.social + item.referral;
          const scale = total / maxTotal;
          const date = new Date(item.date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          return (
            <div
              key={item.date}
              tabIndex={0}
              role="group"
              aria-label={`${item.date} 총 ${total}명`}
              title={`${item.date} · 총 ${total.toLocaleString("en-US")}명`}
              className="group flex-1 flex flex-col items-center gap-1.5 rounded-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 cursor-default"
              style={{ transition: `background-color 160ms ${MAC_EASE}` }}
            >
              <div
                className="w-full rounded-t-[3px] flex flex-col-reverse overflow-hidden ring-1 ring-white/[0.04]"
                style={{
                  height: `${Math.max(scale * 100, total > 0 ? 6 : 2)}%`,
                  transition: `height 380ms ${MAC_EASE}`,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                {segmentTypes.map((t) => {
                  const value = item[t];
                  if (value <= 0) return null;
                  const intensity = SOURCE_INTENSITY[t];
                  return (
                    <div
                      key={t}
                      style={{
                        flexGrow: value,
                        minHeight: 1,
                        background: `rgba(218,119,86,${0.95 * intensity})`,
                      }}
                    />
                  );
                })}
              </div>
              {index % 2 === 0 && (
                <span
                  className={`text-[9.5px] tabular-nums tracking-[-0.005em] ${
                    isWeekend ? "text-white/25" : "text-white/40"
                  } group-hover:text-white/65`}
                  style={{
                    fontFeatureSettings: '"tnum"',
                    transition: `color 160ms ${MAC_EASE}`,
                  }}
                >
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

// =====================================================
// Types — API 응답 100% 유지
// =====================================================
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
  icon: string; // legacy emoji, 미사용 (Lucide 로 교체)
  details?: DomainDetail[];
}

type SortType = "count" | "percent" | "domain";

// =====================================================
// Sort Header Cell — aria-sort + keyboard accessible
// =====================================================
function SortHeader({
  label,
  type,
  active,
  desc,
  align = "left",
  onSort,
}: {
  label: string;
  type: SortType;
  active: boolean;
  desc: boolean;
  align?: "left" | "right";
  onSort: (t: SortType) => void;
}) {
  const ariaSort: "ascending" | "descending" | "none" = active
    ? desc
      ? "descending"
      : "ascending"
    : "none";

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 border-b border-white/[0.08] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(type)}
        className={`group inline-flex items-center gap-1 rounded-[4px] px-1 py-0.5 -mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 ${
          active ? "text-white/85" : "text-white/45 hover:text-white/70"
        } ${align === "right" ? "ml-auto" : ""}`}
        style={{ transition: `color 160ms ${MAC_EASE}` }}
        aria-label={`${label} 기준 정렬 (${active ? (desc ? "내림차순" : "오름차순") : "비활성"})`}
      >
        <span>{label}</span>
        <ArrowDownAZ
          className={`h-2.5 w-2.5 shrink-0 ${active ? "opacity-100" : "opacity-40 group-hover:opacity-70"}`}
          strokeWidth={2}
          style={{
            transform: active && !desc ? "rotate(180deg)" : "rotate(0deg)",
            transition: `transform 200ms ${MAC_EASE}, opacity 160ms ${MAC_EASE}`,
          }}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

// =====================================================
// TopDomainsTable — macOS Finder list view
// sticky thead (L2) + sortable (aria-sort) + keyboard rows (H5) + font-mono (L3)
// 기능 100% 유지 (sort/expand)
// =====================================================
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

  // Dynamic scaling — relative bar widths
  const maxPercent = useMemo(() => Math.max(...domains.map((d) => d.percent), 1), [domains]);

  const sortedDomains = useMemo(() => {
    return [...domains].sort((a, b) => {
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
  }, [domains, sortBy, sortDesc]);

  if (!domains?.length) {
    return (
      <div className="flex items-center justify-center py-8 text-[11.5px] text-white/35 tracking-[-0.005em]">
        도메인 데이터 없음
      </div>
    );
  }

  return (
    <div className="overflow-auto" style={{ maxHeight: 600 }}>
      <table className="w-full border-separate border-spacing-0">
        <thead
          className="sticky top-0 z-10"
          style={{
            background: "rgba(28,28,30,0.92)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          <tr>
            <SortHeader
              label="도메인"
              type="domain"
              active={sortBy === "domain"}
              desc={sortDesc}
              onSort={handleSort}
            />
            <th
              scope="col"
              className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 border-b border-white/[0.08] text-left"
            >
              유형
            </th>
            <SortHeader
              label="방문자"
              type="count"
              active={sortBy === "count"}
              desc={sortDesc}
              align="right"
              onSort={handleSort}
            />
            <SortHeader
              label="비율"
              type="percent"
              active={sortBy === "percent"}
              desc={sortDesc}
              align="right"
              onSort={handleSort}
            />
          </tr>
        </thead>
        <tbody>
          {sortedDomains.map((domain, index) => {
            const labels = SOURCE_LABELS[domain.type];
            const dot = SOURCE_DOT[domain.type];
            const intensity = SOURCE_INTENSITY[domain.type];
            const isExpanded = expandedDomains.has(domain.domain);
            const hasDetails = domain.details && domain.details.length > 0;
            const isTop = index === 0;

            // H5 fix — Enter/Space 키보드 접근
            const onKey = (e: React.KeyboardEvent) => {
              if (!hasDetails) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleExpand(domain.domain);
              }
            };

            const fillBg = `linear-gradient(90deg, rgba(218,119,86,${0.95 * intensity}) 0%, rgba(218,119,86,${0.7 * intensity}) 100%)`;

            return (
              <Fragment key={domain.domain}>
                <tr
                  role={hasDetails ? "button" : undefined}
                  tabIndex={hasDetails ? 0 : undefined}
                  aria-expanded={hasDetails ? isExpanded : undefined}
                  aria-label={
                    hasDetails
                      ? `${domain.domain} ${SOURCE_LABELS[domain.type].label} ${domain.count.toLocaleString("en-US")}명 ${domain.percent}% ${isExpanded ? "접기" : "펼치기"}`
                      : undefined
                  }
                  className={`group ${hasDetails ? "cursor-pointer" : ""} focus-visible:outline-none focus-visible:bg-white/[0.04] ${isTop ? "bg-white/[0.025]" : ""}`}
                  style={{ transition: `background-color 160ms ${MAC_EASE}` }}
                  onClick={() => hasDetails && toggleExpand(domain.domain)}
                  onKeyDown={onKey}
                >
                  <td className="px-3 py-2 border-b border-white/[0.04] group-hover:bg-white/[0.02]">
                    <div className="flex items-center gap-2 min-w-0">
                      {hasDetails ? (
                        <ChevronRight
                          className="h-3 w-3 shrink-0 text-white/40"
                          strokeWidth={2}
                          style={{
                            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                            transition: `transform 200ms ${MAC_EASE}`,
                          }}
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="inline-block h-3 w-3 shrink-0" aria-hidden="true" />
                      )}
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`}
                      />
                      <span
                        className="text-[12.5px] font-medium text-white/90 tracking-[-0.005em] truncate max-w-[200px] font-mono"
                        title={domain.domain}
                        style={{ fontFeatureSettings: '"ss01"' }}
                      >
                        {domain.domain}
                      </span>
                      {isTop && (
                        <span
                          className="inline-flex items-center rounded-[4px] px-1.5 py-0 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-claude-coral)] bg-[var(--color-claude-coral)]/12 ring-1 ring-[var(--color-claude-coral)]/22"
                          aria-label="최상위 도메인"
                        >
                          TOP
                        </span>
                      )}
                      {hasDetails && (
                        <span
                          className="text-[10px] text-white/35 tabular-nums tracking-[-0.005em] shrink-0"
                          style={{ fontFeatureSettings: '"tnum"' }}
                        >
                          {domain.details!.length}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 border-b border-white/[0.04] group-hover:bg-white/[0.02]">
                    <span className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium text-white/70 ring-1 ring-white/[0.08] bg-white/[0.04] tracking-[-0.005em]">
                      <span aria-hidden="true" className={`h-1 w-1 rounded-full ${dot}`} />
                      <span>{labels.label}</span>
                    </span>
                  </td>
                  <td
                    className="px-3 py-2 text-right text-[12.5px] text-white/90 font-mono tabular-nums tracking-[-0.005em] border-b border-white/[0.04] group-hover:bg-white/[0.02]"
                    style={{ fontFeatureSettings: '"tnum", "ss01"' }}
                  >
                    {domain.count.toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-2 text-right border-b border-white/[0.04] group-hover:bg-white/[0.02]">
                    <div className="flex items-center justify-end gap-2">
                      <div
                        className="w-14 h-1.5 rounded-[3px] overflow-hidden ring-1 ring-white/[0.04]"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <div
                          className="h-full rounded-[3px]"
                          style={{
                            width: `${Math.min((domain.percent / maxPercent) * 100, 100)}%`,
                            background: fillBg,
                            transition: `width 420ms ${MAC_EASE}`,
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                          }}
                        />
                      </div>
                      <span
                        className="text-[11.5px] text-white/65 font-mono tabular-nums w-10 text-right tracking-[-0.005em]"
                        style={{ fontFeatureSettings: '"tnum"' }}
                      >
                        {domain.percent}%
                      </span>
                    </div>
                  </td>
                </tr>
                {/* Expanded details — macOS Finder column nested */}
                {isExpanded && hasDetails && (
                  <tr>
                    <td colSpan={4} className="p-0 border-b border-white/[0.04]">
                      <div style={{ background: "rgba(255,255,255,0.018)" }}>
                        {domain.details!.map((detail) => (
                          <div
                            key={detail.url}
                            className="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-white/[0.025] last:border-b-0 pl-[34px]"
                            style={{ transition: `background-color 160ms ${MAC_EASE}` }}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <ExternalLink
                                className="h-2.5 w-2.5 text-white/30 shrink-0"
                                strokeWidth={2}
                                aria-hidden="true"
                              />
                              <span
                                className="text-[11px] text-white/55 truncate max-w-[420px] font-mono tracking-[-0.005em]"
                                title={detail.url}
                                style={{ fontFeatureSettings: '"ss01"' }}
                              >
                                {detail.url}
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span
                                className="text-[11px] text-white/55 font-mono tabular-nums tracking-[-0.005em]"
                                style={{ fontFeatureSettings: '"tnum"' }}
                              >
                                {detail.count.toLocaleString("en-US")}
                              </span>
                              <span
                                className="text-[10px] text-white/35 font-mono tabular-nums w-10 text-right tracking-[-0.005em]"
                                style={{ fontFeatureSettings: '"tnum"' }}
                              >
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

// =====================================================
// Insight Item — macOS Notification Center (funnels 와 일관)
// =====================================================
function InsightItem({
  variant,
  icon: Icon,
  title,
  description,
}: {
  variant: "warn" | "alert" | "good";
  icon: LucideIcon;
  title: React.ReactNode;
  description: string;
}) {
  const variantConfig = {
    warn: {
      dot: "bg-amber-300",
      ring: "ring-white/[0.08]",
      bg: "rgba(255,255,255,0.025)",
      iconColor: "text-amber-300",
    },
    alert: {
      dot: "bg-[var(--color-claude-coral)]",
      ring: "ring-[var(--color-claude-coral)]/20",
      bg: "rgba(218,119,86,0.05)",
      iconColor: "text-[var(--color-claude-coral)]",
    },
    good: {
      dot: "bg-emerald-300",
      ring: "ring-white/[0.08]",
      bg: "rgba(255,255,255,0.025)",
      iconColor: "text-emerald-300",
    },
  }[variant];

  return (
    <div
      className={`flex items-start gap-2.5 rounded-[7px] px-3 py-2.5 ring-1 ${variantConfig.ring}`}
      style={{ background: variantConfig.bg }}
    >
      <div
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/[0.06]"
        aria-hidden="true"
      >
        <Icon className={`h-3 w-3 ${variantConfig.iconColor}`} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span aria-hidden="true" className={`h-1 w-1 rounded-full ${variantConfig.dot}`} />
          <p className="text-[12px] text-white/85 tracking-[-0.005em] leading-snug">{title}</p>
        </div>
        <p className="text-[11px] text-white/45 tracking-[-0.005em] leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

// =====================================================
// TrafficInsights — funnels Insights 와 시각 일관
// =====================================================
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
  // 가장 높은 유입 소스
  const sources = [
    { type: "direct" as SourceType, ...summary.direct },
    { type: "search" as SourceType, ...summary.search },
    { type: "social" as SourceType, ...summary.social },
    { type: "referral" as SourceType, ...summary.referral },
  ];
  const topSource = sources.reduce((a, b) => (a.percent > b.percent ? a : b));

  // 검색 유입 평가
  const searchPercent = summary.search.percent;
  const isSearchGood = searchPercent >= 30;

  // 상위 외부 도메인
  const topReferral = topDomains.find((d) => d.type === "referral");

  return (
    <GlassCard title="인사이트" caption="Insights" icon={Lightbulb}>
      <div className="space-y-2">
        <InsightItem
          variant="alert"
          icon={TrendingUp}
          title={
            <>
              <span className="text-white font-medium tracking-[-0.005em]">
                {SOURCE_LABELS[topSource.type].label}
              </span>
              이 주요 유입 경로 (
              <span
                className="text-white font-medium tabular-nums"
                style={{ fontFeatureSettings: '"tnum"' }}
              >
                {topSource.percent}%
              </span>
              )
            </>
          }
          description={`전체 트래픽의 ${topSource.percent}%를 차지하는 핵심 채널입니다.`}
        />
        {isSearchGood ? (
          <InsightItem
            variant="good"
            icon={CheckCircle2}
            title={
              <>
                검색 유입{" "}
                <span
                  className="text-white font-medium tabular-nums"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  {searchPercent}%
                </span>
                로 SEO 양호
              </>
            }
            description="현재 검색 엔진 최적화가 효과적으로 작동 중입니다."
          />
        ) : (
          <InsightItem
            variant="warn"
            icon={SearchIcon}
            title={
              <>
                검색 유입{" "}
                <span
                  className="text-white font-medium tabular-nums"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  {searchPercent}%
                </span>
                로 낮음
              </>
            }
            description="SEO 개선으로 검색 유입을 늘릴 수 있습니다."
          />
        )}
        {topReferral && (
          <InsightItem
            variant="alert"
            icon={Link2}
            title={
              <>
                <span
                  className="text-white font-medium font-mono tracking-[-0.005em]"
                  style={{ fontFeatureSettings: '"ss01"' }}
                >
                  {topReferral.domain}
                </span>{" "}
                외부 유입 1위
              </>
            }
            description="해당 채널에서의 활동을 강화해보세요."
          />
        )}
      </div>
    </GlassCard>
  );
}

// =====================================================
// Main
// =====================================================
export default function TrafficSourcesPage() {
  const [dateRange, setDateRange] = useState<PeriodValue>("-7d");
  const { data, isLoading, error, dataUpdatedAt } = useTrafficSources({ dateFrom: dateRange });

  const lastFetchedAt = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div
      className="space-y-5 max-w-6xl"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
        fontFeatureSettings: '"ss01", "cv11", "cv03"',
      }}
    >
      {/* ─────────── Header — funnels 와 100% 동일 패턴 ─────────── */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Network className="h-3.5 w-3.5 text-white/40" strokeWidth={1.75} aria-hidden="true" />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40">
              Analytics · Traffic
            </span>
          </div>
          <h1
            className="text-[20px] font-semibold leading-none tracking-[-0.01em] text-white/95"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            유입 경로
          </h1>
          <p className="mt-1.5 text-[12px] text-white/45 tracking-[-0.005em]">
            방문자가 어디서 왔는지 분석 (PostHog 기반)
            {lastFetchedAt && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-white/20">
                  ·
                </span>
                <span
                  className="tabular-nums"
                  title={lastFetchedAt.toLocaleString("ko-KR")}
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  업데이트{" "}
                  {lastFetchedAt.toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="shrink-0">
          <PeriodSegmented value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* ─────────── Loading ─────────── */}
      {isLoading && (
        <div
          className="flex items-center justify-center py-12 rounded-[9px] ring-1 ring-white/[0.06]"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="inline-flex items-center gap-2 text-[12px] text-white/55 tracking-[-0.005em]">
            <span
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/15 border-t-[var(--color-claude-coral)]"
              aria-hidden="true"
            />
            로딩 중...
          </div>
        </div>
      )}

      {/* ─────────── Error ─────────── */}
      {error && (
        <div
          className="rounded-[9px] px-4 py-3.5 ring-1 ring-[var(--color-claude-coral)]/25"
          style={{
            background: "rgba(218,119,86,0.06)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
          role="alert"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-claude-coral)]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-white/90 tracking-[-0.005em] mb-0.5">
                데이터 로드 실패
              </div>
              <p className="text-[11.5px] text-white/55 tracking-[-0.005em] leading-relaxed">
                {error instanceof Error ? error.message : "PostHog 연결을 확인해주세요."}
              </p>
              <p className="text-[10.5px] text-white/40 mt-1.5 tracking-[-0.005em] font-mono">
                POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID 환경 변수 확인
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── PostHog 미설정 경고 ─────────── */}
      {data?.error && (
        <div
          className="rounded-[9px] px-4 py-3.5 ring-1 ring-amber-300/25"
          style={{
            background: "rgba(252,211,77,0.04)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
          role="alert"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-white/90 tracking-[-0.005em] mb-0.5">
                PostHog 미설정
              </div>
              <p className="text-[11.5px] text-white/55 tracking-[-0.005em] leading-relaxed">
                {data.error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── Content ─────────── */}
      {!isLoading && data && !data.error && (
        <>
          {/* Summary KPI — funnels MetricCard 패턴 일관 */}
          <section aria-labelledby="traffic-summary-heading">
            <div className="flex items-center gap-1.5 mb-2.5 px-1">
              <h2
                id="traffic-summary-heading"
                className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40"
              >
                요약 지표
              </h2>
              <span className="text-[10.5px] text-white/30 tracking-[-0.005em]">
                Traffic Sources
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <SourceCard
                type="direct"
                count={data.summary.direct.count}
                percent={data.summary.direct.percent}
              />
              <SourceCard
                type="search"
                count={data.summary.search.count}
                percent={data.summary.search.percent}
              />
              <SourceCard
                type="social"
                count={data.summary.social.count}
                percent={data.summary.social.percent}
              />
              <SourceCard
                type="referral"
                count={data.summary.referral.count}
                percent={data.summary.referral.percent}
              />
            </div>
          </section>

          {/* Trend + Insights — 2:1 grid (funnels 와 일관) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2">
              <GlassCard
                title="일별 유입 트렌드"
                caption="Daily Trend"
                icon={BarChart3}
                trailing={
                  <span
                    className="text-[10px] text-white/30 tabular-nums tracking-[-0.005em]"
                    style={{ fontFeatureSettings: '"tnum"' }}
                  >
                    총{" "}
                    <span className="text-white/55 font-medium">
                      {data.totalVisitors.toLocaleString("en-US")}
                    </span>
                    명
                  </span>
                }
              >
                <TrendChart data={data.trend} />
              </GlassCard>
            </div>
            <TrafficInsights summary={data.summary} topDomains={data.topDomains} />
          </div>

          {/* Top Domains Table — macOS Finder list view */}
          <GlassCard
            title="상위 유입 도메인"
            caption="Top Referrers"
            icon={Globe2}
            padded={false}
            trailing={
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex items-center rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium text-white/60 ring-1 ring-white/[0.08] bg-white/[0.04] tabular-nums tracking-[-0.005em]"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  <Hash
                    className="h-2.5 w-2.5 mr-0.5 text-white/35"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {data.topDomains.length}
                </span>
                <span className="text-[10px] text-white/30 tracking-[-0.005em]">최대 100</span>
              </div>
            }
          >
            <TopDomainsTable domains={data.topDomains} />
          </GlassCard>
        </>
      )}
    </div>
  );
}
