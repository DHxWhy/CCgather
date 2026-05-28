"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileText,
  Loader2,
  Newspaper,
  RefreshCw,
  Server,
  Settings as SettingsIcon,
  Users,
  XCircle,
  Youtube,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// =====================================================
// macOS Big Sur+ Easing — 이전 11 페이지 (community / ai-usage / analytics / feedback / deleted-users 등) 100% 동일
// =====================================================
const MAC_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// =====================================================
// API contract types — 변경 X (서버 응답 형태와 100% 동일)
// =====================================================
interface SystemStatus {
  database: {
    status: "healthy" | "error";
    responseTime: number;
  };
  stats: {
    users: number;
    contents: number;
  };
  crawler: {
    newsMode: "on" | "confirm" | "off";
    youtubeMode: "on" | "confirm" | "off";
    lastNewsCrawl: string | null;
    lastYoutubeCrawl: string | null;
  };
  timestamp: string;
}

type CrawlerMode = SystemStatus["crawler"]["newsMode"];

// =====================================================
// Frosted Card — feedback / community / deleted-users 100% 동일
// =====================================================
function GlassCard({
  children,
  padded = true,
  className = "",
}: {
  children: ReactNode;
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
      {children}
    </div>
  );
}

// =====================================================
// StatCard — macOS Widget (feedback / deleted-users 100% 재사용)
// =====================================================
interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: "neutral" | "coral" | "success" | "warning" | "muted";
  caption?: string;
}

function StatCard({ label, value, icon: Icon, accent = "neutral", caption }: StatCardProps) {
  const accentColor =
    accent === "coral"
      ? "text-[var(--color-claude-coral)]"
      : accent === "success"
        ? "text-emerald-300"
        : accent === "warning"
          ? "text-amber-200"
          : accent === "muted"
            ? "text-white/55"
            : "text-white";

  const iconBg =
    accent === "coral"
      ? "bg-[var(--color-claude-coral)]/12 text-[var(--color-claude-coral)] ring-[var(--color-claude-coral)]/20"
      : accent === "success"
        ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
        : accent === "warning"
          ? "bg-amber-400/10 text-amber-200 ring-amber-400/20"
          : accent === "muted"
            ? "bg-white/[0.04] text-white/45 ring-white/[0.06]"
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
        <div className="min-w-0">
          <div
            className={`text-[26px] font-semibold leading-none tabular-nums tracking-[-0.02em] ${accentColor}`}
            style={{ fontFeatureSettings: '"ss01", "tnum", "cv11"' }}
          >
            {value}
          </div>
          <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-white/45">
            {label}
          </div>
          {caption && (
            <div className="mt-0.5 text-[10.5px] text-white/35 tracking-[-0.005em]">{caption}</div>
          )}
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
// Mode meta — single source of truth (tri-state crawler mode)
// =====================================================
const MODE_META: Record<
  CrawlerMode,
  { label: string; dotClass: string; textClass: string; segIndex: 0 | 1 | 2 }
> = {
  on: {
    label: "자동 실행",
    dotClass: "bg-emerald-300",
    textClass: "text-emerald-300",
    segIndex: 0,
  },
  confirm: {
    label: "수동 확인",
    dotClass: "bg-amber-300",
    textClass: "text-amber-200",
    segIndex: 1,
  },
  off: {
    label: "비활성화",
    dotClass: "bg-white/45",
    textClass: "text-white/55",
    segIndex: 2,
  },
};

const MODE_OPTIONS: { value: CrawlerMode; label: string }[] = [
  { value: "on", label: "자동" },
  { value: "confirm", label: "확인" },
  { value: "off", label: "off" },
];

// =====================================================
// NSSegmentedControl — read-only mode display
// community / feedback Segmented 패턴 동일 (aria-readonly)
// =====================================================
function ModeSegmented({ value, ariaLabel }: { value: CrawlerMode; ariaLabel: string }) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-readonly="true"
      className="inline-flex items-center rounded-[7px] p-0.5 ring-1 ring-white/[0.08]"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {MODE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        const isOn = opt.value === "on";
        const isConfirm = opt.value === "confirm";
        const activeClass = isOn
          ? "bg-emerald-400/15 text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          : isConfirm
            ? "bg-amber-400/15 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            : "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]";
        return (
          <span
            key={opt.value}
            role="radio"
            aria-checked={active}
            aria-disabled="true"
            className={`relative inline-flex h-7 items-center px-2.5 text-[11.5px] font-medium tracking-[-0.005em] rounded-[5px] select-none ${
              active ? activeClass : "text-white/40"
            }`}
            style={{ transition: `all 180ms ${MAC_EASE}` }}
          >
            {opt.label}
          </span>
        );
      })}
    </div>
  );
}

// =====================================================
// Formatters
// =====================================================
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString("en-US");
}

function formatRelative(dateString: string | null): string {
  if (!dateString) return "기록 없음";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatExactTime(dateString: string | null): string | null {
  if (!dateString) return null;
  return new Date(dateString).toLocaleString("ko-KR");
}

// =====================================================
// Crawler Row — macOS Status Card
// =====================================================
interface CrawlerRowProps {
  icon: LucideIcon;
  title: string;
  caption: string;
  mode: CrawlerMode;
  lastCrawl: string | null;
}

function CrawlerRow({ icon: Icon, title, caption, mode, lastCrawl }: CrawlerRowProps) {
  const meta = MODE_META[mode];
  return (
    <div
      className="rounded-[9px] p-3.5 ring-1 ring-white/[0.06]"
      style={{ background: "rgba(0,0,0,0.18)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-white/[0.04] ring-1 ring-white/[0.08]"
            aria-hidden="true"
          >
            <Icon className="h-4 w-4 text-white/75" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium text-white/90 tracking-[-0.005em] truncate">
              {title}
            </div>
            <div className="text-[10.5px] text-white/45 tracking-[-0.005em] truncate">
              {caption}
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <ModeSegmented value={mode} ariaLabel={`${title} 모드`} />
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 pt-2.5 border-t border-white/[0.04]">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">
          마지막 크롤
        </span>
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] tabular-nums tracking-[-0.005em] ${meta.textClass}`}
          style={{ fontFeatureSettings: '"tnum"' }}
          title={formatExactTime(lastCrawl) ?? undefined}
        >
          <span aria-hidden="true" className={`h-1 w-1 rounded-full ${meta.dotClass}`} />
          {formatRelative(lastCrawl)}
        </span>
      </div>
    </div>
  );
}

// =====================================================
// Section Header — GlassCard 내부 타이틀
// =====================================================
function SectionTitle({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <Icon className="h-3 w-3 text-white/40 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">
        {label}
      </h2>
    </div>
  );
}

// =====================================================
// DB Status Card — macOS System Settings inspired
// =====================================================
function DbStatusCard({
  status,
  responseTime,
}: {
  status: "healthy" | "error";
  responseTime: number;
}) {
  const isHealthy = status === "healthy";
  const accent = isHealthy
    ? {
        text: "text-emerald-300",
        dot: "bg-emerald-300",
        ringDot: "ring-emerald-300/30",
        icon: "text-emerald-300",
        iconBg: "bg-emerald-400/12 ring-emerald-400/22",
        label: "Healthy",
      }
    : {
        text: "text-rose-300",
        dot: "bg-rose-400",
        ringDot: "ring-rose-400/30",
        icon: "text-rose-300",
        iconBg: "bg-rose-400/12 ring-rose-400/22",
        label: "Error",
      };

  // Latency tier (visual ranking)
  const tier =
    responseTime < 100
      ? { label: "Fast", color: "text-emerald-300" }
      : responseTime < 300
        ? { label: "Normal", color: "text-white/70" }
        : { label: "Slow", color: "text-amber-200" };

  return (
    <GlassCard padded={false}>
      <div className="p-4">
        <SectionTitle icon={Database} label="Database" />
        <div className="flex items-center gap-4">
          {/* Status indicator + icon */}
          <div className="relative shrink-0">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${accent.iconBg}`}
              aria-hidden="true"
            >
              <Server className={`h-6 w-6 ${accent.icon}`} strokeWidth={1.5} />
            </div>
            {/* Pulse dot — animated breath for healthy, static for error */}
            <div
              className={`absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ${accent.ringDot} bg-[#1c1c1e]`}
              aria-hidden="true"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${accent.dot} ${isHealthy ? "animate-pulse" : ""}`}
                style={isHealthy ? { animationDuration: "2.4s" } : undefined}
              />
            </div>
          </div>

          {/* Status info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-[20px] font-semibold leading-none tracking-[-0.01em] ${accent.text}`}
                style={{ fontFeatureSettings: '"ss01"' }}
              >
                {accent.label}
              </span>
              {isHealthy ? (
                <CheckCircle2
                  className="h-3.5 w-3.5 text-emerald-300/70"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              ) : (
                <XCircle
                  className="h-3.5 w-3.5 text-rose-300/70"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="mt-1 text-[11px] text-white/45 tracking-[-0.005em]">
              Supabase Postgres · users 테이블 응답
            </div>
          </div>

          {/* Response time pill */}
          <div
            className="shrink-0 rounded-[9px] px-3 py-2 ring-1 ring-white/[0.06]"
            style={{ background: "rgba(0,0,0,0.22)" }}
          >
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40 leading-none mb-1">
              응답 시간
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-[18px] font-semibold tabular-nums tracking-[-0.01em] text-white/95"
                style={{ fontFeatureSettings: '"tnum"' }}
              >
                {responseTime}
              </span>
              <span className="text-[10.5px] text-white/45 tracking-[-0.005em]">ms</span>
              <span className={`ml-1 text-[10px] font-medium tracking-[-0.005em] ${tier.color}`}>
                · {tier.label}
              </span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// =====================================================
// Main Page
// =====================================================
export default function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/system", { signal });

      if (!response.ok) {
        throw new Error("Failed to fetch system status");
      }

      const data = (await response.json()) as SystemStatus;
      setStatus(data);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      console.error("Failed to fetch system status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSystemStatus(controller.signal);
    return () => controller.abort();
  }, [fetchSystemStatus]);

  const refresh = useCallback(() => {
    void fetchSystemStatus();
  }, [fetchSystemStatus]);

  // =====================================================
  // Wrapping container — SF Pro 패밀리 + 공통 폰트 피쳐
  // =====================================================
  const containerProps = {
    className: "space-y-5 max-w-6xl",
    style: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
      fontFeatureSettings: '"ss01", "cv11", "cv03"',
    } as const,
  };

  // =====================================================
  // Header — feedback / community 패턴 100% 동일 (Cupid M3 fix: h2 → h1)
  // =====================================================
  const Header = (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1
          className="text-[20px] font-semibold leading-none tracking-[-0.01em] text-white/95"
          style={{ fontFeatureSettings: '"ss01"' }}
        >
          시스템 상태
        </h1>
        <p className="mt-1.5 text-[12px] text-white/45 tracking-[-0.005em]">
          데이터베이스 · 트래픽 통계 · 크롤러 상태 실시간 모니터링
        </p>
      </div>
      <button
        type="button"
        onClick={refresh}
        disabled={loading}
        aria-label="시스템 상태 새로고침"
        className="inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[11.5px] font-medium text-white/75 bg-white/[0.04] ring-1 ring-white/[0.08] hover:bg-white/[0.07] hover:text-white/95 hover:ring-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98] disabled:opacity-60"
        style={{ transition: `all 180ms ${MAC_EASE}` }}
      >
        <RefreshCw
          className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          strokeWidth={1.75}
          aria-hidden="true"
        />
        새로고침
      </button>
    </div>
  );

  // =====================================================
  // Loading state — skeleton (StatCard grid 미리 자리 점유)로 layout shift 제거
  // =====================================================
  if (loading && !status) {
    return (
      <div {...containerProps} aria-busy="true" aria-live="polite">
        {Header}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded-[9px] p-4 ring-1 ring-white/[0.08]"
              style={{
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2 w-full">
                  <div className="h-[26px] w-16 rounded-md bg-white/[0.06] animate-pulse" />
                  <div className="h-[11px] w-20 rounded-sm bg-white/[0.04] animate-pulse" />
                </div>
                <div className="h-7 w-7 rounded-[7px] bg-white/[0.04] ring-1 ring-white/[0.06] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <GlassCard padded={true} className="min-h-[120px]">
          <div className="flex items-center justify-center py-10">
            <div className="inline-flex items-center gap-2 text-[12px] text-white/55 tracking-[-0.005em]">
              <Loader2
                className="h-3.5 w-3.5 animate-spin text-[var(--color-claude-coral)]"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span>시스템 상태 확인 중…</span>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  // =====================================================
  // Error state — frosted alert (Cupid 패턴 일관)
  // =====================================================
  if (error || !status) {
    return (
      <div {...containerProps}>
        {Header}
        <GlassCard padded={true}>
          <div className="flex items-start gap-3 mb-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-400/12 ring-1 ring-rose-400/22 text-rose-300"
              aria-hidden="true"
            >
              <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h2
                className="text-[14px] font-semibold tracking-[-0.01em] text-rose-300"
                style={{ fontFeatureSettings: '"ss01"' }}
              >
                시스템 상태를 불러올 수 없습니다
              </h2>
              <p className="mt-1 text-[11.5px] text-white/55 tracking-[-0.005em]">
                {error || "알 수 없는 오류가 발생했습니다."}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={refresh}
              aria-label="다시 시도"
              className="inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[11.5px] font-medium text-white/85 bg-[var(--color-claude-coral)]/12 ring-1 ring-[var(--color-claude-coral)]/22 hover:bg-[var(--color-claude-coral)]/18 hover:ring-[var(--color-claude-coral)]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-claude-coral)]/45 active:scale-[0.98]"
              style={{ transition: `all 180ms ${MAC_EASE}` }}
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              다시 시도
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  // =====================================================
  // Main render
  // =====================================================
  const dbStatusBadge: { dotClass: string; text: string; textClass: string } =
    status.database.status === "healthy"
      ? { dotClass: "bg-emerald-300", text: "Healthy", textClass: "text-emerald-300" }
      : { dotClass: "bg-rose-400", text: "Error", textClass: "text-rose-300" };

  return (
    <div {...containerProps}>
      {Header}

      {/* SR-only live region — 새로고침 후 상태 안내 */}
      <div className="sr-only" role="status" aria-live="polite">
        시스템 상태 {dbStatusBadge.text}. 사용자 {formatNumber(status.stats.users)}명, 콘텐츠{" "}
        {formatNumber(status.stats.contents)}개. 마지막 갱신 {formatRelative(status.timestamp)}.
      </div>

      {/* Stats Grid — macOS Widget */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="DB Status"
          value={dbStatusBadge.text}
          icon={Database}
          accent={status.database.status === "healthy" ? "success" : "warning"}
          caption={`${status.database.responseTime}ms 응답`}
        />
        <StatCard
          label="사용자"
          value={formatNumber(status.stats.users)}
          icon={Users}
          accent="coral"
          caption="등록된 계정"
        />
        <StatCard
          label="콘텐츠"
          value={formatNumber(status.stats.contents)}
          icon={FileText}
          accent="neutral"
          caption="누적 게시물"
        />
        <StatCard
          label="마지막 갱신"
          value={formatRelative(status.timestamp)}
          icon={Clock}
          accent="muted"
          caption={formatExactTime(status.timestamp) ?? undefined}
        />
      </div>

      {/* Database Detail — macOS System Settings 카드 */}
      <DbStatusCard status={status.database.status} responseTime={status.database.responseTime} />

      {/* Crawler Status */}
      <GlassCard padded={true}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <SectionTitle icon={Bot} label="Crawler" />
          <span
            className="text-[10.5px] text-white/35 tracking-[-0.005em] tabular-nums"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            모드 변경 = DB 직접 수정
          </span>
        </div>
        <div className="space-y-2.5">
          <CrawlerRow
            icon={Newspaper}
            title="News Crawler"
            caption="Anthropic 뉴스 수집"
            mode={status.crawler.newsMode}
            lastCrawl={status.crawler.lastNewsCrawl}
          />
          <CrawlerRow
            icon={Youtube}
            title="YouTube Crawler"
            caption="YouTube 동영상 수집"
            mode={status.crawler.youtubeMode}
            lastCrawl={status.crawler.lastYoutubeCrawl}
          />
        </div>
      </GlassCard>

      {/* Environment Info */}
      <GlassCard padded={true}>
        <SectionTitle icon={SettingsIcon} label="Environment" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          <EnvCell icon={Zap} label="Runtime" value="Node.js" />
          <EnvCell icon={Cpu} label="Framework" value="Next.js" />
          <EnvCell
            icon={Server}
            label="환경"
            value={process.env.NODE_ENV || "production"}
            accentDot={dbStatusBadge.dotClass}
          />
        </div>
      </GlassCard>
    </div>
  );
}

// =====================================================
// Environment Cell — frosted mini-card
// =====================================================
function EnvCell({
  icon: Icon,
  label,
  value,
  accentDot,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accentDot?: string;
}) {
  return (
    <div
      className="rounded-[9px] p-3 ring-1 ring-white/[0.06]"
      style={{ background: "rgba(0,0,0,0.18)" }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-white/40" strokeWidth={1.75} aria-hidden="true" />
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">
            {label}
          </span>
        </div>
        {accentDot && <span aria-hidden="true" className={`h-1 w-1 rounded-full ${accentDot}`} />}
      </div>
      <div
        className="text-[13px] font-medium text-white/90 tracking-[-0.005em] tabular-nums"
        style={{ fontFeatureSettings: '"tnum", "ss01"' }}
      >
        {value}
      </div>
    </div>
  );
}
