"use client";

import { useState, useMemo } from "react";
import {
  AlertTriangle,
  Calendar,
  Flag,
  Gauge,
  Globe2,
  Info,
  Lightbulb,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAnalyticsUsers } from "@/hooks/use-admin-analytics";
import { InfoPopover, METRIC_INFO } from "@/components/admin/InfoPopover";
import type { MetricWithTrend } from "@/lib/types/analytics";

// =====================================================
// macOS Big Sur+ Easing — traffic / funnels / submit-logs 와 동일
// =====================================================
const MAC_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// =====================================================
// Period — traffic / funnels 와 100% 동일 NSSegmentedControl 패턴
// API 값 "-1d/-7d/-14d/-30d/-90d" 100% 유지 (사용자 facing diff = 0)
// =====================================================
const PERIOD_OPTIONS = [
  { label: "오늘", value: "-1d" },
  { label: "7일", value: "-7d" },
  { label: "14일", value: "-14d" },
  { label: "30일", value: "-30d" },
  { label: "90일", value: "-90d" },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

// =====================================================
// GlassCard — frosted glass container (traffic 와 동일)
// =====================================================
function GlassCard({
  children,
  title,
  caption,
  icon: Icon,
  trailing,
  padded = true,
  className = "",
  info,
}: {
  children: React.ReactNode;
  title?: string;
  caption?: string;
  icon?: LucideIcon;
  trailing?: React.ReactNode;
  padded?: boolean;
  className?: string;
  info?: React.ReactNode;
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
            {info}
          </div>
          {trailing}
        </div>
      )}
      {children}
    </div>
  );
}

// =====================================================
// PeriodSegmented — traffic / funnels 와 100% 동일 NSSegmentedControl
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
// MetricCard — traffic SourceCard / funnels MetricCard 와 시각 일관
// trend dot + tabular-nums + ss01/tnum/cv11
// =====================================================
function MetricCard({
  title,
  subtitle,
  metric,
  infoKey,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  metric: MetricWithTrend;
  infoKey?: keyof typeof METRIC_INFO;
  icon: LucideIcon;
}) {
  const info = infoKey ? METRIC_INFO[infoKey] : null;

  // semantic dot (큰 텍스트는 white, 작은 dot 로 시그널)
  const trendConfig = {
    up: { dot: "bg-emerald-300", icon: TrendingUp, color: "text-emerald-300" },
    down: { dot: "bg-rose-300", icon: TrendingDown, color: "text-rose-300" },
    neutral: { dot: "bg-white/35", icon: TrendingUp, color: "text-white/45" },
  }[metric.trend];
  const TrendIcon = trendConfig.icon;

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
            {info && (
              <InfoPopover
                title={info.title}
                description={info.description}
                insights={info.insights}
              />
            )}
          </div>
          <div className="mt-0.5 text-[10px] text-white/35 tracking-[-0.005em]">{subtitle}</div>
          <div
            className="mt-2.5 text-[28px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-white"
            style={{ fontFeatureSettings: '"ss01", "tnum", "cv11"' }}
            title={`${metric.value.toLocaleString("en-US")} (이전 기간 ${metric.previousValue.toLocaleString("en-US")})`}
          >
            {metric.value.toLocaleString("en-US")}
          </div>
          <div className="mt-2.5 flex items-center gap-2 min-h-[1rem]">
            <span
              className={`inline-flex items-center gap-1 text-[10.5px] tabular-nums tracking-[-0.005em] ${trendConfig.color}`}
              style={{ fontFeatureSettings: '"tnum"' }}
              aria-label={`이전 기간 대비 ${metric.trend === "up" ? "증가" : metric.trend === "down" ? "감소" : "변화 없음"} ${Math.abs(metric.changePercent).toFixed(1)}%`}
            >
              <span aria-hidden="true" className={`h-1 w-1 rounded-full ${trendConfig.dot}`} />
              <TrendIcon className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />
              <span>{Math.abs(metric.changePercent).toFixed(1)}%</span>
            </span>
            <span className="text-[10.5px] text-white/35 tracking-[-0.005em]">vs 이전 기간</span>
          </div>
        </div>
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ring-1 bg-white/[0.06] text-white/75 ring-white/[0.08]"
          aria-hidden="true"
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}

// =====================================================
// StickinessCard — DAU/MAU 비율 (funnels 와 시각 일관)
// 시멘틱 dot 으로 등급 표시 (3 색 노이즈 제거 → coral 단일 + dot)
// =====================================================
function StickinessCard({ dau, mau }: { dau: number; mau: number }) {
  const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;

  // semantic dot — coral 단일 색 유지, 등급은 dot 로
  const grade =
    stickiness >= 20
      ? {
          dot: "bg-emerald-300",
          label: "높음",
          chipBg: "bg-emerald-300/10",
          chipRing: "ring-emerald-300/22",
        }
      : stickiness >= 10
        ? {
            dot: "bg-amber-300",
            label: "보통",
            chipBg: "bg-amber-300/10",
            chipRing: "ring-amber-300/22",
          }
        : {
            dot: "bg-rose-300",
            label: "낮음",
            chipBg: "bg-rose-300/10",
            chipRing: "ring-rose-300/22",
          };

  // coral intensity bar — stickiness % 시각화 (캡 50% 표준)
  const fillPercent = Math.min(stickiness / 50, 1) * 100;
  const fillBg = `linear-gradient(90deg, rgba(218,119,86,0.95) 0%, rgba(218,119,86,0.7) 100%)`;

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
              서비스 점착도
            </span>
            <InfoPopover
              title="서비스 점착도 (Stickiness)"
              description="DAU/MAU 비율로, 월간 사용자 중 매일 방문하는 사용자 비율을 나타냅니다."
              formula="(DAU / MAU) × 100"
              insights={[
                "20% 이상이면 높은 점착도입니다",
                "소셜 앱은 50%+, 유틸리티는 10-20%가 일반적입니다",
                "이 수치가 높을수록 사용자가 자주 재방문합니다",
              ]}
            />
          </div>
          <div className="mt-0.5 text-[10px] text-white/35 tracking-[-0.005em]">DAU/MAU 비율</div>
          <div
            className="mt-2.5 text-[28px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-white"
            style={{ fontFeatureSettings: '"ss01", "tnum", "cv11"' }}
          >
            {stickiness}
            <span className="text-[16px] text-white/55 ml-0.5">%</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 min-h-[1rem]">
            <span
              className={`inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium tracking-[-0.005em] ring-1 ${grade.chipBg} ${grade.chipRing}`}
              aria-label={`점착도 등급 ${grade.label}`}
            >
              <span aria-hidden="true" className={`h-1 w-1 rounded-full ${grade.dot}`} />
              <span className="text-white/85">{grade.label}</span>
            </span>
          </div>
        </div>
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ring-1 bg-white/[0.06] text-white/75 ring-white/[0.08]"
          aria-hidden="true"
        >
          <Gauge className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
      </div>
      {/* coral intensity bar — 캡 50% 표준 */}
      <div
        className="mt-3 h-1.5 rounded-[3px] overflow-hidden ring-1 ring-white/[0.04]"
        style={{ background: "rgba(255,255,255,0.04)" }}
        role="meter"
        aria-valuenow={stickiness}
        aria-valuemin={0}
        aria-valuemax={50}
        aria-label="점착도 시각 표시 (캡 50%)"
      >
        <div
          className="h-full rounded-[3px]"
          style={{
            width: `${Math.max(2, fillPercent)}%`,
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
// getFlagEmoji — country code → flag
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
// CountryList — macOS Finder list view (sorted list 패턴)
// sticky thead + font-mono numerics + coral intensity bar
// =====================================================
interface CountryRow {
  country: string;
  countryCode: string;
  users: number;
  percentage: number;
}

function CountryList({ countries }: { countries: CountryRow[] }) {
  const maxPercent = useMemo(() => Math.max(...countries.map((c) => c.percentage), 1), [countries]);

  if (!countries?.length) {
    return (
      <div className="flex items-center justify-center py-8 text-[11.5px] text-white/35 tracking-[-0.005em]">
        국가별 데이터 없음
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
            <th
              scope="col"
              className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 border-b border-white/[0.08] text-left w-[44px]"
            >
              #
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 border-b border-white/[0.08] text-left"
            >
              국가
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 border-b border-white/[0.08] text-right"
            >
              사용자
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 border-b border-white/[0.08] text-right"
            >
              비율
            </th>
          </tr>
        </thead>
        <tbody>
          {countries.map((country, index) => {
            const isTop = index === 0;
            const rank = index + 1;
            // top-3 강조 (rank → coral intensity, psyche-persuasion gamification)
            const rankIntensity = rank === 1 ? 1.0 : rank === 2 ? 0.7 : rank === 3 ? 0.45 : 0;
            const rankColor = rank <= 3 ? `rgba(218,119,86,${0.95 * rankIntensity})` : undefined;
            const fillBg = `linear-gradient(90deg, rgba(218,119,86,0.95) 0%, rgba(218,119,86,0.7) 100%)`;
            const fillPercent = Math.min((country.percentage / maxPercent) * 100, 100);

            return (
              <tr
                key={country.countryCode}
                className={`group ${isTop ? "bg-white/[0.025]" : ""}`}
                style={{ transition: `background-color 160ms ${MAC_EASE}` }}
                aria-label={`${rank}위 ${country.country} ${country.users.toLocaleString("en-US")}명 ${country.percentage}%`}
              >
                <td
                  className="px-3 py-2 border-b border-white/[0.04] group-hover:bg-white/[0.02] text-[11.5px] font-mono tabular-nums tracking-[-0.005em]"
                  style={{
                    fontFeatureSettings: '"tnum"',
                    color: rank <= 3 ? rankColor : undefined,
                  }}
                >
                  <span className={rank > 3 ? "text-white/40" : "font-semibold"}>{rank}</span>
                </td>
                <td className="px-3 py-2 border-b border-white/[0.04] group-hover:bg-white/[0.02]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-base leading-none shrink-0"
                      aria-hidden="true"
                      style={{ fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", sans-serif' }}
                    >
                      {getFlagEmoji(country.countryCode)}
                    </span>
                    <span
                      className="text-[12.5px] font-medium text-white/90 tracking-[-0.005em] truncate"
                      title={country.country}
                    >
                      {country.country}
                    </span>
                    <span
                      className="text-[10px] text-white/35 font-mono tracking-[-0.005em] shrink-0"
                      style={{ fontFeatureSettings: '"ss01"' }}
                    >
                      {country.countryCode}
                    </span>
                    {isTop && (
                      <span
                        className="inline-flex items-center rounded-[4px] px-1.5 py-0 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-claude-coral)] bg-[var(--color-claude-coral)]/12 ring-1 ring-[var(--color-claude-coral)]/22 shrink-0"
                        aria-label="최상위 국가"
                      >
                        TOP
                      </span>
                    )}
                  </div>
                </td>
                <td
                  className="px-3 py-2 text-right text-[12.5px] text-white/90 font-mono tabular-nums tracking-[-0.005em] border-b border-white/[0.04] group-hover:bg-white/[0.02]"
                  style={{ fontFeatureSettings: '"tnum", "ss01"' }}
                >
                  {country.users.toLocaleString("en-US")}
                </td>
                <td className="px-3 py-2 text-right border-b border-white/[0.04] group-hover:bg-white/[0.02]">
                  <div className="flex items-center justify-end gap-2">
                    <div
                      className="w-16 h-1.5 rounded-[3px] overflow-hidden ring-1 ring-white/[0.04]"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                      <div
                        className="h-full rounded-[3px]"
                        style={{
                          width: `${Math.max(2, fillPercent)}%`,
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
                      {country.percentage}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// =====================================================
// InsightItem — macOS Notification Center (traffic / funnels 와 일관)
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
// UsersInsights — DAU/MAU + 국가 집중도 시각 일관
// =====================================================
function UsersInsights({
  dau,
  mau,
  byCountry,
}: {
  dau: number;
  mau: number;
  byCountry: CountryRow[];
}) {
  const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;
  const topCountry = byCountry[0];
  const top3Sum = byCountry.slice(0, 3).reduce((sum, c) => sum + c.percentage, 0);

  return (
    <GlassCard title="인사이트" caption="Insights" icon={Lightbulb}>
      <div className="space-y-2">
        {/* Stickiness 진단 */}
        {stickiness >= 20 ? (
          <InsightItem
            variant="good"
            icon={Gauge}
            title={
              <>
                서비스 점착도{" "}
                <span
                  className="text-white font-medium tabular-nums"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  {stickiness}%
                </span>
                로 우수
              </>
            }
            description="월간 사용자 중 매일 방문하는 비율이 건강한 수준입니다."
          />
        ) : stickiness >= 10 ? (
          <InsightItem
            variant="warn"
            icon={Gauge}
            title={
              <>
                서비스 점착도{" "}
                <span
                  className="text-white font-medium tabular-nums"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  {stickiness}%
                </span>
                로 보통
              </>
            }
            description="재방문 빈도를 끌어올릴 여지가 있습니다."
          />
        ) : (
          <InsightItem
            variant="alert"
            icon={Gauge}
            title={
              <>
                서비스 점착도{" "}
                <span
                  className="text-white font-medium tabular-nums"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  {stickiness}%
                </span>
                로 낮음
              </>
            }
            description="재방문 유도 메커니즘 점검이 필요합니다."
          />
        )}

        {/* 최상위 국가 */}
        {topCountry && (
          <InsightItem
            variant="alert"
            icon={Flag}
            title={
              <>
                <span className="text-white font-medium tracking-[-0.005em]">
                  {topCountry.country}
                </span>{" "}
                가입자 1위 (
                <span
                  className="text-white font-medium tabular-nums"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  {topCountry.percentage}%
                </span>
                )
              </>
            }
            description={`${topCountry.users.toLocaleString("en-US")}명이 ${topCountry.country}에서 가입했습니다.`}
          />
        )}

        {/* 집중도 */}
        {byCountry.length >= 3 && (
          <InsightItem
            variant={top3Sum >= 80 ? "warn" : "good"}
            icon={Globe2}
            title={
              <>
                상위 3개국 집중도{" "}
                <span
                  className="text-white font-medium tabular-nums"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  {top3Sum.toFixed(1)}%
                </span>
              </>
            }
            description={
              top3Sum >= 80
                ? "특정 국가 집중도가 높습니다. 글로벌 확장을 고려하세요."
                : "건강한 지역 분포를 보입니다."
            }
          />
        )}
      </div>
    </GlassCard>
  );
}

// =====================================================
// Main
// =====================================================
export default function UsersAnalyticsPage() {
  const [dateRange, setDateRange] = useState<PeriodValue>("-30d");
  const { data: usersData, isLoading, error } = useAnalyticsUsers({ dateFrom: dateRange });

  return (
    <div
      className="space-y-5 max-w-6xl"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
        fontFeatureSettings: '"ss01", "cv11", "cv03"',
      }}
    >
      {/* ─────────── Header — traffic / funnels 와 100% 동일 패턴 ─────────── */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Users className="h-3.5 w-3.5 text-white/40" strokeWidth={1.75} aria-hidden="true" />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40">
              Analytics · Users
            </span>
          </div>
          <h1
            className="text-[20px] font-semibold leading-none tracking-[-0.01em] text-white/95"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            웹 트래픽 분석
          </h1>
          <p className="mt-1.5 text-[12px] text-white/45 tracking-[-0.005em]">
            웹사이트 고유 방문자 수 (PostHog 기반) · 뉴스 SEO 유입 포함
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
                PostHog 연결을 확인하거나 환경 변수가 올바르게 설정되었는지 확인해주세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── PostHog 미설정 경고 ─────────── */}
      {usersData?.error && (
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
                {usersData.error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── Content ─────────── */}
      {!isLoading && usersData && !usersData.error && (
        <>
          {/* Metrics Grid — traffic / funnels MetricCard 패턴 일관 */}
          <section aria-labelledby="users-summary-heading">
            <div className="flex items-center gap-1.5 mb-2.5 px-1">
              <h2
                id="users-summary-heading"
                className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40"
              >
                활성 사용자
              </h2>
              <span className="text-[10.5px] text-white/30 tracking-[-0.005em]">Active Users</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                title="DAU"
                subtitle="Daily Active Users"
                metric={usersData.metrics.dau}
                infoKey="dau"
                icon={Calendar}
              />
              <MetricCard
                title="WAU"
                subtitle="Weekly Active Users"
                metric={usersData.metrics.wau}
                infoKey="wau"
                icon={Users}
              />
              <MetricCard
                title="MAU"
                subtitle="Monthly Active Users"
                metric={usersData.metrics.mau}
                infoKey="mau"
                icon={Users}
              />
              <StickinessCard dau={usersData.metrics.dau.value} mau={usersData.metrics.mau.value} />
            </div>
          </section>

          {/* Country Breakdown + Insights — 2:1 grid (traffic 와 일관) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" aria-label="국가 분포와 인사이트">
            <div className="lg:col-span-2">
              <GlassCard
                title="국가별 가입 사용자"
                caption="By Country"
                icon={Globe2}
                padded={false}
                trailing={
                  <span
                    className="inline-flex items-center rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium text-white/60 ring-1 ring-white/[0.08] bg-white/[0.04] tabular-nums tracking-[-0.005em]"
                    style={{ fontFeatureSettings: '"tnum"' }}
                    title="상위 10개국까지 표시"
                  >
                    <Info
                      className="h-2.5 w-2.5 mr-0.5 text-white/35"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    {usersData.byCountry.length}
                  </span>
                }
                info={
                  <InfoPopover
                    title={METRIC_INFO.country_distribution.title}
                    description={METRIC_INFO.country_distribution.description}
                    insights={METRIC_INFO.country_distribution.insights}
                  />
                }
              >
                <CountryList countries={usersData.byCountry} />
              </GlassCard>
            </div>
            <UsersInsights
              dau={usersData.metrics.dau.value}
              mau={usersData.metrics.mau.value}
              byCountry={usersData.byCountry}
            />
          </div>
        </>
      )}

      {/* ─────────── No Data ─────────── */}
      {!isLoading && usersData && !usersData.error && usersData.metrics.mau.value === 0 && (
        <div
          className="rounded-[9px] px-4 py-3.5 ring-1 ring-amber-300/25"
          style={{
            background: "rgba(252,211,77,0.04)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          <div className="flex items-start gap-2.5">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-white/90 tracking-[-0.005em] mb-0.5">
                데이터 수집 중
              </div>
              <p className="text-[11.5px] text-white/55 tracking-[-0.005em] leading-relaxed">
                PostHog에서 사용자 활동이 감지되면 지표가 표시됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
