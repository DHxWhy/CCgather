"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  ChevronRight,
  Filter,
  Globe2,
  LineChart,
  Minus,
  Route,
  ScrollText,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCoreKPI, useRetentionDB, useAnalyticsHealth } from "@/hooks/use-admin-analytics";
import { InfoPopover, METRIC_INFO } from "@/components/admin/InfoPopover";

// =====================================================
// macOS Big Sur+ Easing — AdminLayoutClient / superadmin / ai-usage 와 동일
// =====================================================
const MAC_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// =====================================================
// Period — macOS NSSegmentedControl 표준
// =====================================================
const PERIOD_OPTIONS = [
  { label: "오늘", value: 1 },
  { label: "7일", value: 7 },
  { label: "14일", value: 14 },
  { label: "30일", value: 30 },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

// =====================================================
// Sub-페이지 navigation — Analytics hub Quick Actions
// =====================================================
interface AnalyticsSubPage {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const ANALYTICS_SUBPAGES: AnalyticsSubPage[] = [
  {
    id: "users",
    label: "웹 트래픽",
    description: "DAU · WAU · MAU 방문자",
    href: "/superadmin/analytics/users",
    icon: BarChart3,
  },
  {
    id: "traffic",
    label: "유입 경로",
    description: "Referrer · UTM 소스 분석",
    href: "/superadmin/analytics/traffic",
    icon: Route,
  },
  {
    id: "funnels",
    label: "퍼널 분석",
    description: "가입 → 첫 제출 전환율",
    href: "/superadmin/analytics/funnels",
    icon: Filter,
  },
  {
    id: "submit-logs",
    label: "Submit Logs",
    description: "최근 제출 로그 + 실패 추적",
    href: "/superadmin/analytics/submit-logs",
    icon: ScrollText,
  },
];

// =====================================================
// Trend Glyph — coral 단일 액센트 + 시멘틱 dot
// =====================================================
function TrendGlyph({
  trend,
  changePercent,
}: {
  trend: "up" | "down" | "neutral";
  changePercent: number;
}) {
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  // 시멘틱 dot (작은 단위, 큰 텍스트는 neutral)
  const dotColor =
    trend === "up" ? "bg-emerald-300" : trend === "down" ? "bg-rose-300" : "bg-white/35";

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] tabular-nums tracking-[-0.005em] text-white/75"
      style={{ fontFeatureSettings: '"tnum"' }}
      aria-label={`이전 기간 대비 ${trend === "up" ? "증가" : trend === "down" ? "감소" : "변동 없음"} ${Math.abs(changePercent).toFixed(1)}%`}
    >
      <span aria-hidden="true" className={`h-1 w-1 rounded-full ${dotColor}`} />
      <Icon className="h-3 w-3 text-white/55" strokeWidth={1.75} aria-hidden="true" />
      <span className="font-medium">{Math.abs(changePercent).toFixed(1)}%</span>
      <span className="text-white/35">vs 이전</span>
    </span>
  );
}

// =====================================================
// KPI Card — macOS Widget Stack (큰 숫자 + 작은 라벨 + trend)
// (superadmin StatCard 패턴과 일관 + KPI 특화)
// =====================================================
interface KPICardProps {
  title: string;
  subtitle: string;
  value: number;
  changePercent: number;
  trend: "up" | "down" | "neutral";
  icon: LucideIcon;
  format?: "number" | "percent";
  infoKey: keyof typeof METRIC_INFO;
  accent?: "neutral" | "coral";
}

function formatKPIValue(v: number, format: "number" | "percent"): string {
  if (format === "percent") return `${v.toFixed(1)}%`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString("en-US");
}

function KPICard({
  title,
  subtitle,
  value,
  changePercent,
  trend,
  icon: Icon,
  format = "number",
  infoKey,
  accent = "neutral",
}: KPICardProps) {
  const info = METRIC_INFO[infoKey];

  const valueColor = accent === "coral" ? "text-[var(--color-claude-coral)]" : "text-white";
  const iconBg =
    accent === "coral"
      ? "bg-[var(--color-claude-coral)]/12 text-[var(--color-claude-coral)] ring-[var(--color-claude-coral)]/20"
      : "bg-white/[0.06] text-white/75 ring-white/[0.08]";

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
          {/* Title row with info popover */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/45">
              {title}
            </span>
            <InfoPopover
              title={info.title}
              description={info.description}
              formula={"formula" in info ? info.formula : undefined}
              insights={info.insights}
            />
          </div>
          <div className="mt-0.5 text-[10px] text-white/35 tracking-[-0.005em]">{subtitle}</div>
          {/* Big value */}
          <div
            className={`mt-2.5 text-[28px] font-semibold leading-none tabular-nums tracking-[-0.02em] ${valueColor}`}
            style={{ fontFeatureSettings: '"ss01", "tnum", "cv11"' }}
          >
            {formatKPIValue(value, format)}
          </div>
          {/* Trend */}
          <div className="mt-2.5">
            <TrendGlyph trend={trend} changePercent={changePercent} />
          </div>
        </div>
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ring-1 ${iconBg}`}
          aria-hidden="true"
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Retention Widget — Activity Monitor 스타일
// =====================================================
function RetentionWidget({ w1, w4 }: { w1: number; w4: number }) {
  // 시멘틱 dot (큰 텍스트는 white, 작은 dot 로 healthy/warn/risk 시그널)
  const getStatusDot = (value: number) => {
    if (value >= 40) return "bg-emerald-300";
    if (value >= 20) return "bg-amber-300";
    return "bg-rose-300";
  };
  const getStatusLabel = (value: number) => (value >= 40 ? "양호" : value >= 20 ? "주의" : "위험");

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
      <div className="flex items-center gap-1 mb-3.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/45">
          제출 리텐션
        </span>
        <InfoPopover
          title="제출 리텐션"
          description="첫 제출 후 이후 주차에도 다시 제출한 사용자 비율입니다."
          insights={["W1 40% 이상이면 양호한 수준입니다", "W4 20% 이상이면 장기 유지율이 좋습니다"]}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "W1 리텐션", value: w1 },
          { label: "W4 리텐션", value: w4 },
        ].map((item) => (
          <div key={item.label} className="min-w-0">
            <div className="flex items-center gap-1 text-[10px] text-white/40 tracking-[-0.005em] mb-1">
              <span>{item.label}</span>
            </div>
            <div
              className="text-[24px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-white"
              style={{ fontFeatureSettings: '"ss01", "tnum", "cv11"' }}
            >
              {item.value}%
            </div>
            <div className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] text-white/55 tracking-[-0.005em]">
              <span
                aria-hidden="true"
                className={`h-1 w-1 rounded-full ${getStatusDot(item.value)}`}
              />
              <span>{getStatusLabel(item.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// GlassCard — frosted glass container (ai-usage 패턴)
// =====================================================
function GlassCard({
  children,
  title,
  info,
  trailing,
  className = "",
}: {
  children: React.ReactNode;
  title?: string;
  info?: { title: string; description: string; insights?: readonly string[] };
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[9px] p-4 ring-1 ring-white/[0.08] ${className}`}
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.18)",
      }}
    >
      {(title || trailing) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            {title && (
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">
                {title}
              </h3>
            )}
            {info && (
              <InfoPopover
                title={info.title}
                description={info.description}
                insights={info.insights}
              />
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
// Period Segmented Control — macOS NSSegmentedControl
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
            className={`relative inline-flex h-7 items-center px-3 text-[11.5px] font-medium tracking-[-0.005em] rounded-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98] ${
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
// Health Badge — macOS-style monochrome chip + 시멘틱 dot
// =====================================================
function HealthBadge({ status, latency }: { status: string; latency: number }) {
  const config = {
    healthy: { dot: "bg-emerald-300", label: "PostHog 연결됨" },
    degraded: { dot: "bg-amber-300", label: "PostHog 지연" },
    unhealthy: { dot: "bg-rose-300", label: "PostHog 오류" },
    not_configured: { dot: "bg-white/35", label: "PostHog 미설정" },
  }[status] || { dot: "bg-white/35", label: status };

  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 text-[11px] font-medium text-white/55 ring-1 ring-white/[0.08] bg-white/[0.04] tracking-[-0.005em]"
      style={{
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
      aria-label={`${config.label}${latency > 0 ? `, 응답 시간 ${latency}밀리초` : ""}`}
    >
      <span aria-hidden="true" className={`h-1 w-1 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
      {latency > 0 && (
        <span className="tabular-nums text-white/35" style={{ fontFeatureSettings: '"tnum"' }}>
          {latency}ms
        </span>
      )}
    </span>
  );
}

// =====================================================
// Activity Monitor 스타일 Distribution Bar Chart
// — recharts 사용, coral 단일 액센트
// =====================================================
interface DistributionRowProps {
  label: string;
  count: number;
  percentage: number;
  maxCount: number;
  isHighlight?: boolean;
}

function DistributionRow({
  label,
  count,
  percentage,
  maxCount,
  isHighlight,
}: DistributionRowProps) {
  const widthPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-20 shrink-0 text-[11.5px] text-white/70 tracking-[-0.005em] truncate"
        title={label}
      >
        {label}
      </div>
      <div
        className="flex-1 h-3 rounded-[4px] overflow-hidden ring-1 ring-white/[0.04]"
        style={{ background: "rgba(255,255,255,0.04)" }}
        role="meter"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} ${percentage}%`}
      >
        <div
          className={`h-full rounded-[4px] ${
            isHighlight ? "bg-[var(--color-claude-coral)]" : "bg-white/55"
          }`}
          style={{
            width: `${Math.max(2, widthPercent)}%`,
            transition: `width 320ms ${MAC_EASE}`,
          }}
        />
      </div>
      <div
        className="w-12 shrink-0 text-right text-[10.5px] tabular-nums text-white/45"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {percentage}%
      </div>
    </div>
  );
}

function DistributionChart({
  title,
  data,
  labelKey,
  infoKey,
  highlightIndex = 0,
}: {
  title: string;
  data: Array<{ count: number; percentage: number; [key: string]: unknown }>;
  labelKey: string;
  infoKey: keyof typeof METRIC_INFO;
  highlightIndex?: number;
}) {
  const info = METRIC_INFO[infoKey];
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  if (!data || data.length === 0) {
    return (
      <GlassCard
        title={title}
        info={{
          title: info.title,
          description: info.description,
          insights: info.insights,
        }}
      >
        <div className="flex items-center justify-center py-6 text-[11.5px] text-white/35 tracking-[-0.005em]">
          데이터 없음
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      title={title}
      info={{
        title: info.title,
        description: info.description,
        insights: info.insights,
      }}
    >
      <div className="space-y-2">
        {data.slice(0, 5).map((item, i) => {
          const rawLabel = String(item[labelKey] || "unknown");
          const displayLabel =
            labelKey === "code" ? `${getFlagEmoji(rawLabel)} ${rawLabel}` : rawLabel;
          return (
            <DistributionRow
              key={i}
              label={displayLabel}
              count={item.count}
              percentage={item.percentage}
              maxCount={maxCount}
              isHighlight={i === highlightIndex}
            />
          );
        })}
      </div>
    </GlassCard>
  );
}

// =====================================================
// 국기 이모지 헬퍼 — 기존 로직 유지
// =====================================================
function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// =====================================================
// Sub-page Quick Action Card — macOS sidebar item / Quick Actions grid
// =====================================================
function SubPageActionCard({ page }: { page: AnalyticsSubPage }) {
  const Icon = page.icon;
  return (
    <Link
      href={page.href}
      className="group relative flex items-center gap-3 rounded-[9px] p-3 ring-1 ring-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-claude-coral)]/40 active:scale-[0.98]"
      style={{
        background: "rgba(255,255,255,0.025)",
        transition: `background-color 180ms ${MAC_EASE}, box-shadow 180ms ${MAC_EASE}, transform 180ms ${MAC_EASE}`,
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-white/[0.05] ring-1 ring-white/[0.08] text-white/65 group-hover:bg-[var(--color-claude-coral)]/12 group-hover:text-[var(--color-claude-coral)] group-hover:ring-[var(--color-claude-coral)]/25"
        style={{ transition: `all 180ms ${MAC_EASE}` }}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium text-white/90 tracking-[-0.005em] truncate">
          {page.label}
        </div>
        <div className="text-[10.5px] text-white/40 tracking-[-0.005em] truncate">
          {page.description}
        </div>
      </div>
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0 text-white/25 group-hover:text-white/55"
        strokeWidth={1.75}
        style={{ transition: `color 180ms ${MAC_EASE}` }}
        aria-hidden="true"
      />
    </Link>
  );
}

// =====================================================
// Cohort Heatmap Cell — coral 단일 액센트 톤
// =====================================================
function CohortCell({ rate }: { rate: number | undefined }) {
  const isFuture = rate === undefined;
  if (isFuture) {
    return (
      <td className="px-2.5 py-2 text-center text-[11px] text-white/20">
        <span aria-label="미래 데이터">—</span>
      </td>
    );
  }
  // coral 톤 (rgba(218,119,86,...))로 통일 — 사용자 명시
  const opacity = Math.min(0.55, rate / 100);
  const textColor = rate >= 50 ? "text-white" : rate >= 20 ? "text-white/85" : "text-white/65";
  return (
    <td
      className={`px-2.5 py-2 text-center text-[11px] tabular-nums ${textColor}`}
      style={{
        backgroundColor: `rgba(218, 119, 86, ${opacity})`,
        fontFeatureSettings: '"tnum"',
      }}
      aria-label={`리텐션 ${rate}%`}
    >
      {rate}%
    </td>
  );
}

// =====================================================
// Main
// =====================================================
export default function AnalyticsPage() {
  const [days, setDays] = useState<PeriodValue>(7);

  const { data: coreKPI, isLoading: coreLoading, dataUpdatedAt } = useCoreKPI({ days });
  const { data: retention, isLoading: retentionLoading } = useRetentionDB({ weeks: 8 });
  const { data: health } = useAnalyticsHealth();

  const isLoading = coreLoading || retentionLoading;
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
      {/* ─────────── Header ─────────── */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="text-[20px] font-semibold leading-none tracking-[-0.01em] text-white/95"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            Analytics Overview
          </h1>
          <p className="mt-1.5 text-[12px] text-white/45 tracking-[-0.005em]">
            DB 기반 핵심 KPI · 활성 사용자{" "}
            <span
              className="tabular-nums text-white/65 font-medium"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              {coreKPI?.totals.activeUsers.toLocaleString("en-US") ?? "—"}
            </span>
            명
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
        <div className="flex items-center gap-2 shrink-0">
          {health && (
            <HealthBadge status={health.posthog.status} latency={health.posthog.latency_ms} />
          )}
          <PeriodSegmented value={days} onChange={setDays} />
        </div>
      </div>

      {/* ─────────── Sub-page Hub Navigation — Quick Actions Grid ─────────── */}
      <section aria-labelledby="hub-nav-heading">
        <div className="flex items-center gap-1 mb-2.5 px-1">
          <h2
            id="hub-nav-heading"
            className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40"
          >
            상세 분석
          </h2>
          <Sparkles className="h-3 w-3 text-white/25" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {ANALYTICS_SUBPAGES.map((sub) => (
            <SubPageActionCard key={sub.id} page={sub} />
          ))}
        </div>
      </section>

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

      {/* ─────────── Core KPI ─────────── */}
      {!isLoading && coreKPI && (
        <>
          {/* 활성 사용자 (Stickiness) 섹션 — 핵심 지표 */}
          <section aria-labelledby="active-users-heading">
            <div className="flex items-center gap-1 mb-2.5 px-1">
              <h2
                id="active-users-heading"
                className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40"
              >
                활성 사용자
              </h2>
              <span className="text-[10.5px] text-white/30 tracking-[-0.005em]">Stickiness</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KPICard
                title="WAU"
                subtitle="Weekly Active Submitters"
                value={coreKPI.metrics.wauSubmitters.value}
                changePercent={coreKPI.metrics.wauSubmitters.changePercent}
                trend={coreKPI.metrics.wauSubmitters.trend}
                icon={Activity}
                infoKey="wau_submitters"
              />
              <KPICard
                title="MAU"
                subtitle="Monthly Active Submitters"
                value={coreKPI.metrics.mauSubmitters.value}
                changePercent={coreKPI.metrics.mauSubmitters.changePercent}
                trend={coreKPI.metrics.mauSubmitters.trend}
                icon={Users}
                infoKey="mau_submitters"
              />
              <KPICard
                title="WAU/MAU"
                subtitle="Stickiness Ratio"
                value={coreKPI.metrics.stickiness.value}
                changePercent={coreKPI.metrics.stickiness.changePercent}
                trend={coreKPI.metrics.stickiness.trend}
                icon={Zap}
                format="percent"
                infoKey="stickiness"
                accent="coral"
              />
            </div>
          </section>

          {/* 행위 지표 섹션 */}
          <section aria-labelledby="engagement-heading">
            <div className="flex items-center gap-1 mb-2.5 px-1">
              <h2
                id="engagement-heading"
                className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40"
              >
                행위 지표
              </h2>
              <span className="text-[10.5px] text-white/30 tracking-[-0.005em]">Engagement</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KPICard
                title="제출 수"
                subtitle="Total Submissions"
                value={coreKPI.metrics.totalSubmissions.value}
                changePercent={coreKPI.metrics.totalSubmissions.changePercent}
                trend={coreKPI.metrics.totalSubmissions.trend}
                icon={LineChart}
                infoKey="total_submissions"
              />
              <KPICard
                title="신규 가입"
                subtitle="New Signups"
                value={coreKPI.metrics.newSignups.value}
                changePercent={coreKPI.metrics.newSignups.changePercent}
                trend={coreKPI.metrics.newSignups.trend}
                icon={UserPlus}
                infoKey="new_signups"
              />
              <KPICard
                title="첫 제출율"
                subtitle="First Submit Rate"
                value={coreKPI.metrics.firstSubmitRate.value}
                changePercent={coreKPI.metrics.firstSubmitRate.changePercent}
                trend={coreKPI.metrics.firstSubmitRate.trend}
                icon={ArrowUpRight}
                format="percent"
                infoKey="first_submit_rate"
              />
            </div>
          </section>

          {/* 리텐션 + 분포 섹션 */}
          <section aria-labelledby="retention-distribution-heading">
            <div className="flex items-center gap-1 mb-2.5 px-1">
              <h2
                id="retention-distribution-heading"
                className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40"
              >
                리텐션 & 분포
              </h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {retention && (
                <RetentionWidget
                  w1={retention.summary.w1Retention}
                  w4={retention.summary.w4Retention}
                />
              )}
              <DistributionChart
                title="플랜별 분포"
                data={coreKPI.distributions.plan.map((p) => ({ ...p, plan: p.plan }))}
                labelKey="plan"
                infoKey="plan_distribution"
              />
              <DistributionChart
                title="모델별 분포"
                data={coreKPI.distributions.model.map((m) => ({ ...m, model: m.model }))}
                labelKey="model"
                infoKey="model_distribution"
              />
            </div>
          </section>

          {/* 국가별 분포 */}
          <GlassCard
            title="국가별 분포"
            info={{
              title: METRIC_INFO.country_distribution.title,
              description: METRIC_INFO.country_distribution.description,
              insights: METRIC_INFO.country_distribution.insights,
            }}
            trailing={
              <Globe2 className="h-3.5 w-3.5 text-white/35" strokeWidth={1.75} aria-hidden="true" />
            }
          >
            {coreKPI.distributions.country.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
                {coreKPI.distributions.country.slice(0, 10).map((country, i) => (
                  <div
                    key={country.code}
                    className={`flex items-center gap-2 rounded-[7px] px-2 py-1.5 ring-1 ${
                      i === 0
                        ? "bg-[var(--color-claude-coral)]/[0.08] ring-[var(--color-claude-coral)]/20"
                        : "bg-white/[0.025] ring-white/[0.06]"
                    }`}
                    title={`${country.code} ${country.percentage}%`}
                  >
                    <span className="text-[14px] leading-none" aria-hidden="true">
                      {getFlagEmoji(country.code || "")}
                    </span>
                    <span className="text-[11.5px] font-medium text-white/85 tracking-[-0.005em] truncate">
                      {country.code || "—"}
                    </span>
                    <span
                      className={`tabular-nums ml-auto text-[10.5px] ${
                        i === 0 ? "text-[var(--color-claude-coral)]/85" : "text-white/40"
                      }`}
                      style={{ fontFeatureSettings: '"tnum"' }}
                    >
                      {country.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-6 text-[11.5px] text-white/35 tracking-[-0.005em]">
                국가 데이터 없음
              </div>
            )}
          </GlassCard>
        </>
      )}

      {/* ─────────── Retention Cohort Heatmap ─────────── */}
      {!isLoading && retention && retention.cohorts.length > 0 && (
        <GlassCard
          title="리텐션 코호트"
          info={{
            title: "리텐션 코호트",
            description: "주차별 첫 제출 사용자 그룹이 이후 주차에 다시 제출한 비율입니다.",
            insights: [
              "대각선으로 읽으면 각 코호트의 시간 경과에 따른 유지율을 볼 수 있습니다",
              "색이 진할수록 리텐션이 높습니다",
            ],
          }}
          trailing={
            <CalendarClock
              className="h-3.5 w-3.5 text-white/35"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          }
        >
          <div className="overflow-x-auto -mx-1">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-2.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40">
                    코호트
                  </th>
                  <th className="text-center px-2.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40">
                    크기
                  </th>
                  {["W0", "W1", "W2", "W3", "W4"].map((w) => (
                    <th
                      key={w}
                      className="text-center px-2.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40"
                    >
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retention.cohorts.slice(0, 6).map((cohort) => (
                  <tr
                    key={cohort.cohortWeek}
                    className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.015]"
                    style={{
                      transition: `background-color 160ms ${MAC_EASE}`,
                    }}
                  >
                    <td
                      className="px-2.5 py-2 text-[11.5px] text-white/75 font-mono tabular-nums tracking-[-0.005em]"
                      style={{ fontFeatureSettings: '"tnum"' }}
                    >
                      {cohort.cohortWeek}
                    </td>
                    <td
                      className="px-2.5 py-2 text-center text-[11px] tabular-nums text-white/50"
                      style={{ fontFeatureSettings: '"tnum"' }}
                    >
                      {cohort.cohortSize}
                    </td>
                    {[0, 1, 2, 3, 4].map((weekIndex) => (
                      <CohortCell key={weekIndex} rate={cohort.retentionByWeek[weekIndex]} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* ─────────── No Data State — coral subtle accent ─────────── */}
      {!isLoading && coreKPI && coreKPI.totals.activeUsers === 0 && (
        <div
          className="rounded-[9px] px-4 py-3.5 ring-1 ring-white/[0.06]"
          style={{
            background: "rgba(218,119,86,0.04)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          <div className="flex items-start gap-2.5">
            <BarChart3
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-claude-coral)]/85"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-white/90 tracking-[-0.005em] mb-0.5">
                데이터 수집 중
              </div>
              <p className="text-[11.5px] text-white/55 tracking-[-0.005em] leading-relaxed">
                아직 충분한 사용자 데이터가 없습니다. CLI를 통한 제출이 시작되면 지표가 표시됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
