"use client";

import { useState, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Filter,
  Flame,
  Lightbulb,
  Rocket,
  Send,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useFunnelAnalytics } from "@/hooks/use-admin-analytics";

// =====================================================
// macOS Big Sur+ Easing — AdminLayoutClient / analytics / ai-usage 와 동일
// =====================================================
const MAC_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// =====================================================
// Period — macOS NSSegmentedControl 표준
// 사용자 facing 동일 (1/7/14/30/90일)
// =====================================================
const PERIOD_OPTIONS = [
  { label: "오늘", value: 1 },
  { label: "7일", value: 7 },
  { label: "14일", value: 14 },
  { label: "30일", value: 30 },
  { label: "90일", value: 90 },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

// =====================================================
// GlassCard — frosted glass container (analytics / ai-usage 패턴)
// =====================================================
function GlassCard({
  children,
  title,
  caption,
  icon: Icon,
  trailing,
  className = "",
}: {
  children: React.ReactNode;
  title?: string;
  caption?: string;
  icon?: LucideIcon;
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
// KPI Card — macOS Widget Stack (큰 숫자 + 작은 라벨 + sub)
// analytics/page.tsx 의 KPICard 와 시각 일관
// =====================================================
interface MetricCardProps {
  title: string;
  subtitle: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: "neutral" | "coral";
  signal?: { dot: string; label: string };
}

function MetricCard({
  title,
  subtitle,
  value,
  hint,
  icon: Icon,
  accent = "neutral",
  signal,
}: MetricCardProps) {
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
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/45">
              {title}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-white/35 tracking-[-0.005em]">{subtitle}</div>
          <div
            className={`mt-2.5 text-[28px] font-semibold leading-none tabular-nums tracking-[-0.02em] ${valueColor}`}
            style={{ fontFeatureSettings: '"ss01", "tnum", "cv11"' }}
          >
            {value}
          </div>
          <div className="mt-2.5 flex items-center gap-2 min-h-[1rem]">
            {signal && (
              <span
                className="inline-flex items-center gap-1 text-[10.5px] text-white/55 tracking-[-0.005em]"
                aria-label={signal.label}
              >
                <span aria-hidden="true" className={`h-1 w-1 rounded-full ${signal.dot}`} />
                <span>{signal.label}</span>
              </span>
            )}
            {hint && (
              <span className="text-[10.5px] text-white/40 tracking-[-0.005em]">{hint}</span>
            )}
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
// Funnel Bar — macOS Activity Monitor 스타일
// coral 단일 액센트 + white tint gradient (위계 표현)
// =====================================================
function FunnelBar({
  step,
  label,
  caption,
  value,
  total,
  intensity, // 1.0 / 0.7 / 0.45 — 위계 표현용 (coral 농도 단계)
}: {
  step: number;
  label: string;
  caption: string;
  value: number;
  total: number;
  intensity: number;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  // coral 단일 액센트 — intensity 로 단계 표현
  const fillBg = `linear-gradient(90deg, rgba(218,119,86,${0.95 * intensity}) 0%, rgba(218,119,86,${0.75 * intensity}) 100%)`;

  return (
    <div
      role="meter"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label} ${value.toLocaleString("en-US")}명, 비율 ${percent}%`}
      tabIndex={0}
      className="space-y-1.5 rounded-[7px] px-1.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-white/[0.06] text-[9.5px] font-semibold tabular-nums text-white/55 ring-1 ring-white/[0.08]"
            aria-hidden="true"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {step}
          </span>
          <span className="text-[12.5px] font-medium text-white/85 tracking-[-0.005em] truncate">
            {label}
          </span>
          <span className="text-[10.5px] text-white/35 tracking-[-0.005em] truncate">
            {caption}
          </span>
        </div>
        <div
          className="flex items-baseline gap-1.5 shrink-0"
          style={{ fontFeatureSettings: '"tnum", "ss01"' }}
        >
          <span className="text-[13px] font-semibold text-white tabular-nums tracking-[-0.005em]">
            {value.toLocaleString("en-US")}
          </span>
          <span className="text-[11px] text-white/45 tabular-nums tracking-[-0.005em] w-10 text-right">
            {percent}%
          </span>
        </div>
      </div>
      <div
        className="h-2.5 rounded-[5px] overflow-hidden ring-1 ring-white/[0.04]"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        <div
          className="h-full rounded-[5px]"
          style={{
            width: `${Math.max(2, percent)}%`,
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
// Time Distribution — macOS Activity Monitor stacked row
// 시간 가까울수록 coral 진함 (의미 있는 그라데이션)
// =====================================================
function TimeDistributionChart({
  data,
}: {
  data: {
    within1Hour: number;
    within24Hours: number;
    within7Days: number;
    over7Days: number;
    never: number;
  };
}) {
  const total =
    data.within1Hour + data.within24Hours + data.within7Days + data.over7Days + data.never;

  // coral 그라데이션 — 빠를수록 진함, 미제출은 muted white
  const items: Array<{
    label: string;
    value: number;
    fill: string;
    isNever: boolean;
  }> = [
    {
      label: "1시간 이내",
      value: data.within1Hour,
      fill: "rgba(218,119,86,0.95)",
      isNever: false,
    },
    {
      label: "24시간 이내",
      value: data.within24Hours,
      fill: "rgba(218,119,86,0.7)",
      isNever: false,
    },
    {
      label: "7일 이내",
      value: data.within7Days,
      fill: "rgba(218,119,86,0.45)",
      isNever: false,
    },
    {
      label: "7일 초과",
      value: data.over7Days,
      fill: "rgba(218,119,86,0.22)",
      isNever: false,
    },
    {
      label: "미제출",
      value: data.never,
      fill: "rgba(255,255,255,0.18)",
      isNever: true,
    },
  ];

  if (total === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-[11.5px] text-white/35 tracking-[-0.005em]">
        시간 분포 데이터 없음
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return (
          <div
            key={item.label}
            className="flex items-center gap-2.5"
            role="meter"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${item.label} ${item.value}명 ${percent}%`}
          >
            <div
              className="w-20 shrink-0 text-[11.5px] text-white/65 tracking-[-0.005em] truncate"
              title={item.label}
            >
              {item.label}
            </div>
            <div
              className="flex-1 h-2.5 rounded-[4px] overflow-hidden ring-1 ring-white/[0.04]"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <div
                className="h-full rounded-[4px]"
                style={{
                  width: `${Math.max(2, percent)}%`,
                  background: item.fill,
                  transition: `width 380ms ${MAC_EASE}`,
                }}
              />
            </div>
            <div
              className="w-20 shrink-0 text-right text-[10.5px] tabular-nums text-white/55"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              <span className="text-white/85">{item.value.toLocaleString("en-US")}</span>
              <span className="text-white/35">명</span>
              <span className="text-white/30 ml-1">·</span>
              <span className="text-white/45 ml-1">{percent}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================
// Daily Funnel Chart — macOS Calendar 스타일 day cells
// 14일 격자, 가입(white tint) + 첫제출(coral)
// =====================================================
function DailyFunnelChart({
  data,
}: {
  data: Array<{
    date: string;
    signups: number;
    firstSubmits: number;
    conversionRate: number;
  }>;
}) {
  const slice = useMemo(() => data?.slice(-14) ?? [], [data]);

  const maxValue = useMemo(() => {
    if (!slice.length) return 1;
    return Math.max(...slice.map((d) => Math.max(d.signups, d.firstSubmits)), 1);
  }, [slice]);

  if (!slice.length) {
    return (
      <div className="flex items-center justify-center py-6 text-[11.5px] text-white/35 tracking-[-0.005em]">
        일별 데이터 없음
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-3 text-[10.5px] tracking-[-0.005em]">
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-sm bg-white/45 ring-1 ring-white/10"
          />
          <span className="text-white/55">가입</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-sm bg-[var(--color-claude-coral)] ring-1 ring-[var(--color-claude-coral)]/25"
          />
          <span className="text-white/55">첫 제출</span>
        </div>
        <span className="ml-auto text-[10px] text-white/30 tabular-nums">
          최대 <span className="text-white/55 font-medium">{maxValue}</span>
        </span>
      </div>

      {/* Chart */}
      <div
        className="flex items-end gap-1.5 h-[120px] px-0.5"
        role="img"
        aria-label={`일별 가입 vs 첫 제출 추이 — 최근 ${slice.length}일`}
      >
        {slice.map((item) => {
          const signupHeight = (item.signups / maxValue) * 100;
          const submitHeight = (item.firstSubmits / maxValue) * 100;
          const [, month, day] = item.date.split("-");

          return (
            <div
              key={item.date}
              tabIndex={0}
              role="group"
              aria-label={`${item.date} 가입 ${item.signups}명 첫 제출 ${item.firstSubmits}명 전환율 ${item.conversionRate}%`}
              title={`${item.date} · 가입 ${item.signups} · 첫 제출 ${item.firstSubmits} · 전환율 ${item.conversionRate}%`}
              className="group flex-1 flex flex-col items-center gap-1.5 rounded-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 cursor-default"
              style={{ transition: `background-color 160ms ${MAC_EASE}` }}
            >
              <div className="w-full flex gap-0.5 items-end" style={{ height: "92px" }}>
                <div className="flex-1 flex flex-col justify-end h-full">
                  <div
                    className="rounded-t-[3px]"
                    style={{
                      height: `${Math.max(signupHeight, item.signups > 0 ? 4 : 0)}%`,
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.35) 100%)",
                      transition: `height 380ms ${MAC_EASE}`,
                    }}
                  />
                </div>
                <div className="flex-1 flex flex-col justify-end h-full">
                  <div
                    className="rounded-t-[3px]"
                    style={{
                      height: `${Math.max(submitHeight, item.firstSubmits > 0 ? 4 : 0)}%`,
                      background:
                        "linear-gradient(180deg, rgba(218,119,86,0.95) 0%, rgba(218,119,86,0.7) 100%)",
                      transition: `height 380ms ${MAC_EASE}`,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                    }}
                  />
                </div>
              </div>
              <span
                className="text-[9.5px] text-white/35 tabular-nums group-hover:text-white/65 tracking-[-0.005em]"
                style={{
                  fontFeatureSettings: '"tnum"',
                  transition: `color 160ms ${MAC_EASE}`,
                }}
              >
                {Number(month)}/{Number(day)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================
// Recent Conversions — macOS Contacts row
// avatar + name + speed chip + duration
// =====================================================
function RecentConversionsList({
  conversions,
}: {
  conversions: Array<{
    username: string;
    avatar_url: string | null;
    signed_up_at: string;
    first_submit_at: string;
    time_to_submit_hours: number;
  }>;
}) {
  if (!conversions?.length) {
    return (
      <div className="flex items-center justify-center py-6 text-[11.5px] text-white/35 tracking-[-0.005em]">
        최근 전환 데이터 없음
      </div>
    );
  }

  const formatTimeAgo = (hours: number): string => {
    if (hours < 1) return "<1h";
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
  };

  // 시멘틱 dot (큰 텍스트는 white, 작은 dot 로 시그널) — analytics/page.tsx 패턴 일관
  const getSpeedBadge = (hours: number) => {
    if (hours <= 1) return { dot: "bg-emerald-300", label: "즉시" };
    if (hours <= 24) return { dot: "bg-emerald-300", label: "빠름" };
    if (hours <= 168) return { dot: "bg-amber-300", label: "보통" };
    return { dot: "bg-rose-300", label: "느림" };
  };

  return (
    <ul className="space-y-1" role="list">
      {conversions.map((user, index) => {
        const badge = getSpeedBadge(user.time_to_submit_hours);
        return (
          <li
            key={`${user.username}-${index}`}
            className="flex items-center justify-between gap-3 rounded-[7px] px-2 py-1.5"
            style={{ transition: `background-color 160ms ${MAC_EASE}` }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="h-6 w-6 rounded-full overflow-hidden shrink-0 ring-1 ring-white/[0.08]"
                style={{ background: "rgba(255,255,255,0.06)" }}
                aria-hidden="true"
              >
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-white/55">
                    {user.username?.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
              </div>
              <span className="text-[12px] font-medium text-white/90 tracking-[-0.005em] truncate max-w-[120px]">
                {user.username || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium text-white/65 ring-1 ring-white/[0.08] bg-white/[0.04] tracking-[-0.005em]"
                aria-label={`전환 속도: ${badge.label}`}
              >
                <span aria-hidden="true" className={`h-1 w-1 rounded-full ${badge.dot}`} />
                <span>{badge.label}</span>
              </span>
              <span
                className="tabular-nums text-[11px] text-white/55 w-8 text-right tracking-[-0.005em]"
                style={{ fontFeatureSettings: '"tnum"' }}
                aria-label={`${user.time_to_submit_hours}시간`}
              >
                {formatTimeAgo(user.time_to_submit_hours)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// =====================================================
// Insight Card — macOS Notification Center 스타일
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
  // 시멘틱 dot + neutral text (analytics 패턴)
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
// Main
// =====================================================
export default function FunnelsPage() {
  const [days, setDays] = useState<PeriodValue>(30);
  const { data, isLoading, error, dataUpdatedAt } = useFunnelAnalytics({ days });

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
          <div className="flex items-center gap-2 mb-1.5">
            <Filter className="h-3.5 w-3.5 text-white/40" strokeWidth={1.75} aria-hidden="true" />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40">
              Analytics · Funnels
            </span>
          </div>
          <h1
            className="text-[20px] font-semibold leading-none tracking-[-0.01em] text-white/95"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            퍼널 분석
          </h1>
          <p className="mt-1.5 text-[12px] text-white/45 tracking-[-0.005em]">
            가입 → 첫 제출 → 활성화 전환 추적
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
          <PeriodSegmented value={days} onChange={setDays} />
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
                잠시 후 다시 시도해주세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── Content ─────────── */}
      {!isLoading && data && (
        <>
          {/* Summary KPI — Stickiness 패턴 일관 */}
          <section aria-labelledby="funnel-summary-heading">
            <div className="flex items-center gap-1.5 mb-2.5 px-1">
              <h2
                id="funnel-summary-heading"
                className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40"
              >
                요약 지표
              </h2>
              <span className="text-[10.5px] text-white/30 tracking-[-0.005em]">Funnel KPIs</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                title="총 가입자"
                subtitle="Total Signups"
                value={data.summary.totalSignups.toLocaleString("en-US")}
                hint="명"
                icon={UserPlus}
              />
              <MetricCard
                title="제출 완료"
                subtitle="Users with Submit"
                value={data.summary.usersWithSubmit.toLocaleString("en-US")}
                hint={`${data.summary.signupToSubmitRate}%`}
                icon={Send}
                signal={
                  data.summary.signupToSubmitRate >= 50
                    ? { dot: "bg-emerald-300", label: "양호" }
                    : { dot: "bg-amber-300", label: "주의" }
                }
              />
              <MetricCard
                title="활성 사용자"
                subtitle="Activated (2회+)"
                value={data.summary.activatedUsers.toLocaleString("en-US")}
                hint="2회+ 제출"
                icon={Flame}
                signal={
                  data.summary.activationRate >= 30
                    ? { dot: "bg-emerald-300", label: "양호" }
                    : { dot: "bg-amber-300", label: "주의" }
                }
              />
              <MetricCard
                title="활성화율"
                subtitle="Activation Rate"
                value={`${data.summary.activationRate}%`}
                hint="제출자 중"
                icon={Zap}
                accent="coral"
              />
            </div>
          </section>

          {/* Main Funnel — Activity Monitor 스타일 (coral 단계 농도) */}
          <GlassCard title="핵심 퍼널" caption="Conversion Steps" icon={Filter}>
            <div className="space-y-2">
              <FunnelBar
                step={1}
                label="가입"
                caption="Signup"
                value={data.summary.totalSignups}
                total={data.summary.totalSignups}
                intensity={1.0}
              />
              <FunnelBar
                step={2}
                label="첫 CLI 제출"
                caption="First Submit"
                value={data.summary.usersWithSubmit}
                total={data.summary.totalSignups}
                intensity={0.72}
              />
              <FunnelBar
                step={3}
                label="활성화"
                caption="2회+ 제출"
                value={data.summary.activatedUsers}
                total={data.summary.usersWithSubmit}
                intensity={0.45}
              />
            </div>
          </GlassCard>

          {/* Time Distribution + Recent Conversions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <GlassCard title="가입 → 첫 제출 시간 분포" caption="Time to First Submit" icon={Clock}>
              <TimeDistributionChart data={data.timeToFirstSubmit} />
            </GlassCard>

            <GlassCard
              title="최근 전환 사용자"
              caption="Recent Conversions"
              icon={Rocket}
              trailing={
                <span className="text-[10px] text-white/30 tabular-nums tracking-[-0.005em]">
                  최근 {data.recentConversions.length}명
                </span>
              }
            >
              <RecentConversionsList conversions={data.recentConversions} />
            </GlassCard>
          </div>

          {/* Daily Funnel Trend — Calendar 격자 */}
          <GlassCard
            title="일별 가입 vs 첫 제출"
            caption="Daily Funnel Trend"
            icon={CalendarDays}
            trailing={
              <span className="text-[10px] text-white/30 tabular-nums tracking-[-0.005em]">
                최근 14일
              </span>
            }
          >
            <DailyFunnelChart data={data.dailyFunnel} />
          </GlassCard>

          {/* Insights — Notification Center 스타일 */}
          <GlassCard title="인사이트" caption="Insights" icon={Lightbulb}>
            <div className="space-y-2">
              {data.summary.signupToSubmitRate < 50 && (
                <InsightItem
                  variant="warn"
                  icon={AlertTriangle}
                  title={
                    <>
                      가입 → 제출 전환율이{" "}
                      <span
                        className="text-white font-medium tabular-nums"
                        style={{ fontFeatureSettings: '"tnum"' }}
                      >
                        {data.summary.signupToSubmitRate}%
                      </span>
                      로 낮습니다
                    </>
                  }
                  description="온보딩 개선 또는 CLI 실행 안내 강화를 고려하세요."
                />
              )}

              {data.timeToFirstSubmit.never > data.timeToFirstSubmit.within24Hours && (
                <InsightItem
                  variant="alert"
                  icon={Users}
                  title={
                    <>
                      미제출 사용자{" "}
                      <span
                        className="text-white font-medium tabular-nums"
                        style={{ fontFeatureSettings: '"tnum"' }}
                      >
                        {data.timeToFirstSubmit.never.toLocaleString("en-US")}
                      </span>
                      명이 24시간 내 제출자보다 많습니다
                    </>
                  }
                  description="가입 직후 CLI 실행 유도가 핵심입니다."
                />
              )}

              {data.summary.signupToSubmitRate >= 50 && (
                <InsightItem
                  variant="good"
                  icon={CheckCircle2}
                  title={
                    <>
                      가입 → 제출 전환율{" "}
                      <span
                        className="text-white font-medium tabular-nums"
                        style={{ fontFeatureSettings: '"tnum"' }}
                      >
                        {data.summary.signupToSubmitRate}%
                      </span>
                      로 양호합니다
                    </>
                  }
                  description="현재 온보딩이 효과적으로 작동 중입니다."
                />
              )}

              {data.summary.activationRate >= 30 && (
                <InsightItem
                  variant="good"
                  icon={TrendingUp}
                  title={
                    <>
                      활성화율{" "}
                      <span
                        className="text-white font-medium tabular-nums"
                        style={{ fontFeatureSettings: '"tnum"' }}
                      >
                        {data.summary.activationRate}%
                      </span>
                      로 건전한 수준입니다
                    </>
                  }
                  description="첫 제출자 중 다회 제출자가 안정적으로 유지되고 있습니다."
                />
              )}

              {data.summary.signupToSubmitRate >= 50 &&
                data.summary.activationRate < 30 &&
                data.timeToFirstSubmit.never <= data.timeToFirstSubmit.within24Hours && (
                  <InsightItem
                    variant="warn"
                    icon={Activity}
                    title={
                      <>
                        활성화율이{" "}
                        <span
                          className="text-white font-medium tabular-nums"
                          style={{ fontFeatureSettings: '"tnum"' }}
                        >
                          {data.summary.activationRate}%
                        </span>
                        로 낮습니다
                      </>
                    }
                    description="첫 제출 이후 재제출을 유도하는 워크플로우 개선을 고려하세요."
                  />
                )}
            </div>
          </GlassCard>

          {/* Empty State — coral subtle */}
          {data.summary.totalSignups === 0 && (
            <div
              className="rounded-[9px] px-4 py-3.5 ring-1 ring-white/[0.06]"
              style={{
                background: "rgba(218,119,86,0.04)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
              }}
            >
              <div className="flex items-start gap-2.5">
                <Sparkles
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-claude-coral)]/85"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-white/90 tracking-[-0.005em] mb-0.5">
                    퍼널 데이터 수집 중
                  </div>
                  <p className="text-[11.5px] text-white/55 tracking-[-0.005em] leading-relaxed">
                    선택한 기간에 가입자가 없습니다. 기간을 늘리거나 신규 가입을 기다려주세요.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
