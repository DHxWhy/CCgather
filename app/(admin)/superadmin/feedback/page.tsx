"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Bug,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Inbox,
  Lightbulb,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// =====================================================
// macOS Big Sur+ Easing — 이전 10 페이지 (community / ai-usage / analytics 등) 100% 동일
// =====================================================
const MAC_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// 최초 표시 행 수 — community 동일 패턴 (UI 윈도우만, API limit 변경 X)
const INITIAL_VISIBLE_ROWS = 30;
const LOAD_MORE_STEP = 30;

// Admin note 자동 저장 debounce (M12: 미세 변경시 부담 줄이고 명시적 저장 보장)
const ADMIN_NOTE_DEBOUNCE_MS = 1200;

// =====================================================
// API contract types — 변경 X (서버 응답 형태와 100% 동일)
// =====================================================
interface FeedbackUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

type FeedbackType = "bug" | "feature" | "general";
type FeedbackStatus = "new" | "in_progress" | "resolved" | "closed";

interface Feedback {
  id: string;
  type: FeedbackType;
  content: string;
  page_url: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  user: FeedbackUser | null;
}

interface Stats {
  total: number;
  new: number;
  in_progress: number;
  resolved: number;
  closed: number;
}

type StatusFilter = "all" | FeedbackStatus;
type TypeFilter = "all" | FeedbackType;

// =====================================================
// Frosted Card — community / ai-usage 패턴 100% 재사용
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
// StatCard — community / ai-usage / analytics-users 패턴 100% 재사용 (macOS Widget)
// =====================================================
interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: "neutral" | "coral" | "success" | "warning" | "muted";
}

function StatCard({ label, value, icon: Icon, accent = "neutral" }: StatCardProps) {
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
            {value.toLocaleString("en-US")}
          </div>
          <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-white/45">
            {label}
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
// Focus Trap Hook — community 100% 동일 (WCAG 2.4.3)
// =====================================================
function useFocusTrap(active: boolean, onEscape: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (!container) return;

    const FOCUSABLE_SELECTOR =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null
      );

    const focusables = getFocusables();
    if (focusables.length > 0 && focusables[0]) {
      focusables[0].focus();
    } else {
      container.focus();
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;

      const items = getFocusables();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [active, onEscape]);

  return containerRef;
}

// =====================================================
// Type/Status meta — single source of truth (semantic dot + macOS chip)
// =====================================================
const TYPE_META: Record<FeedbackType, { label: string; icon: LucideIcon; dotClass: string }> = {
  bug: { label: "Bug", icon: Bug, dotClass: "bg-rose-300" },
  feature: { label: "Feature", icon: Lightbulb, dotClass: "bg-amber-200" },
  general: { label: "General", icon: MessageSquare, dotClass: "bg-white/55" },
};

const STATUS_META: Record<
  FeedbackStatus,
  { label: string; icon: LucideIcon; dotClass: string; textClass: string }
> = {
  new: {
    label: "New",
    icon: Sparkles,
    dotClass: "bg-[var(--color-claude-coral)]",
    textClass: "text-[var(--color-claude-coral)]",
  },
  in_progress: {
    label: "진행중",
    icon: Clock,
    dotClass: "bg-amber-300",
    textClass: "text-amber-200",
  },
  resolved: {
    label: "해결",
    icon: CheckCircle2,
    dotClass: "bg-emerald-300",
    textClass: "text-emerald-300",
  },
  closed: {
    label: "닫힘",
    icon: X,
    dotClass: "bg-white/45",
    textClass: "text-white/55",
  },
};

function TypeChip({ type }: { type: FeedbackType }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium tracking-[-0.005em] ring-1 ring-white/[0.08] bg-white/[0.04] text-white/75"
      aria-label={meta.label}
    >
      <span aria-hidden="true" className={`h-1 w-1 rounded-full ${meta.dotClass}`} />
      <Icon className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function StatusChip({ status }: { status: FeedbackStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium tracking-[-0.005em] ring-1 ring-white/[0.08] bg-white/[0.04] ${meta.textClass}`}
      aria-label={`상태: ${meta.label}`}
    >
      <span aria-hidden="true" className={`h-1 w-1 rounded-full ${meta.dotClass}`} />
      <Icon className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

// =====================================================
// NSSegmentedControl — community TypeSegmented 패턴 100% 동일
// =====================================================
function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center rounded-[7px] p-0.5 ring-1 ring-white/[0.08]"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`relative inline-flex h-7 items-center px-2.5 text-[11.5px] font-medium tracking-[-0.005em] rounded-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98] ${
              active
                ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-white/55 hover:text-white/85"
            }`}
            style={{ transition: `all 180ms ${MAC_EASE}` }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "new", label: "New" },
  { value: "in_progress", label: "진행중" },
  { value: "resolved", label: "해결" },
  { value: "closed", label: "닫힘" },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "general", label: "General" },
];

// =====================================================
// Confirmation Sheet (Cupid H2) — community ConfirmSheet 패턴 100% 동일
// =====================================================
interface ConfirmState {
  feedbackId: string;
  fromStatus: FeedbackStatus;
  toStatus: FeedbackStatus;
  preview: string;
  adminNote: string;
}

function ConfirmSheet({
  state,
  loading,
  onConfirm,
  onCancel,
}: {
  state: ConfirmState | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const containerRef = useFocusTrap(!!state, onCancel);

  if (!state) return null;

  const toMeta = STATUS_META[state.toStatus];
  const ToIcon = toMeta.icon;
  const isClosingAction = state.toStatus === "closed";
  const isResolvingAction = state.toStatus === "resolved";

  // accent on the confirm button matches semantic of action
  const accent = isClosingAction
    ? {
        bg: "bg-white/[0.12] hover:bg-white/[0.18] text-white/95",
        ring: "ring-white/15",
        iconBg: "bg-white/[0.08] ring-white/15 text-white/75",
      }
    : isResolvingAction
      ? {
          bg: "bg-emerald-400/90 hover:bg-emerald-400 text-black",
          ring: "ring-emerald-400/55",
          iconBg: "bg-emerald-400/10 ring-emerald-400/22 text-emerald-300",
        }
      : {
          bg: "bg-[var(--color-claude-coral)]/90 hover:bg-[var(--color-claude-coral)] text-white",
          ring: "ring-[var(--color-claude-coral)]/45",
          iconBg:
            "bg-[var(--color-claude-coral)]/12 ring-[var(--color-claude-coral)]/22 text-[var(--color-claude-coral)]",
        };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="닫기"
        onClick={onCancel}
        disabled={loading}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm focus-visible:outline-none disabled:cursor-wait"
        tabIndex={-1}
      />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="relative w-[440px] max-w-[calc(100vw-2rem)] rounded-2xl ring-1 ring-white/[0.08] focus-visible:outline-none"
        style={{
          background: "linear-gradient(180deg, rgba(40,40,42,0.92) 0%, rgba(28,28,30,0.92) 100%)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          boxShadow:
            "0 25px 50px -12px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${accent.iconBg}`}
              aria-hidden="true"
            >
              <ToIcon className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h3
                id={titleId}
                className="text-[14px] font-semibold tracking-[-0.01em] text-white/95"
                style={{ fontFeatureSettings: '"ss01"' }}
              >
                상태 변경 확인
              </h3>
              <p id={descId} className="mt-0.5 text-[11.5px] text-white/55 tracking-[-0.005em]">
                {STATUS_META[state.fromStatus].label}
                <span aria-hidden="true" className="mx-1 text-white/30">
                  →
                </span>
                <span className={toMeta.textClass}>{toMeta.label}</span>
                {(isResolvingAction || state.toStatus === "in_progress" || isClosingAction) && (
                  <span className="ml-1.5 text-white/35">· 사용자에 알림 전송</span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="닫기"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/45 hover:bg-white/[0.06] hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.95] disabled:opacity-50"
            style={{ transition: `all 180ms ${MAC_EASE}` }}
          >
            <X className="h-[15px] w-[15px]" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-5 pb-3 space-y-3">
          <div
            className="rounded-[9px] p-3 ring-1 ring-white/[0.06]"
            style={{ background: "rgba(0,0,0,0.22)" }}
          >
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40 mb-1">
              피드백 내용
            </div>
            <p className="text-[12px] text-white/75 leading-relaxed tracking-[-0.005em] line-clamp-3">
              {state.preview || "[내용 없음]"}
            </p>
          </div>

          {state.adminNote.trim() !== "" && (
            <div
              className="rounded-[9px] p-3 ring-1 ring-white/[0.06]"
              style={{ background: "rgba(0,0,0,0.18)" }}
            >
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40 mb-1">
                저장될 관리자 메모
              </div>
              <p className="text-[11.5px] text-white/70 leading-relaxed tracking-[-0.005em] line-clamp-3">
                {state.adminNote}
              </p>
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 pb-4 pt-2 border-t border-white/[0.06]"
          style={{ background: "rgba(255,255,255,0.015)" }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3.5 text-[11.5px] font-medium text-white/75 bg-white/[0.04] ring-1 ring-white/[0.08] hover:bg-white/[0.07] hover:text-white/95 hover:ring-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98] disabled:opacity-50"
            style={{ transition: `all 180ms ${MAC_EASE}` }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            autoFocus
            className={`inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3.5 text-[11.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 active:scale-[0.98] disabled:opacity-60 ring-1 ${accent.bg} ${accent.ring}`}
            style={{ transition: `all 180ms ${MAC_EASE}` }}
          >
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} aria-hidden="true" />
                <span>처리 중</span>
              </>
            ) : (
              <>
                <ToIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                <span>{toMeta.label}으로 변경</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Toast Banner — Cupid H1 unified pattern
// =====================================================
interface ToastState {
  id: number;
  kind: "success" | "error";
  message: string;
}

function Toast({ state, onDismiss }: { state: ToastState | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!state) return;
    const timer = setTimeout(onDismiss, 3200);
    return () => clearTimeout(timer);
  }, [state, onDismiss]);

  if (!state) return null;

  const isError = state.kind === "error";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex items-end justify-center px-4"
      aria-live={isError ? "assertive" : "polite"}
      role={isError ? "alert" : "status"}
    >
      <div
        className="pointer-events-auto relative w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[11px] ring-1 ring-white/[0.1]"
        style={{
          background: "linear-gradient(180deg, rgba(40,40,42,0.94) 0%, rgba(28,28,30,0.94) 100%)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          boxShadow: "0 18px 36px -10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            {isError ? (
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0 text-rose-300"
                strokeWidth={2}
                aria-hidden="true"
              />
            ) : (
              <Check
                className="h-3.5 w-3.5 shrink-0 text-emerald-300"
                strokeWidth={2.25}
                aria-hidden="true"
              />
            )}
            <p className="text-[12px] text-white/85 tracking-[-0.005em] leading-tight">
              {state.message}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="닫기"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/45 hover:bg-white/[0.06] hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.95] shrink-0"
            style={{ transition: `all 180ms ${MAC_EASE}` }}
          >
            <X className="h-[13px] w-[13px]" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Formatters
// =====================================================
function formatRelative(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return "방금 전";
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function getPreviewText(content: string, maxLen = 120): string {
  // Mail-style preview — collapse newlines, trim
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLen) return collapsed;
  return collapsed.slice(0, maxLen) + "…";
}

function getInitials(user: FeedbackUser | null): string {
  if (!user) return "?";
  const display = user.display_name?.trim() || user.username?.trim() || "";
  if (!display) return "?";
  return display.charAt(0).toUpperCase();
}

function getDisplayName(user: FeedbackUser | null): string {
  return user?.display_name?.trim() || user?.username?.trim() || "알 수 없음";
}

// =====================================================
// Main Page
// =====================================================
export default function AdminFeedbackPage() {
  // --- Data state ---
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Filter / search state ---
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // --- UI state ---
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminNoteDraft, setAdminNoteDraft] = useState("");
  const [adminNoteSaved, setAdminNoteSaved] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [visibleRows, setVisibleRows] = useState(INITIAL_VISIBLE_ROWS);

  // --- Confirm + Toast state (Cupid H2) ---
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastIdRef = useRef(0);

  // Refs for cleanup
  const adminNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, kind, message });
  }, []);

  // =====================================================
  // Fetch — single endpoint (UI 만 분리, API 변경 X)
  //
  // H8 fix: stats 는 항상 "필터 미적용" base 에서 계산하므로,
  // 사용자가 status filter 를 변경해도 stats 가 stale 되지 않는다.
  // 구체적으로:
  //   1) statusFilter='all' 시: 전체 데이터 가져옴 → stats 계산 + list 표시
  //   2) statusFilter !== 'all' 시: stats 용 'all' fetch + list 용 status fetch 병렬
  // =====================================================
  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        if (statusFilter === "all") {
          // 단일 호출로 list + stats 동시 처리
          const response = await fetch(`/api/feedback?status=all`, { signal });
          if (!response.ok) throw new Error("Failed to fetch feedbacks");
          const data = await response.json();
          const all: Feedback[] = data.feedbacks ?? [];

          // Stats — unfiltered base (H8 fix)
          setStats({
            total: all.length,
            new: all.filter((f) => f.status === "new").length,
            in_progress: all.filter((f) => f.status === "in_progress").length,
            resolved: all.filter((f) => f.status === "resolved").length,
            closed: all.filter((f) => f.status === "closed").length,
          });

          // List — type filter is client-side (기존 동작 100% 유지)
          const list = typeFilter === "all" ? all : all.filter((f) => f.type === typeFilter);
          setFeedbacks(list);
        } else {
          // 필터 적용 시 stats 와 list 를 병렬로 가져옴 (H8 fix)
          const [statsRes, listRes] = await Promise.all([
            fetch(`/api/feedback?status=all`, { signal }),
            fetch(`/api/feedback?status=${statusFilter}`, { signal }),
          ]);

          if (!statsRes.ok || !listRes.ok) {
            throw new Error("Failed to fetch feedbacks");
          }

          const [statsData, listData] = await Promise.all([statsRes.json(), listRes.json()]);

          const all: Feedback[] = statsData.feedbacks ?? [];
          setStats({
            total: all.length,
            new: all.filter((f) => f.status === "new").length,
            in_progress: all.filter((f) => f.status === "in_progress").length,
            resolved: all.filter((f) => f.status === "resolved").length,
            closed: all.filter((f) => f.status === "closed").length,
          });

          const raw: Feedback[] = listData.feedbacks ?? [];
          const list = typeFilter === "all" ? raw : raw.filter((f) => f.type === typeFilter);
          setFeedbacks(list);
        }

        setVisibleRows(INITIAL_VISIBLE_ROWS);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Error fetching feedbacks:", error);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, typeFilter]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Submit search — 기존 클라이언트 필터 동작 유지 (UI 만)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  // Search filter (client-side) — 기능 변경 X, UX 만 추가
  const filtered = useMemo(() => {
    if (!search.trim()) return feedbacks;
    const q = search.trim().toLowerCase();
    return feedbacks.filter((f) => {
      const content = f.content.toLowerCase();
      const username = f.user?.username?.toLowerCase() ?? "";
      const display = f.user?.display_name?.toLowerCase() ?? "";
      return content.includes(q) || username.includes(q) || display.includes(q);
    });
  }, [feedbacks, search]);

  const visibleFeedbacks = useMemo(() => filtered.slice(0, visibleRows), [filtered, visibleRows]);
  const remainingCount = Math.max(0, filtered.length - visibleRows);

  const selectedFeedback = useMemo(
    () => feedbacks.find((f) => f.id === selectedId) ?? null,
    [feedbacks, selectedId]
  );

  // Open selection → seed admin note draft
  const handleSelect = useCallback((feedback: Feedback) => {
    // 기존 메모와 다르면 자동 저장 보장 (M12)
    // 자동 저장 타이머가 있으면 즉시 flush 후 새 항목 열기
    if (adminNoteTimerRef.current) {
      clearTimeout(adminNoteTimerRef.current);
      adminNoteTimerRef.current = null;
    }

    const note = feedback.admin_note ?? "";
    setSelectedId(feedback.id);
    setAdminNoteDraft(note);
    setAdminNoteSaved(note);
  }, []);

  // PATCH helper — single source for both status change & admin note save
  const patchFeedback = useCallback(
    async (params: { id: string; status?: FeedbackStatus; admin_note?: string }) => {
      const body: Record<string, unknown> = { id: params.id };
      if (params.status !== undefined) body.status = params.status;
      if (params.admin_note !== undefined) body.admin_note = params.admin_note;

      const response = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return response.ok;
    },
    []
  );

  // Save admin note — used by debounce + manual save
  const saveAdminNote = useCallback(
    async (id: string, note: string) => {
      setSavingNote(true);
      try {
        const ok = await patchFeedback({ id, admin_note: note });
        if (ok) {
          setAdminNoteSaved(note);
          // 로컬 cache 도 동기화 (server roundtrip 회피)
          setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, admin_note: note } : f)));
        } else {
          showToast("error", "메모 저장에 실패했습니다.");
        }
      } catch (error) {
        console.error("Save admin note failed:", error);
        showToast("error", "네트워크 오류로 메모 저장 실패");
      } finally {
        setSavingNote(false);
      }
    },
    [patchFeedback, showToast]
  );

  // Auto-save admin note (M12) — debounced
  useEffect(() => {
    if (!selectedId) return;
    if (adminNoteDraft === adminNoteSaved) return;

    if (adminNoteTimerRef.current) clearTimeout(adminNoteTimerRef.current);
    adminNoteTimerRef.current = setTimeout(() => {
      void saveAdminNote(selectedId, adminNoteDraft);
    }, ADMIN_NOTE_DEBOUNCE_MS);

    return () => {
      if (adminNoteTimerRef.current) {
        clearTimeout(adminNoteTimerRef.current);
        adminNoteTimerRef.current = null;
      }
    };
  }, [adminNoteDraft, adminNoteSaved, selectedId, saveAdminNote]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (adminNoteTimerRef.current) clearTimeout(adminNoteTimerRef.current);
    };
  }, []);

  // Open confirm — Cupid H2 (status change is destructive enough to warrant confirmation)
  const requestStatusChange = useCallback(
    (feedback: Feedback, toStatus: FeedbackStatus) => {
      if (feedback.status === toStatus) return;
      // flush pending note draft into confirm state so admin sees what'll persist
      setConfirmState({
        feedbackId: feedback.id,
        fromStatus: feedback.status,
        toStatus,
        preview: feedback.content,
        adminNote: feedback.id === selectedId ? adminNoteDraft : (feedback.admin_note ?? ""),
      });
    },
    [selectedId, adminNoteDraft]
  );

  // Confirm → execute
  const handleConfirm = useCallback(async () => {
    if (!confirmState) return;
    const { feedbackId, toStatus, adminNote } = confirmState;
    setActionLoading(feedbackId);
    try {
      const ok = await patchFeedback({
        id: feedbackId,
        status: toStatus,
        admin_note: adminNote, // 함께 저장 — admin's intent is "set status + memo together"
      });

      if (ok) {
        setAdminNoteSaved(adminNote);
        setConfirmState(null);
        showToast("success", `상태를 ${STATUS_META[toStatus].label}(으)로 변경했습니다.`);
        await fetchData();
      } else {
        showToast("error", "상태 변경에 실패했습니다.");
      }
    } catch (error) {
      console.error("Status change failed:", error);
      showToast("error", "네트워크 오류로 처리 실패");
    } finally {
      setActionLoading(null);
    }
  }, [confirmState, patchFeedback, fetchData, showToast]);

  return (
    <div
      className="space-y-5 max-w-6xl"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
        fontFeatureSettings: '"ss01", "cv11", "cv03"',
      }}
    >
      {/* Header — community / analytics-users 와 동일 스케일 */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="text-[20px] font-semibold leading-none tracking-[-0.01em] text-white/95"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            Feedback 관리
          </h1>
          <p className="mt-1.5 text-[12px] text-white/45 tracking-[-0.005em]">
            사용자 피드백 · 버그 제보 · 기능 요청 통합 관리
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          aria-label="새로고침"
          className="inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[11.5px] font-medium text-white/75 bg-white/[0.04] ring-1 ring-white/[0.08] hover:bg-white/[0.07] hover:text-white/95 hover:ring-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98]"
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

      {/* Stats Grid — macOS Widget */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="전체" value={stats.total} icon={Inbox} />
          <StatCard label="New" value={stats.new} icon={Sparkles} accent="coral" />
          <StatCard label="진행중" value={stats.in_progress} icon={Clock} accent="warning" />
          <StatCard label="해결" value={stats.resolved} icon={CheckCircle2} accent="success" />
          <StatCard label="닫힘" value={stats.closed} icon={X} accent="muted" />
        </div>
      )}

      {/* Filters — community 패턴 100% 동일 */}
      <GlassCard padded={true}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="내용 또는 닉네임 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="내용 또는 닉네임 검색"
              className="w-full pl-9 pr-3 h-8 rounded-[7px] bg-white/[0.04] ring-1 ring-white/[0.08] text-white text-[12px] placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/25 tracking-[-0.005em]"
              style={{ transition: `box-shadow 180ms ${MAC_EASE}` }}
            />
          </form>

          {/* Status Filter — Segmented (NSSegmentedControl) */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3 w-3 text-white/40" strokeWidth={1.75} aria-hidden="true" />
            <Segmented<StatusFilter>
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
              ariaLabel="상태 필터"
            />
          </div>

          {/* Type Filter — Segmented */}
          <div className="flex items-center gap-1.5">
            <Segmented<TypeFilter>
              value={typeFilter}
              onChange={setTypeFilter}
              options={TYPE_OPTIONS}
              ariaLabel="유형 필터"
            />
          </div>
        </div>
      </GlassCard>

      {/* Mail-style Split — list (left) · detail (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] gap-4">
        {/* List */}
        <div
          className="rounded-[9px] ring-1 ring-white/[0.08] overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.18)",
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <div className="inline-flex items-center gap-2 text-[12px] text-white/55 tracking-[-0.005em]">
                <Loader2
                  className="h-3.5 w-3.5 animate-spin text-[var(--color-claude-coral)]"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                로딩 중…
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center">
              <Inbox
                className="mx-auto h-5 w-5 text-white/25 mb-2"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <div className="text-[12px] text-white/40 tracking-[-0.005em]">
                {search ? "검색 결과가 없습니다" : "피드백이 없습니다"}
              </div>
            </div>
          ) : (
            <ul role="list" className="divide-y divide-white/[0.04]">
              {visibleFeedbacks.map((feedback) => {
                const isSelected = selectedId === feedback.id;
                const isUnread = feedback.status === "new";

                return (
                  <li key={feedback.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(feedback)}
                      aria-current={isSelected ? "true" : undefined}
                      className={`group w-full text-left flex items-start gap-3 px-4 py-3 focus-visible:outline-none focus-visible:bg-white/[0.04] ${
                        isSelected
                          ? "bg-[var(--color-claude-coral)]/[0.08] hover:bg-[var(--color-claude-coral)]/[0.1]"
                          : "hover:bg-white/[0.025]"
                      }`}
                      style={{ transition: `background-color 160ms ${MAC_EASE}` }}
                    >
                      {/* Unread indicator — macOS Mail blue dot equivalent (coral) */}
                      <div
                        className="flex-shrink-0 flex h-8 w-2 items-center justify-center"
                        aria-hidden="true"
                      >
                        {isUnread && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-claude-coral)]" />
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {feedback.user?.avatar_url ? (
                          <Image
                            src={feedback.user.avatar_url}
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded-full ring-1 ring-white/[0.08]"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-white/[0.06] ring-1 ring-white/[0.08] flex items-center justify-center text-[11px] text-white/40 font-medium uppercase">
                            {getInitials(feedback.user)}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Sender + date (Mail style — date right-aligned) */}
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <div className="flex items-baseline gap-1.5 min-w-0">
                            <span
                              className={`truncate text-[12.5px] tracking-[-0.005em] ${
                                isUnread
                                  ? "font-semibold text-white/95"
                                  : "font-medium text-white/85"
                              }`}
                            >
                              {getDisplayName(feedback.user)}
                            </span>
                            <span className="text-[10.5px] text-white/40 tracking-[-0.005em] shrink-0">
                              @{feedback.user?.username || "unknown"}
                            </span>
                          </div>
                          <span
                            className="text-[10.5px] text-white/40 tracking-[-0.005em] tabular-nums shrink-0"
                            style={{ fontFeatureSettings: '"tnum"' }}
                            title={new Date(feedback.created_at).toLocaleString("ko-KR")}
                          >
                            {formatRelative(feedback.created_at)}
                          </span>
                        </div>

                        {/* Subject row — type + status chips */}
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <TypeChip type={feedback.type} />
                          <StatusChip status={feedback.status} />
                          {feedback.admin_note && (
                            <span
                              className="inline-flex items-center gap-0.5 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium tracking-[-0.005em] ring-1 ring-white/[0.06] bg-white/[0.025] text-white/55"
                              title="관리자 메모 있음"
                            >
                              <MoreHorizontal
                                className="h-2.5 w-2.5"
                                strokeWidth={2}
                                aria-hidden="true"
                              />
                              메모
                            </span>
                          )}
                        </div>

                        {/* Preview */}
                        <p className="text-[11.5px] text-white/55 leading-relaxed tracking-[-0.005em] line-clamp-2">
                          {getPreviewText(feedback.content)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detail Pane */}
        <DetailPane
          feedback={selectedFeedback}
          adminNoteDraft={adminNoteDraft}
          adminNoteSaved={adminNoteSaved}
          savingNote={savingNote}
          actionLoading={actionLoading}
          onChangeNote={setAdminNoteDraft}
          onSaveNote={() => {
            if (!selectedId) return;
            if (adminNoteTimerRef.current) {
              clearTimeout(adminNoteTimerRef.current);
              adminNoteTimerRef.current = null;
            }
            void saveAdminNote(selectedId, adminNoteDraft);
          }}
          onRequestStatusChange={(s) =>
            selectedFeedback && requestStatusChange(selectedFeedback, s)
          }
        />
      </div>

      {/* Footer meta — count + load more */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <div
            className="text-[11px] text-white/45 tabular-nums tracking-[-0.005em]"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            <span className="text-white/75 font-medium">
              {visibleFeedbacks.length.toLocaleString("en-US")}
            </span>
            <span className="mx-1 text-white/25">/</span>
            <span>{filtered.length.toLocaleString("en-US")}</span>
            <span className="ml-1.5 text-white/30">표시됨</span>
          </div>

          {remainingCount > 0 && (
            <button
              type="button"
              onClick={() => setVisibleRows((v) => Math.min(filtered.length, v + LOAD_MORE_STEP))}
              className="inline-flex h-7 items-center gap-1.5 rounded-[7px] px-3 text-[11px] font-medium text-white/75 bg-white/[0.04] ring-1 ring-white/[0.08] hover:bg-white/[0.07] hover:text-white/95 hover:ring-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98]"
              style={{ transition: `all 180ms ${MAC_EASE}` }}
            >
              <span>
                더 보기{" "}
                <span
                  className="tabular-nums text-white/55"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  +{Math.min(remainingCount, LOAD_MORE_STEP)}
                </span>
              </span>
            </button>
          )}
        </div>
      )}

      {/* Confirm Sheet — Cupid H2 */}
      <ConfirmSheet
        state={confirmState}
        loading={actionLoading !== null}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmState(null)}
      />

      {/* Toast */}
      <Toast state={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

// =====================================================
// Detail Pane — macOS Mail inspector
// =====================================================
function DetailPane({
  feedback,
  adminNoteDraft,
  adminNoteSaved,
  savingNote,
  actionLoading,
  onChangeNote,
  onSaveNote,
  onRequestStatusChange,
}: {
  feedback: Feedback | null;
  adminNoteDraft: string;
  adminNoteSaved: string;
  savingNote: boolean;
  actionLoading: string | null;
  onChangeNote: (v: string) => void;
  onSaveNote: () => void;
  onRequestStatusChange: (status: FeedbackStatus) => void;
}) {
  if (!feedback) {
    return (
      <GlassCard
        padded={false}
        className="hidden lg:flex items-center justify-center min-h-[320px]"
      >
        <div className="text-center px-6">
          <Inbox
            className="mx-auto h-6 w-6 text-white/25 mb-2"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <p className="text-[12px] text-white/40 tracking-[-0.005em]">
            왼쪽에서 피드백을 선택하세요
          </p>
        </div>
      </GlassCard>
    );
  }

  const isDirty = adminNoteDraft !== adminNoteSaved;
  const statusMeta = STATUS_META[feedback.status];

  return (
    <GlassCard padded={false} className="overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <TypeChip type={feedback.type} />
          <StatusChip status={feedback.status} />
          <span
            className="ml-auto text-[10.5px] text-white/40 tabular-nums"
            style={{ fontFeatureSettings: '"tnum"' }}
            title={new Date(feedback.created_at).toLocaleString("ko-KR")}
          >
            {formatRelative(feedback.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-2.5 min-w-0">
          {feedback.user?.avatar_url ? (
            <Image
              src={feedback.user.avatar_url}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full ring-1 ring-white/[0.08] shrink-0"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-white/[0.06] ring-1 ring-white/[0.08] flex items-center justify-center text-[11px] text-white/40 font-medium uppercase shrink-0">
              {getInitials(feedback.user)}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-white/90 tracking-[-0.005em] truncate">
              {getDisplayName(feedback.user)}
            </div>
            <div className="text-[10.5px] text-white/45 tracking-[-0.005em] truncate">
              @{feedback.user?.username || "unknown"}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3 max-h-[60vh] overflow-y-auto">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40 mb-1.5">
            내용
          </div>
          <div
            className="rounded-[9px] p-3 ring-1 ring-white/[0.06] text-[12px] text-white/80 leading-relaxed tracking-[-0.005em] whitespace-pre-wrap break-words"
            style={{ background: "rgba(0,0,0,0.22)" }}
          >
            {feedback.content}
          </div>
        </div>

        {feedback.page_url && (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40 mb-1.5">
              페이지 URL
            </div>
            <div
              className="rounded-[9px] p-2.5 ring-1 ring-white/[0.06] text-[10.5px] text-white/55 leading-relaxed break-all"
              style={{ background: "rgba(0,0,0,0.18)" }}
            >
              {feedback.page_url}
            </div>
          </div>
        )}

        {feedback.user_agent && (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40 mb-1.5">
              User Agent
            </div>
            <div
              className="rounded-[9px] p-2.5 ring-1 ring-white/[0.06] text-[10.5px] text-white/55 leading-relaxed break-all"
              style={{ background: "rgba(0,0,0,0.18)" }}
            >
              {feedback.user_agent}
            </div>
          </div>
        )}

        {/* Admin Note — Mail Notes inline (M12: dirty indicator + manual save) */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">
              관리자 메모
            </div>
            <div className="flex items-center gap-1.5 text-[10px] tracking-[-0.005em]">
              {savingNote ? (
                <span className="inline-flex items-center gap-1 text-white/55">
                  <Loader2
                    className="h-2.5 w-2.5 animate-spin"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  저장 중
                </span>
              ) : isDirty ? (
                <span className="inline-flex items-center gap-1 text-amber-300/85">
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-amber-300/85" />
                  저장 안 됨
                </span>
              ) : adminNoteSaved ? (
                <span className="inline-flex items-center gap-1 text-emerald-300/85">
                  <Check className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden="true" />
                  저장됨
                </span>
              ) : null}
            </div>
          </div>
          <textarea
            value={adminNoteDraft}
            onChange={(e) => onChangeNote(e.target.value)}
            placeholder="관리자 메모 입력… (1.2 초 후 자동 저장, Cmd/Ctrl+Enter 즉시 저장)"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onSaveNote();
              }
            }}
            className="w-full p-3 rounded-[9px] ring-1 ring-white/[0.08] text-[12px] text-white/80 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/25 resize-none tracking-[-0.005em] leading-relaxed"
            rows={4}
            style={{
              background: "rgba(0,0,0,0.22)",
              transition: `box-shadow 180ms ${MAC_EASE}`,
            }}
          />
          {isDirty && (
            <div className="mt-1.5 flex items-center justify-end">
              <button
                type="button"
                onClick={onSaveNote}
                disabled={savingNote}
                className="inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[11px] font-medium text-white/75 bg-white/[0.06] ring-1 ring-white/[0.1] hover:bg-white/[0.09] hover:text-white/95 hover:ring-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98] disabled:opacity-60"
                style={{ transition: `all 180ms ${MAC_EASE}` }}
              >
                {savingNote ? (
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <Check className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
                )}
                메모 저장
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer — status actions (Cupid H2: confirmation required) */}
      <div
        className="px-4 py-3 border-t border-white/[0.06] space-y-1.5"
        style={{ background: "rgba(255,255,255,0.015)" }}
      >
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">
          상태 변경 · <span className={statusMeta.textClass}>현재 {statusMeta.label}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["new", "in_progress", "resolved", "closed"] as const).map((s) => {
            const meta = STATUS_META[s];
            const Icon = meta.icon;
            const isCurrent = feedback.status === s;
            const isLoading = actionLoading === feedback.id;

            // semantic: resolved=emerald, closed=neutral, others=coral hint
            const accent = isCurrent
              ? `bg-white/[0.08] ${meta.textClass} ring-white/[0.12] cursor-default`
              : s === "resolved"
                ? "text-emerald-300 hover:bg-emerald-400/12 ring-emerald-400/20 hover:ring-emerald-400/35"
                : s === "closed"
                  ? "text-white/65 hover:bg-white/[0.06] ring-white/[0.1] hover:ring-white/[0.18]"
                  : "text-[var(--color-claude-coral)] hover:bg-[var(--color-claude-coral)]/12 ring-[var(--color-claude-coral)]/20 hover:ring-[var(--color-claude-coral)]/35";

            return (
              <button
                key={s}
                type="button"
                onClick={() => onRequestStatusChange(s)}
                disabled={isCurrent || isLoading}
                aria-label={isCurrent ? `현재 상태: ${meta.label}` : `${meta.label}으로 변경`}
                className={`inline-flex h-7 items-center gap-1 rounded-[6px] px-2.5 text-[10.5px] font-medium tracking-[-0.005em] ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98] disabled:opacity-60 ${accent}`}
                style={{ transition: `all 180ms ${MAC_EASE}` }}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <Icon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                )}
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
