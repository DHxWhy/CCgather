"use client";

import { useState, useMemo, useDeferredValue, useEffect, useCallback } from "react";
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
  ScrollText,
  AlertTriangle,
  Sparkles,
  Layers,
  Hash,
  KeyRound,
  MousePointerClick,
  Apple,
  Monitor,
  Terminal,
  Bot,
  Webhook,
  Plug,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// =====================================================
// macOS Big Sur+ Easing — AdminLayoutClient / analytics / ai-usage / funnels 와 동일
// =====================================================
const MAC_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// =====================================================
// Constants — 사용자 facing 100% 유지 (label/value 변경 X)
// =====================================================
const SOURCE_OPTIONS = [
  { label: "전체", value: "" },
  { label: "CLI", value: "cli" },
  { label: "Hook", value: "hook" },
  { label: "API", value: "api" },
] as const;

const REASON_OPTIONS = [
  { label: "전체", value: "" },
  { label: "세션 없음", value: "no_sessions" },
  { label: "데이터 없음", value: "no_data" },
  { label: "스캔 실패", value: "scan_failed" },
  { label: "인증 실패", value: "auth_failed" },
  { label: "네트워크 오류", value: "network_error" },
  { label: "알 수 없음", value: "unknown" },
] as const;

// PERIOD_OPTIONS — funnels / analytics 와 동일 NSSegmentedControl 패턴
// API 옵션 (7/14/30/90) 100% 유지
const PERIOD_OPTIONS = [
  { label: "7일", days: 7 },
  { label: "14일", days: 14 },
  { label: "30일", days: 30 },
  { label: "90일", days: 90 },
] as const;

type PeriodDays = (typeof PERIOD_OPTIONS)[number]["days"];

const PAGE_SIZE = 50;

// =====================================================
// Utility Functions — 기능 100% 유지
// =====================================================

function formatTokens(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString("en-US");
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  // Append noon time to date-only strings to avoid UTC midnight parsing offset
  const date = new Date(dateStr.length === 10 ? dateStr + "T12:00:00" : dateStr);
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

// =====================================================
// macOS NSSearchField — funnels 와 동일한 즉시 필터 패턴
// useDeferredValue 로 입력 지연 처리 (M8 fix)
// =====================================================
function NSSearchField({
  value,
  onChange,
  placeholder,
  width = 200,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  width?: number;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-7 rounded-[7px] pl-7 pr-2.5 text-[11.5px] font-medium text-white/90 placeholder:text-white/30 tracking-[-0.005em] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
        style={{
          width,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          transition: `all 180ms ${MAC_EASE}`,
          fontFeatureSettings: '"ss01", "cv11"',
        }}
      />
      <Search
        className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/35 pointer-events-none"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </div>
  );
}

// =====================================================
// macOS Pop-up Button (Select) — segmented 대체 (옵션 7+)
// =====================================================
function NSPopupSelect<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
  minWidth = 88,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ label: string; value: T }>;
  ariaLabel: string;
  minWidth?: number;
}) {
  return (
    <div className="relative inline-flex">
      <select
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const original = options.find((o) => String(o.value) === raw);
          if (original) onChange(original.value);
        }}
        aria-label={ariaLabel}
        className="h-7 rounded-[7px] pl-2.5 pr-7 text-[11.5px] font-medium text-white/90 tracking-[-0.005em] appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25 cursor-pointer"
        style={{
          minWidth,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          transition: `all 180ms ${MAC_EASE}`,
          fontFeatureSettings: '"ss01", "cv11"',
        }}
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/45 pointer-events-none"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </div>
  );
}

// =====================================================
// macOS NSSegmentedControl — Period (funnels 패턴 일관)
// =====================================================
function PeriodSegmented({
  value,
  onChange,
}: {
  value: PeriodDays;
  onChange: (v: PeriodDays) => void;
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
        const active = value === p.days;
        return (
          <button
            key={p.days}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(p.days)}
            className={`relative inline-flex h-6 items-center px-2.5 text-[11.5px] font-medium tracking-[-0.005em] rounded-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98] ${
              active
                ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-white/55 hover:text-white/85"
            }`}
            style={{ transition: `all 180ms ${MAC_EASE}` }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// =====================================================
// macOS Tag (pill) — 신호용 (coral 단일 액센트 정책)
// 모든 다중 색상 badge 를 단일 시각 언어로 통합
// =====================================================
type TagTone = "neutral" | "coral" | "accent";

function MacTag({
  children,
  tone = "neutral",
  icon: Icon,
  title,
  size = "md",
}: {
  children: React.ReactNode;
  tone?: TagTone;
  icon?: LucideIcon;
  title?: string;
  size?: "sm" | "md";
}) {
  const toneStyles: Record<TagTone, { bg: string; ring: string; text: string }> = {
    neutral: {
      bg: "rgba(255,255,255,0.05)",
      ring: "rgba(255,255,255,0.08)",
      text: "rgba(255,255,255,0.78)",
    },
    coral: {
      bg: "rgba(218,119,86,0.10)",
      ring: "rgba(218,119,86,0.22)",
      text: "var(--color-claude-coral)",
    },
    accent: {
      bg: "rgba(255,255,255,0.08)",
      ring: "rgba(255,255,255,0.12)",
      text: "rgba(255,255,255,0.92)",
    },
  };
  const s = toneStyles[tone];
  const px = size === "sm" ? "px-1.5" : "px-2";
  const py = size === "sm" ? "py-[2px]" : "py-[3px]";
  const fz = size === "sm" ? "text-[9.5px]" : "text-[10.5px]";

  return (
    <span
      className={`inline-flex items-center gap-1 ${px} ${py} rounded-[5px] ${fz} font-medium tracking-[-0.005em] ring-1`}
      title={title}
      style={{
        background: s.bg,
        // tailwind ring-1 + dynamic color
        boxShadow: `inset 0 0 0 1px ${s.ring}`,
        color: s.text,
        fontFeatureSettings: '"ss01", "cv11", "tnum"',
      }}
    >
      {Icon && (
        <Icon
          className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

// =====================================================
// 시멘틱 dot — coral 단일 액센트 정책상 텍스트 색상 대신 점으로 신호
// (funnels / analytics 패턴 일관)
// =====================================================
function SemanticDot({ color, label }: { color: string; label?: string }) {
  return (
    <span
      className={`inline-block h-1 w-1 rounded-full ${color}`}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

// =====================================================
// Source Badge — coral 단일 액센트 (icon + label, dot 신호)
// =====================================================
function SourceBadge({ source }: { source: string }) {
  const config: Record<string, { icon: LucideIcon; label: string; dot: string; tone: TagTone }> = {
    cli: { icon: Terminal, label: "CLI", dot: "bg-emerald-300", tone: "accent" },
    hook: { icon: Webhook, label: "Hook", dot: "bg-sky-300", tone: "neutral" },
    api: { icon: Plug, label: "API", dot: "bg-violet-300", tone: "neutral" },
  };
  const cfg = config[source] ?? {
    icon: Bot,
    label: source,
    dot: "bg-white/50",
    tone: "neutral" as TagTone,
  };
  const Icon = cfg.icon;

  return (
    <MacTag tone={cfg.tone} size="sm">
      <Icon className="h-2.5 w-2.5" strokeWidth={1.75} aria-hidden="true" />
      <SemanticDot color={cfg.dot} />
      <span className="tabular-nums">{cfg.label}</span>
    </MacTag>
  );
}

// =====================================================
// Reason Badge — 실패 사유 (label 100% 유지, 시각만 통일)
// =====================================================
function ReasonBadge({ reason }: { reason: string }) {
  const config: Record<string, { label: string; dot: string }> = {
    no_sessions: { label: "세션 없음", dot: "bg-amber-300" },
    no_data: { label: "데이터 없음", dot: "bg-amber-300" },
    scan_failed: { label: "스캔 실패", dot: "bg-[var(--color-claude-coral)]" },
    auth_failed: { label: "인증 실패", dot: "bg-[var(--color-claude-coral)]" },
    network_error: { label: "네트워크 오류", dot: "bg-rose-300" },
    unknown: { label: "알 수 없음", dot: "bg-white/50" },
  };
  const cfg = config[reason] ?? { label: reason, dot: "bg-white/50" };

  return (
    <MacTag tone="neutral" size="sm">
      <SemanticDot color={cfg.dot} />
      <span>{cfg.label}</span>
    </MacTag>
  );
}

// =====================================================
// Plan Badge — coral / neutral 만 사용 (단일 액센트)
// label 100% 유지 (UPPERCASE)
// =====================================================
function PlanBadge({
  plan,
  rateLimitTier,
}: {
  plan: string | null;
  rateLimitTier?: string | null;
}) {
  if (!plan) return null;
  const lower = plan.toLowerCase();
  const isPaid = ["pro", "max", "team", "enterprise", "api"].includes(lower);
  const tone: TagTone = isPaid ? "coral" : "neutral";
  const tooltip = rateLimitTier ? `Rate Limit: ${rateLimitTier}` : plan;

  return (
    <MacTag tone={tone} title={tooltip} size="sm">
      <span className="uppercase">{plan}</span>
    </MacTag>
  );
}

// =====================================================
// League Reason Badge — coral subtle indicator
// =====================================================
function LeagueReasonBadge({ reason, details }: { reason: string | null; details: string | null }) {
  if (!reason) return <span className="text-[10.5px] text-white/25 tracking-[-0.005em]">—</span>;

  const config: Record<string, { icon: LucideIcon; label: string }> = {
    opus: { icon: Sparkles, label: "Opus" },
    credential: { icon: KeyRound, label: "Cred" },
    user_choice: { icon: MousePointerClick, label: "Pick" },
  };
  const cfg = config[reason] ?? { icon: Hash, label: reason };
  const Icon = cfg.icon;

  return (
    <span
      title={details || reason}
      className="inline-flex items-center gap-1 text-[10.5px] text-white/60 tracking-[-0.005em]"
    >
      <Icon className="h-2.5 w-2.5 text-white/45" strokeWidth={1.75} aria-hidden="true" />
      <span>{cfg.label}</span>
    </span>
  );
}

// =====================================================
// Platform Badge — Apple HIG icon (단일 액센트)
// =====================================================
function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span className="text-[10.5px] text-white/25 tracking-[-0.005em]">—</span>;

  const lower = platform.toLowerCase();
  const config: Record<string, { icon: LucideIcon; label: string }> = {
    darwin: { icon: Apple, label: "macOS" },
    win32: { icon: Monitor, label: "Windows" },
    linux: { icon: Terminal, label: "Linux" },
  };
  const cfg = config[lower] ?? { icon: Monitor, label: platform };
  const Icon = cfg.icon;

  return (
    <span
      title={platform}
      className="inline-flex items-center gap-1.5 text-[11px] text-white/65 tracking-[-0.005em]"
    >
      <Icon className="h-3 w-3 text-white/55" strokeWidth={1.75} aria-hidden="true" />
      <span>{cfg.label}</span>
    </span>
  );
}

// =====================================================
// Frosted GlassCard — funnels / ai-usage 패턴 일관
// =====================================================
function GlassCard({
  children,
  title,
  caption,
  icon: Icon,
  trailing,
  className = "",
  padding = "p-0",
}: {
  children: React.ReactNode;
  title?: string;
  caption?: string;
  icon?: LucideIcon;
  trailing?: React.ReactNode;
  className?: string;
  padding?: string;
}) {
  const showHeader = !!(title || trailing);
  return (
    <div
      className={`rounded-[9px] ring-1 ring-white/[0.08] overflow-hidden ${className}`}
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.18)",
      }}
    >
      {showHeader && (
        <div
          className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/[0.05]"
          style={{ background: "rgba(255,255,255,0.015)" }}
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
      <div className={padding}>{children}</div>
    </div>
  );
}

// =====================================================
// Console Table — macOS Console.app 스타일
// sticky thead (L2 fix) + tabular-nums + monospace timestamps
// =====================================================
function ConsoleTable({
  children,
  columns,
  hScrollKey,
}: {
  children: React.ReactNode;
  columns: Array<{ label: string; align?: "left" | "right" | "center"; width?: string }>;
  hScrollKey?: string;
}) {
  return (
    <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 320px)" }} key={hScrollKey}>
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
            {columns.map((c) => (
              <th
                key={c.label}
                className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 border-b border-white/[0.08] ${
                  c.align === "right"
                    ? "text-right"
                    : c.align === "center"
                      ? "text-center"
                      : "text-left"
                }`}
                style={{ width: c.width }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// =====================================================
// Pagination Toolbar — macOS Sheet toolbar 스타일
// =====================================================
function PaginationToolbar({
  page,
  totalPages,
  totalCount,
  onPrev,
  onNext,
  pageStart,
  pageEnd,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  pageStart: number;
  pageEnd: number;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06]"
      style={{ background: "rgba(255,255,255,0.015)" }}
    >
      <div className="flex items-baseline gap-1.5 text-[11px] tracking-[-0.005em]">
        <span
          className="text-white/85 font-medium tabular-nums"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {pageStart.toLocaleString("en-US")}–{pageEnd.toLocaleString("en-US")}
        </span>
        <span className="text-white/35">of</span>
        <span
          className="text-white/85 font-medium tabular-nums"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {totalCount.toLocaleString("en-US")}
        </span>
        <span className="text-white/35">건</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onPrev}
          disabled={page <= 1}
          aria-label="이전 페이지"
          className="inline-flex h-6 w-6 items-center justify-center rounded-[5px] text-white/65 hover:bg-white/[0.06] hover:text-white/95 disabled:opacity-25 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.96]"
          style={{ transition: `all 160ms ${MAC_EASE}` }}
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <span
          className="text-[11px] text-white/55 tabular-nums tracking-[-0.005em] min-w-[44px] text-center"
          style={{ fontFeatureSettings: '"tnum"' }}
          aria-live="polite"
        >
          {page} / {totalPages}
        </span>
        <button
          onClick={onNext}
          disabled={page >= totalPages}
          aria-label="다음 페이지"
          className="inline-flex h-6 w-6 items-center justify-center rounded-[5px] text-white/65 hover:bg-white/[0.06] hover:text-white/95 disabled:opacity-25 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.96]"
          style={{ transition: `all 160ms ${MAC_EASE}` }}
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

// =====================================================
// JSON Viewer (L1 fix) — raw JSON.stringify → parsed key/value grid
// macOS Inspector pane 스타일
// =====================================================
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function ValuePrimitive({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-white/35 italic tracking-[-0.005em]">null</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span
        className={`tabular-nums tracking-[-0.005em] ${value ? "text-emerald-300" : "text-rose-300"}`}
      >
        {value ? "true" : "false"}
      </span>
    );
  }
  if (typeof value === "number") {
    return (
      <span
        className="text-[var(--color-claude-coral)] tabular-nums tracking-[-0.005em] font-medium"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {value.toLocaleString("en-US")}
      </span>
    );
  }
  if (typeof value === "string") {
    // 긴 문자열은 줄바꿈 허용
    return (
      <span className="text-white/85 tracking-[-0.005em] break-all whitespace-pre-wrap">
        {value}
      </span>
    );
  }
  return <span className="text-white/55 tracking-[-0.005em]">{String(value)}</span>;
}

function JsonTreeNode({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth < 1);

  if (!isPlainObject(value) && !Array.isArray(value)) {
    return <ValuePrimitive value={value} />;
  }

  const entries = isPlainObject(value)
    ? Object.entries(value)
    : (value as unknown[]).map((v, i) => [String(i), v] as const);

  const count = entries.length;
  const isArray = Array.isArray(value);

  if (count === 0) {
    return (
      <span className="text-white/30 tracking-[-0.005em] tabular-nums">
        {isArray ? "[ ]" : "{ }"}
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[10.5px] text-white/45 hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 rounded-[3px] px-1 -mx-1 tracking-[-0.005em]"
        style={{ transition: `color 160ms ${MAC_EASE}` }}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />
        ) : (
          <ChevronRight className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />
        )}
        <span className="tabular-nums" style={{ fontFeatureSettings: '"tnum"' }}>
          {isArray ? `Array(${count})` : `Object · ${count}`}
        </span>
      </button>
      {open && (
        <div
          className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 pl-3"
          style={{
            borderLeft: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {entries.map(([k, v]) => (
            <div
              key={k}
              className="contents"
              style={{ animation: `mac-fadein 220ms ${MAC_EASE} both` }}
            >
              <div
                className="text-[11px] text-white/55 font-mono tracking-[-0.005em] min-w-[80px]"
                style={{ fontFeatureSettings: '"ss01", "cv11", "tnum"' }}
              >
                {isArray ? <span className="text-white/30">[{k}]</span> : k}
              </div>
              <div className="text-[11px] font-mono leading-snug min-w-0">
                <JsonTreeNode value={v} depth={depth + 1} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JsonInspector({ data }: { data: Record<string, unknown> }) {
  return (
    <div
      className="rounded-[7px] px-3 py-2.5 ring-1 ring-white/[0.06]"
      style={{
        background: "rgba(0,0,0,0.25)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-[0.08em] text-white/35 font-semibold">
        <Layers className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
        Debug Inspector
      </div>
      <JsonTreeNode value={data} depth={0} />
    </div>
  );
}

// =====================================================
// User Cell — avatar + name (재사용)
// =====================================================
function UserCell({
  username,
  avatarUrl,
  fallbackLabel,
}: {
  username: string | null;
  avatarUrl: string | null;
  fallbackLabel?: string;
}) {
  if (!username) {
    return (
      <span className="text-[11.5px] text-white/35 italic tracking-[-0.005em]">
        {fallbackLabel ?? "익명"}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt=""
          width={24}
          height={24}
          className="rounded-full ring-1 ring-white/[0.08] shrink-0"
        />
      ) : (
        <div
          className="h-6 w-6 rounded-full flex items-center justify-center text-[10.5px] font-semibold text-white/65 ring-1 ring-white/[0.08] shrink-0"
          style={{ background: "rgba(255,255,255,0.05)" }}
          aria-hidden="true"
        >
          {username.charAt(0).toUpperCase()}
        </div>
      )}
      <span
        className="text-[12.5px] font-medium text-white/90 tracking-[-0.005em] truncate"
        title={username}
      >
        {username}
      </span>
    </div>
  );
}

// =====================================================
// Daily Detail Row — expanded sub-row
// =====================================================
function DailyDetailRow({
  detail,
  showDeviceTag,
}: {
  detail: DailyDetail;
  showDeviceTag: boolean;
}) {
  return (
    <tr style={{ background: "rgba(255,255,255,0.01)" }}>
      <td className="px-3 py-1.5 pl-9 border-b border-white/[0.03]">
        <span className="text-[10.5px] text-white/30 tracking-[-0.005em]" aria-hidden="true">
          └
        </span>
      </td>
      <td className="px-3 py-1.5 border-b border-white/[0.03]" colSpan={2}></td>
      <td className="px-3 py-1.5 border-b border-white/[0.03]">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10.5px] text-white/55 font-mono tabular-nums tracking-[-0.005em]"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {formatDate(detail.date)}
          </span>
          {showDeviceTag && detail.device_id && detail.device_id !== "legacy" && (
            <span
              className="text-[9px] font-mono text-white/40 tabular-nums tracking-[-0.005em]"
              title={`Device: ${detail.device_id}`}
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              #{detail.device_id.slice(0, 4)}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-1.5 text-right border-b border-white/[0.03]">
        <span
          className="text-[10.5px] font-mono tabular-nums tracking-[-0.005em] text-[var(--color-claude-coral)]/75"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {formatTokens(detail.total_tokens)}
        </span>
      </td>
      <td className="px-3 py-1.5 text-right border-b border-white/[0.03]">
        <span
          className="text-[10.5px] font-mono tabular-nums tracking-[-0.005em] text-white/55"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {formatCost(detail.cost_usd)}
        </span>
      </td>
      <td className="px-3 py-1.5 border-b border-white/[0.03]">
        <span className="text-[10px] text-white/35 truncate max-w-[80px] tracking-[-0.005em]">
          {detail.primary_model
            ? detail.primary_model.replace(/^claude-/, "").replace(/-\d{8}$/, "")
            : "—"}
        </span>
      </td>
      <td className="px-3 py-1.5 border-b border-white/[0.03]"></td>
    </tr>
  );
}

// =====================================================
// Success Log Row — keyboard a11y (H5 fix)
// =====================================================
function SuccessLogRow({ log }: { log: SubmitLogItem }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = !!(log.daily_details && log.daily_details.length > 1);
  const showDeviceTag = (log.device_count ?? 0) > 1;

  const dateRange =
    log.date_from === log.date_to
      ? formatDate(log.date_from)
      : `${formatDate(log.date_from)}~${formatDate(log.date_to)}`;

  const toggle = useCallback(() => {
    if (hasDetails) setIsExpanded((v) => !v);
  }, [hasDetails]);

  const onKey = useCallback(
    (e: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (!hasDetails) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
    [hasDetails, toggle]
  );

  return (
    <>
      <tr
        role={hasDetails ? "button" : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        aria-expanded={hasDetails ? isExpanded : undefined}
        aria-label={
          hasDetails ? `${log.username} 제출 상세 ${isExpanded ? "접기" : "펼치기"}` : undefined
        }
        onClick={toggle}
        onKeyDown={onKey}
        className={`group focus-visible:outline-none ${hasDetails ? "cursor-pointer" : ""}`}
        style={{
          transition: `background-color 160ms ${MAC_EASE}`,
        }}
      >
        <td
          className="px-3 py-2.5 border-b border-white/[0.04] group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.04] group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-white/25"
          style={{ transition: `background-color 160ms ${MAC_EASE}` }}
        >
          <div className="flex items-center gap-1.5">
            {hasDetails ? (
              isExpanded ? (
                <ChevronUp
                  className="w-3 h-3 text-white/55"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              ) : (
                <ChevronDown
                  className="w-3 h-3 text-white/55"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              )
            ) : (
              <div className="w-3" aria-hidden="true" />
            )}
            <span
              className="text-[11.5px] text-white/85 font-mono tabular-nums tracking-[-0.005em]"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              {formatDateTime(log.submitted_at)}
            </span>
          </div>
        </td>

        <td
          className="px-3 py-2.5 border-b border-white/[0.04] group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.04]"
          style={{ transition: `background-color 160ms ${MAC_EASE}` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <UserCell username={log.username} avatarUrl={log.avatar_url} />
            {log.device_count != null &&
              log.device_count >= 1 &&
              (log.device_count === 1 ? (
                <span
                  className="inline-flex items-center text-[9.5px] text-emerald-300/85 tracking-[-0.005em]"
                  title="단일 디바이스"
                  aria-label="단일 디바이스"
                >
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-emerald-300 mr-0.5" />
                </span>
              ) : (
                <MacTag tone="neutral" size="sm" title={`${log.device_count}개 디바이스`}>
                  +{log.device_count - 1}
                </MacTag>
              ))}
          </div>
        </td>

        <td
          className="px-3 py-2.5 border-b border-white/[0.04] group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.04]"
          style={{ transition: `background-color 160ms ${MAC_EASE}` }}
        >
          <div className="flex items-center gap-2">
            <PlanBadge plan={log.ccplan} rateLimitTier={log.rate_limit_tier} />
            <LeagueReasonBadge reason={log.league_reason} details={log.league_reason_details} />
          </div>
        </td>

        <td
          className="px-3 py-2.5 border-b border-white/[0.04] group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.04]"
          style={{ transition: `background-color 160ms ${MAC_EASE}` }}
        >
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-[10.5px] text-white/40 tabular-nums tracking-[-0.005em]"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              {log.days_count}일
            </span>
            <span
              className="text-[11.5px] text-white/75 tabular-nums tracking-[-0.005em]"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              {dateRange}
            </span>
          </div>
        </td>

        <td
          className="px-3 py-2.5 text-right border-b border-white/[0.04] group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.04]"
          style={{ transition: `background-color 160ms ${MAC_EASE}` }}
        >
          <span
            className="text-[12.5px] font-mono font-semibold tabular-nums tracking-[-0.01em] text-[var(--color-claude-coral)]"
            style={{ fontFeatureSettings: '"tnum", "ss01"' }}
          >
            {formatTokens(log.total_tokens)}
          </span>
        </td>

        <td
          className="px-3 py-2.5 text-right border-b border-white/[0.04] group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.04]"
          style={{ transition: `background-color 160ms ${MAC_EASE}` }}
        >
          <span
            className="text-[12.5px] font-mono font-medium tabular-nums tracking-[-0.005em] text-white/85"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {formatCost(log.total_cost)}
          </span>
        </td>

        <td
          className="px-3 py-2.5 border-b border-white/[0.04] group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.04]"
          style={{ transition: `background-color 160ms ${MAC_EASE}` }}
        >
          <span
            className="text-[10.5px] text-white/50 truncate max-w-[120px] tracking-[-0.005em] block"
            title={log.primary_model || ""}
          >
            {log.primary_model
              ? log.primary_model.replace(/^claude-/, "").replace(/-\d{8}$/, "")
              : "—"}
          </span>
        </td>

        <td
          className="px-3 py-2.5 text-center border-b border-white/[0.04] group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.04]"
          style={{ transition: `background-color 160ms ${MAC_EASE}` }}
        >
          <SourceBadge source={log.submission_source} />
        </td>
      </tr>

      {isExpanded &&
        log.daily_details?.map((detail, idx) => (
          <DailyDetailRow
            key={`${log.submitted_at}_${detail.date}_${idx}`}
            detail={detail}
            showDeviceTag={showDeviceTag}
          />
        ))}
    </>
  );
}

// =====================================================
// Failed Log Row — keyboard a11y (H5) + L1 JSON inspector
// =====================================================
function FailedLogRow({ log }: { log: FailedAttemptItem }) {
  const [showDebug, setShowDebug] = useState(false);
  const hasDebug = !!log.debug_info;

  const toggle = useCallback(() => {
    if (hasDebug) setShowDebug((v) => !v);
  }, [hasDebug]);

  const onKey = useCallback(
    (e: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (!hasDebug) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
    [hasDebug, toggle]
  );

  return (
    <>
      <tr
        role={hasDebug ? "button" : undefined}
        tabIndex={hasDebug ? 0 : undefined}
        aria-expanded={hasDebug ? showDebug : undefined}
        aria-label={hasDebug ? `실패 로그 디버그 정보 ${showDebug ? "접기" : "펼치기"}` : undefined}
        onClick={toggle}
        onKeyDown={onKey}
        className={`group focus-visible:outline-none ${hasDebug ? "cursor-pointer" : ""}`}
        style={{ transition: `background-color 160ms ${MAC_EASE}` }}
      >
        <td
          className="px-3 py-2.5 border-b border-white/[0.04] group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.04] group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-white/25"
          style={{ transition: `background-color 160ms ${MAC_EASE}` }}
        >
          <div className="flex items-center gap-1.5">
            {hasDebug ? (
              showDebug ? (
                <ChevronUp
                  className="w-3 h-3 text-white/55"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              ) : (
                <ChevronDown
                  className="w-3 h-3 text-white/55"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              )
            ) : (
              <div className="w-3" aria-hidden="true" />
            )}
            <span
              className="text-[11.5px] text-white/85 font-mono tabular-nums tracking-[-0.005em]"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              {formatDateTime(log.created_at)}
            </span>
          </div>
        </td>

        <td
          className="px-3 py-2.5 border-b border-white/[0.04] group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.04]"
          style={{ transition: `background-color 160ms ${MAC_EASE}` }}
        >
          <UserCell username={log.username} avatarUrl={log.avatar_url} />
        </td>

        <td
          className="px-3 py-2.5 border-b border-white/[0.04] group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.04]"
          style={{ transition: `background-color 160ms ${MAC_EASE}` }}
        >
          <ReasonBadge reason={log.reason} />
        </td>

        <td
          className="px-3 py-2.5 border-b border-white/[0.04] group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.04]"
          style={{ transition: `background-color 160ms ${MAC_EASE}` }}
        >
          <PlatformBadge platform={log.platform} />
        </td>

        <td
          className="px-3 py-2.5 border-b border-white/[0.04] group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.04]"
          style={{ transition: `background-color 160ms ${MAC_EASE}` }}
        >
          <span
            className="text-[11px] text-white/55 font-mono tabular-nums tracking-[-0.005em]"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {log.cli_version || "—"}
          </span>
        </td>

        <td
          className="px-3 py-2.5 border-b border-white/[0.04] group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.04]"
          style={{ transition: `background-color 160ms ${MAC_EASE}` }}
        >
          <span
            className="text-[10.5px] text-white/45 font-mono tabular-nums tracking-[-0.005em] truncate max-w-[120px] block"
            title={log.ip_address || ""}
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {log.ip_address || "—"}
          </span>
        </td>
      </tr>

      {showDebug && log.debug_info && (
        <tr style={{ background: "rgba(255,255,255,0.012)" }}>
          <td colSpan={6} className="px-4 py-3 border-b border-white/[0.04]">
            <JsonInspector data={log.debug_info} />
          </td>
        </tr>
      )}
    </>
  );
}

// =====================================================
// Tab Pill — macOS pill segmented (성공/실패)
// =====================================================
function TabPill({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-[5px] text-[12px] font-medium tracking-[-0.005em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98] ${
        active
          ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "text-white/55 hover:text-white/85"
      }`}
      style={{ transition: `all 180ms ${MAC_EASE}` }}
    >
      <Icon
        className="h-3 w-3"
        strokeWidth={1.75}
        aria-hidden="true"
        style={{
          color: active ? "var(--color-claude-coral)" : "currentColor",
        }}
      />
      <span>{label}</span>
      {typeof count === "number" && (
        <span
          className="text-[10.5px] tabular-nums tracking-[-0.005em] text-white/45 ml-0.5"
          style={{ fontFeatureSettings: '"tnum"' }}
          aria-label={`${count}건`}
        >
          {count.toLocaleString("en-US")}
        </span>
      )}
    </button>
  );
}

// =====================================================
// Main Page
// =====================================================
export default function SubmitLogsPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"success" | "failed">("success");

  // Success logs state
  const [successPage, setSuccessPage] = useState(1);
  const [successSearchInput, setSuccessSearchInput] = useState("");
  const successDeferredSearch = useDeferredValue(successSearchInput);
  const [successSource, setSuccessSource] = useState("");
  const [successDateRangeDays, setSuccessDateRangeDays] = useState<PeriodDays>(30);

  // Failed logs state
  const [failedPage, setFailedPage] = useState(1);
  const [failedSearchInput, setFailedSearchInput] = useState("");
  const failedDeferredSearch = useDeferredValue(failedSearchInput);
  const [failedReason, setFailedReason] = useState("");
  const [failedDateRangeDays, setFailedDateRangeDays] = useState<PeriodDays>(30);

  // Seed the search box from the URL `?search=` param so the Discord 이슈감지
  // alert's "제출 로그 열기" link lands pre-filtered on the flagged user.
  // Uses window.location instead of useSearchParams to avoid forcing a Suspense
  // boundary around this large client page; the effect runs only on the client.
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("search");
    if (s) {
      setSuccessSearchInput(s);
      setActiveTab("success");
    }
  }, []);

  // Reset page when filters change (M8 — 검색 즉시 페이지 1)
  useEffect(() => {
    setSuccessPage(1);
  }, [successDeferredSearch, successSource, successDateRangeDays]);

  useEffect(() => {
    setFailedPage(1);
  }, [failedDeferredSearch, failedReason, failedDateRangeDays]);

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

  // Queries — API 시그니처 100% 유지 (search/source/reason/date 동일 param)
  const successData = useSubmitLogs({
    page: successPage,
    pageSize: PAGE_SIZE,
    search: successDeferredSearch,
    source: successSource,
    startDate: successDates.startDate,
    endDate: successDates.endDate,
    enabled: activeTab === "success",
  });

  const failedData = useFailedAttempts({
    page: failedPage,
    pageSize: PAGE_SIZE,
    search: failedDeferredSearch,
    reason: failedReason,
    startDate: failedDates.startDate,
    endDate: failedDates.endDate,
    enabled: activeTab === "failed",
  });

  const successPageStart = useMemo(() => {
    if (!successData.data || successData.data.logs.length === 0) return 0;
    return (successPage - 1) * PAGE_SIZE + 1;
  }, [successData.data, successPage]);

  const successPageEnd = useMemo(() => {
    if (!successData.data) return 0;
    return Math.min(successPage * PAGE_SIZE, successData.data.pagination.totalCount);
  }, [successData.data, successPage]);

  const failedPageStart = useMemo(() => {
    if (!failedData.data || failedData.data.logs.length === 0) return 0;
    return (failedPage - 1) * PAGE_SIZE + 1;
  }, [failedData.data, failedPage]);

  const failedPageEnd = useMemo(() => {
    if (!failedData.data) return 0;
    return Math.min(failedPage * PAGE_SIZE, failedData.data.pagination.totalCount);
  }, [failedData.data, failedPage]);

  const successColumns = useMemo(
    () => [
      { label: "제출 시간", align: "left" as const },
      { label: "사용자", align: "left" as const },
      { label: "플랜·근거", align: "left" as const },
      { label: "기간", align: "left" as const },
      { label: "토큰", align: "right" as const },
      { label: "비용", align: "right" as const },
      { label: "모델", align: "left" as const },
      { label: "소스", align: "center" as const },
    ],
    []
  );

  const failedColumns = useMemo(
    () => [
      { label: "시간", align: "left" as const },
      { label: "사용자", align: "left" as const },
      { label: "실패 사유", align: "left" as const },
      { label: "플랫폼", align: "left" as const },
      { label: "CLI 버전", align: "left" as const },
      { label: "IP 주소", align: "left" as const },
    ],
    []
  );

  return (
    <div
      className="space-y-5 max-w-6xl"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
        fontFeatureSettings: '"ss01", "cv11", "cv03"',
      }}
    >
      {/* macOS keyframe — fade-in on JSON expand */}
      <style jsx global>{`
        @keyframes mac-fadein {
          from {
            opacity: 0;
            transform: translateY(-2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* ─────────── Header — funnels 패턴 일관 ─────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <ScrollText
              className="h-3.5 w-3.5 text-white/40"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40">
              Analytics · Submit Logs
            </span>
          </div>
          <h1
            className="text-[20px] font-semibold leading-none tracking-[-0.01em] text-white/95"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            Submit Logs
          </h1>
          <p className="mt-1.5 text-[12px] text-white/45 tracking-[-0.005em]">
            CLI 제출 로그 · 성공/실패 기록
          </p>
        </div>
        <div className="shrink-0">
          <PeriodSegmented
            value={activeTab === "success" ? successDateRangeDays : failedDateRangeDays}
            onChange={(v) =>
              activeTab === "success" ? setSuccessDateRangeDays(v) : setFailedDateRangeDays(v)
            }
          />
        </div>
      </div>

      {/* ─────────── Tabs — macOS pill segmented ─────────── */}
      <div
        role="tablist"
        aria-label="로그 종류"
        className="inline-flex items-center rounded-[7px] p-0.5 ring-1 ring-white/[0.08] w-fit"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        <TabPill
          active={activeTab === "success"}
          onClick={() => setActiveTab("success")}
          icon={CheckCircle2}
          label="성공 로그"
          count={successData.data?.pagination.totalCount}
        />
        <TabPill
          active={activeTab === "failed"}
          onClick={() => setActiveTab("failed")}
          icon={XCircle}
          label="실패 로그"
          count={failedData.data?.stats.total}
        />
      </div>

      {/* ─────────── Success Tab ─────────── */}
      {activeTab === "success" && (
        <div role="tabpanel" aria-label="성공 로그" className="space-y-3">
          {/* Filters — funnels 패턴 일관 */}
          <div className="flex items-center gap-2 flex-wrap">
            <NSPopupSelect
              value={successSource}
              onChange={setSuccessSource}
              options={SOURCE_OPTIONS}
              ariaLabel="소스 필터"
              minWidth={84}
            />
            <NSSearchField
              value={successSearchInput}
              onChange={setSuccessSearchInput}
              placeholder="이름·이메일 검색"
              ariaLabel="사용자 이름 또는 이메일 검색"
              width={200}
            />
            {successData.isFetching && !successData.isLoading && (
              <span
                className="inline-flex items-center gap-1.5 text-[10.5px] text-white/45 tracking-[-0.005em] ml-1"
                aria-live="polite"
              >
                <span
                  className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-white/15 border-t-[var(--color-claude-coral)]"
                  aria-hidden="true"
                />
                업데이트 중
              </span>
            )}
          </div>

          {/* Loading */}
          {successData.isLoading && (
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

          {/* Error */}
          {successData.error && (
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

          {/* Table */}
          {!successData.isLoading && successData.data && (
            <GlassCard>
              <ConsoleTable columns={successColumns}>
                {successData.data.logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={successColumns.length}
                      className="py-12 text-center text-[12.5px] text-white/35 tracking-[-0.005em] border-b border-white/[0.04]"
                    >
                      {successDeferredSearch
                        ? `“${successDeferredSearch}” 검색 결과가 없습니다`
                        : "제출 로그가 없습니다"}
                    </td>
                  </tr>
                ) : (
                  successData.data.logs.map((log, index) => (
                    <SuccessLogRow key={`${log.submitted_at}_${log.user_id}_${index}`} log={log} />
                  ))
                )}
              </ConsoleTable>
              {successData.data.pagination.totalPages > 1 && (
                <PaginationToolbar
                  page={successPage}
                  totalPages={successData.data.pagination.totalPages}
                  totalCount={successData.data.pagination.totalCount}
                  pageStart={successPageStart}
                  pageEnd={successPageEnd}
                  onPrev={() => setSuccessPage((p) => Math.max(1, p - 1))}
                  onNext={() =>
                    setSuccessPage((p) => Math.min(successData.data!.pagination.totalPages, p + 1))
                  }
                />
              )}
            </GlassCard>
          )}

          {/* Last updated */}
          {!successData.isLoading && successData.data && successData.data.logs.length > 0 && (
            <div
              className="text-[10.5px] text-white/30 text-right tabular-nums tracking-[-0.005em]"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              업데이트{" "}
              {new Date(successData.data.generatedAt).toLocaleString("ko-KR", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────── Failed Tab ─────────── */}
      {activeTab === "failed" && (
        <div role="tabpanel" aria-label="실패 로그" className="space-y-3">
          {/* Stats Summary */}
          {failedData.data && failedData.data.stats.total > 0 && (
            <div className="flex gap-2 flex-wrap">
              {Object.entries(failedData.data.stats.byReason).map(([reason, count]) => (
                <div
                  key={reason}
                  className="inline-flex items-center gap-2 rounded-[7px] px-2.5 py-1.5 ring-1 ring-white/[0.08]"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                  }}
                >
                  <ReasonBadge reason={reason} />
                  <span
                    className="text-[11.5px] text-white/85 font-medium tabular-nums tracking-[-0.005em]"
                    style={{ fontFeatureSettings: '"tnum"' }}
                  >
                    {count.toLocaleString("en-US")}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <NSPopupSelect
              value={failedReason}
              onChange={setFailedReason}
              options={REASON_OPTIONS}
              ariaLabel="실패 사유 필터"
              minWidth={120}
            />
            <NSSearchField
              value={failedSearchInput}
              onChange={setFailedSearchInput}
              placeholder="사용자·IP 검색"
              ariaLabel="사용자 또는 IP 검색"
              width={200}
            />
            {failedData.isFetching && !failedData.isLoading && (
              <span
                className="inline-flex items-center gap-1.5 text-[10.5px] text-white/45 tracking-[-0.005em] ml-1"
                aria-live="polite"
              >
                <span
                  className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-white/15 border-t-[var(--color-claude-coral)]"
                  aria-hidden="true"
                />
                업데이트 중
              </span>
            )}
          </div>

          {/* Loading */}
          {failedData.isLoading && (
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

          {/* Error */}
          {failedData.error && (
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

          {/* Table */}
          {!failedData.isLoading && failedData.data && (
            <GlassCard>
              <ConsoleTable columns={failedColumns}>
                {failedData.data.logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={failedColumns.length}
                      className="py-12 text-center text-[12.5px] text-white/35 tracking-[-0.005em] border-b border-white/[0.04]"
                    >
                      {failedDeferredSearch
                        ? `“${failedDeferredSearch}” 검색 결과가 없습니다`
                        : "실패 로그가 없습니다"}
                    </td>
                  </tr>
                ) : (
                  failedData.data.logs.map((log) => <FailedLogRow key={log.id} log={log} />)
                )}
              </ConsoleTable>
              {failedData.data.pagination.totalPages > 1 && (
                <PaginationToolbar
                  page={failedPage}
                  totalPages={failedData.data.pagination.totalPages}
                  totalCount={failedData.data.pagination.totalCount}
                  pageStart={failedPageStart}
                  pageEnd={failedPageEnd}
                  onPrev={() => setFailedPage((p) => Math.max(1, p - 1))}
                  onNext={() =>
                    setFailedPage((p) => Math.min(failedData.data!.pagination.totalPages, p + 1))
                  }
                />
              )}
            </GlassCard>
          )}

          {/* Last updated */}
          {!failedData.isLoading && failedData.data && failedData.data.logs.length > 0 && (
            <div
              className="text-[10.5px] text-white/30 text-right tabular-nums tracking-[-0.005em]"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              업데이트{" "}
              {new Date(failedData.data.generatedAt).toLocaleString("ko-KR", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
