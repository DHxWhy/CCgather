"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  Activity,
  AlertTriangle,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Hash,
  HelpCircle,
  Heart,
  MessageSquare,
  RefreshCw,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// =====================================================
// macOS Big Sur+ Easing — 이전 8 페이지 (ai-usage / analytics / users 등) 100% 동일
// =====================================================
const MAC_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// 최초 표시 행 수. UI 만 안내 — 데이터 한도 (limit=100) 유지 (Cupid H7)
const INITIAL_VISIBLE_ROWS = 30;
const LOAD_MORE_STEP = 30;

// Undo timeout — Cupid H1 표준
const UNDO_TIMEOUT_MS = 5000;

// =====================================================
// API contract types — 변경 X
// =====================================================
interface Author {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface TimelineItem {
  type: "post" | "comment" | "deletion";
  id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
  author: Author | null;
  extra: {
    tab?: string;
    likes_count?: number;
    comments_count?: number;
    post_id?: string;
    parent_comment_id?: string;
    content_type?: "post" | "comment";
    deleted_by_role?: "owner" | "admin";
    cascade_deleted_comments?: number;
    cascade_deleted_replies?: number;
    reason?: string;
  };
}

interface Stats {
  totalPosts: number;
  totalComments: number;
  todayPosts: number;
  deletedPosts: number;
  deletedComments: number;
}

type TypeFilter = "all" | "post" | "comment" | "deletion";

// Item 의 cascade 영향 예상치 (게시물 → 댓글 카운트)
function getCascadeImpact(item: TimelineItem): number {
  if (item.type === "post") return item.extra.comments_count ?? 0;
  return 0;
}

// =====================================================
// Frosted Card — ai-usage 패턴 100% 재사용
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
  children: ReactNode;
  title?: string;
  caption?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
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
// StatCard — ai-usage / analytics-users 패턴 100% 재사용 (macOS Widget)
// =====================================================
interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: "neutral" | "coral" | "success" | "warning";
}

function StatCard({ label, value, icon: Icon, accent = "neutral" }: StatCardProps) {
  const accentColor =
    accent === "coral"
      ? "text-[var(--color-claude-coral)]"
      : accent === "success"
        ? "text-emerald-300"
        : accent === "warning"
          ? "text-amber-200"
          : "text-white";

  const iconBg =
    accent === "coral"
      ? "bg-[var(--color-claude-coral)]/12 text-[var(--color-claude-coral)] ring-[var(--color-claude-coral)]/20"
      : accent === "success"
        ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
        : accent === "warning"
          ? "bg-amber-400/10 text-amber-200 ring-amber-400/20"
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
// Focus Trap Hook — ai-usage 와 100% 동일 (WCAG 2.4.3)
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
// Type Badge — pill 카드 (cascade pill 통일성)
// =====================================================
type TypeBadgeKind = "post" | "comment" | "reply" | "deletion";

function getTypeBadge(item: TimelineItem): {
  icon: ReactNode;
  label: string;
  kind: TypeBadgeKind;
} {
  if (item.type === "post") {
    return {
      icon: <FileText className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />,
      label: "게시물",
      kind: "post",
    };
  }
  if (item.type === "comment") {
    const isReply = !!item.extra.parent_comment_id;
    return {
      icon: <MessageSquare className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />,
      label: isReply ? "대댓글" : "댓글",
      kind: isReply ? "reply" : "comment",
    };
  }
  return {
    icon: <Trash2 className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />,
    label: `${item.extra.content_type === "post" ? "게시물" : "댓글"} 삭제`,
    kind: "deletion",
  };
}

// Type chip — coral 단일 액센트 + 무채색 + semantic dot
function TypeChip({ item }: { item: TimelineItem }) {
  const badge = getTypeBadge(item);
  const isDeletion = badge.kind === "deletion";

  // 비주얼: 모든 chip 동일 톤 (무채색), semantic dot 만 의미 표현
  const dotColor = isDeletion
    ? "bg-rose-300"
    : badge.kind === "post"
      ? "bg-[var(--color-claude-coral)]"
      : "bg-white/55";

  return (
    <span
      className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium tracking-[-0.005em] ring-1 ring-white/[0.08] bg-white/[0.04] text-white/75"
      aria-label={badge.label}
    >
      <span aria-hidden="true" className={`h-1 w-1 rounded-full ${dotColor}`} />
      {badge.icon}
      {badge.label}
    </span>
  );
}

// =====================================================
// Confirmation Sheet (Cupid H1) — macOS Sheet + Focus Trap
// =====================================================
interface ConfirmActionState {
  type: "post" | "comment";
  id: string;
  action: "hide" | "restore";
  preview: string;
  cascadeImpact: number;
}

function ConfirmSheet({
  state,
  loading,
  onConfirm,
  onCancel,
}: {
  state: ConfirmActionState | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const containerRef = useFocusTrap(!!state, onCancel);

  if (!state) return null;

  const isHide = state.action === "hide";
  const hasCascade = isHide && state.cascadeImpact > 0;
  const targetLabel = state.type === "post" ? "게시물" : "댓글";
  const actionLabel = isHide ? "숨김" : "복구";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onCancel}
        disabled={loading}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm focus-visible:outline-none disabled:cursor-wait"
        tabIndex={-1}
      />

      {/* Sheet */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="relative w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl ring-1 ring-white/[0.08] focus-visible:outline-none"
        style={{
          background: "linear-gradient(180deg, rgba(40,40,42,0.92) 0%, rgba(28,28,30,0.92) 100%)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          boxShadow:
            "0 25px 50px -12px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${
                isHide
                  ? "bg-[var(--color-claude-coral)]/12 ring-[var(--color-claude-coral)]/22 text-[var(--color-claude-coral)]"
                  : "bg-emerald-400/10 ring-emerald-400/22 text-emerald-300"
              }`}
              aria-hidden="true"
            >
              {isHide ? (
                <EyeOff className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={1.75} />
              )}
            </div>
            <div className="min-w-0">
              <h3
                id={titleId}
                className="text-[14px] font-semibold tracking-[-0.01em] text-white/95"
                style={{ fontFeatureSettings: '"ss01"' }}
              >
                {targetLabel} {actionLabel} 확인
              </h3>
              <p id={descId} className="mt-0.5 text-[11.5px] text-white/55 tracking-[-0.005em]">
                {isHide ? "사용자에게 더 이상 노출되지 않습니다." : "다시 사용자에게 노출됩니다."}
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

        {/* Body */}
        <div className="px-5 pb-3 space-y-3">
          {/* Content preview */}
          <div
            className="rounded-[9px] p-3 ring-1 ring-white/[0.06]"
            style={{ background: "rgba(0,0,0,0.22)" }}
          >
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40 mb-1">
              대상 미리보기
            </div>
            <p className="text-[12px] text-white/75 leading-relaxed tracking-[-0.005em] line-clamp-3">
              {state.preview || "[내용 없음]"}
            </p>
          </div>

          {/* Cascade warning — only on hide with comments */}
          {hasCascade && (
            <div
              className="flex items-start gap-2.5 rounded-[9px] p-3 ring-1 ring-amber-400/22"
              style={{ background: "rgba(251,191,36,0.06)" }}
              role="alert"
            >
              <AlertTriangle
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <div className="text-[11.5px] text-amber-100/85 tracking-[-0.005em] leading-relaxed">
                <span className="font-semibold text-amber-100">
                  연쇄 영향: {state.cascadeImpact.toLocaleString("en-US")}개 댓글
                </span>
                <span className="text-amber-100/65"> 이 함께 노출에서 제외됩니다.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer — segmented confirm */}
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
            className={`inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3.5 text-[11.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 active:scale-[0.98] disabled:opacity-60 ${
              isHide
                ? "bg-[var(--color-claude-coral)]/90 hover:bg-[var(--color-claude-coral)] text-white ring-1 ring-[var(--color-claude-coral)]/45"
                : "bg-emerald-400/90 hover:bg-emerald-400 text-black ring-1 ring-emerald-400/55"
            }`}
            style={{ transition: `all 180ms ${MAC_EASE}` }}
          >
            {loading ? (
              <>
                <span
                  className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden="true"
                />
                <span>처리 중</span>
              </>
            ) : (
              <>
                {isHide ? (
                  <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
                ) : (
                  <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                )}
                <span>{actionLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Undo Banner (Cupid H1) — macOS bottom-anchored snackbar
// =====================================================
interface UndoState {
  kind: "success" | "error";
  message: string;
  reversedAction: "hide" | "restore";
  type: "post" | "comment";
  id: string;
  expiresAt: number;
}

function UndoBanner({
  state,
  onUndo,
  onDismiss,
  undoing,
}: {
  state: UndoState | null;
  onUndo: () => void;
  onDismiss: () => void;
  undoing: boolean;
}) {
  const [remaining, setRemaining] = useState(100);

  useEffect(() => {
    if (!state) {
      setRemaining(100);
      return;
    }

    const totalMs = state.expiresAt - Date.now();
    if (totalMs <= 0) {
      onDismiss();
      return;
    }

    const interval = setInterval(() => {
      const left = state.expiresAt - Date.now();
      const pct = Math.max(0, (left / UNDO_TIMEOUT_MS) * 100);
      setRemaining(pct);
      if (left <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 80);

    return () => clearInterval(interval);
  }, [state, onDismiss]);

  if (!state) return null;

  const isError = state.kind === "error";
  const progressColor = isError ? "bg-rose-300/85" : "bg-[var(--color-claude-coral)]/85";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex items-end justify-center px-4"
      aria-live={isError ? "assertive" : "polite"}
      role={isError ? "alert" : "status"}
    >
      <div
        className="pointer-events-auto relative w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[11px] ring-1 ring-white/[0.1]"
        style={{
          background: "linear-gradient(180deg, rgba(40,40,42,0.94) 0%, rgba(28,28,30,0.94) 100%)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          boxShadow: "0 18px 36px -10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)",
        }}
      >
        {/* Top progress bar */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-white/[0.06]" aria-hidden="true">
          <div
            className={`h-full ${progressColor}`}
            style={{
              width: `${remaining}%`,
              transition: "width 80ms linear",
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            {isError && (
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0 text-rose-300"
                strokeWidth={2}
                aria-hidden="true"
              />
            )}
            <p className="text-[12px] text-white/85 tracking-[-0.005em] leading-tight">
              {state.message}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isError && (
              <button
                type="button"
                onClick={onUndo}
                disabled={undoing}
                className="inline-flex h-7 items-center gap-1 rounded-[6px] px-2.5 text-[11px] font-semibold text-[var(--color-claude-coral)] hover:bg-[var(--color-claude-coral)]/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-claude-coral)]/35 active:scale-[0.98] disabled:opacity-60"
                style={{ transition: `all 180ms ${MAC_EASE}` }}
                aria-label="실행 취소"
              >
                {undoing ? (
                  <span
                    className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-claude-coral)]/30 border-t-[var(--color-claude-coral)]"
                    aria-hidden="true"
                  />
                ) : (
                  <Undo2 className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                )}
                실행 취소
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="닫기"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/45 hover:bg-white/[0.06] hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.95]"
              style={{ transition: `all 180ms ${MAC_EASE}` }}
            >
              <X className="h-[13px] w-[13px]" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Filter — NSSegmentedControl 패턴 (이전 페이지 100% 동일)
// =====================================================
const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "post", label: "게시물" },
  { value: "comment", label: "댓글" },
  { value: "deletion", label: "삭제기록" },
];

function TypeSegmented({
  value,
  onChange,
}: {
  value: TypeFilter;
  onChange: (v: TypeFilter) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="타입 필터"
      className="inline-flex items-center rounded-[7px] p-0.5 ring-1 ring-white/[0.08]"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {TYPE_OPTIONS.map((opt) => {
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

function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

// =====================================================
// Main Page
// =====================================================
export default function AdminCommunityPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [visibleRows, setVisibleRows] = useState(INITIAL_VISIBLE_ROWS);

  // Confirm + Undo state
  const [confirmState, setConfirmState] = useState<ConfirmActionState | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [undoing, setUndoing] = useState(false);

  // Fetch stats (cancellable)
  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/admin/community?view=overview", {
        signal,
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      console.error("Error fetching stats:", error);
    }
  }, []);

  // Fetch timeline (cancellable)
  const fetchTimeline = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          view: "timeline",
          type: typeFilter,
          includeDeleted: includeDeleted.toString(),
          search,
          limit: "100",
        });

        const response = await fetch(`/api/admin/community?${params}`, {
          signal,
        });
        if (response.ok) {
          const data = await response.json();
          setTimeline(data.timeline || []);
          setVisibleRows(INITIAL_VISIBLE_ROWS); // reset window on each fetch
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Error fetching timeline:", error);
      } finally {
        setLoading(false);
      }
    },
    [typeFilter, includeDeleted, search]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchStats(controller.signal);
    return () => controller.abort();
  }, [fetchStats]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTimeline(controller.signal);
    return () => controller.abort();
  }, [fetchTimeline]);

  // Refresh both
  const refresh = useCallback(() => {
    fetchStats();
    fetchTimeline();
  }, [fetchStats, fetchTimeline]);

  // Submit search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  // Open confirm sheet (Cupid H1: pre-action confirmation)
  const requestAction = useCallback((item: TimelineItem) => {
    const isDeleted = item.deleted_at !== null;
    const action: "hide" | "restore" = isDeleted ? "restore" : "hide";
    setConfirmState({
      type: item.type as "post" | "comment",
      id: item.id,
      action,
      preview: item.content,
      cascadeImpact: getCascadeImpact(item),
    });
  }, []);

  // Internal — perform API call (used both for confirm and undo)
  const performAction = useCallback(
    async (params: { type: "post" | "comment"; id: string; action: "hide" | "restore" }) => {
      const response = await fetch(`/api/admin/community/${params.type}s/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: params.action }),
      });
      return response.ok;
    },
    []
  );

  // Confirm sheet → execute (Cupid H1: post-action undo)
  const handleConfirm = useCallback(async () => {
    if (!confirmState) return;
    setActionLoading(confirmState.id);
    try {
      const ok = await performAction({
        type: confirmState.type,
        id: confirmState.id,
        action: confirmState.action,
      });

      if (ok) {
        const targetLabel = confirmState.type === "post" ? "게시물" : "댓글";
        const actionLabel = confirmState.action === "hide" ? "숨김" : "복구";

        // Surface undo affordance
        setUndoState({
          kind: "success",
          message: `${targetLabel}을(를) ${actionLabel} 처리했습니다.`,
          reversedAction: confirmState.action === "hide" ? "restore" : "hide",
          type: confirmState.type,
          id: confirmState.id,
          expiresAt: Date.now() + UNDO_TIMEOUT_MS,
        });

        setConfirmState(null);
        refresh();
      } else {
        // Visible failure — error banner only (no undo affordance)
        setUndoState({
          kind: "error",
          message: "처리에 실패했습니다. 다시 시도해 주세요.",
          reversedAction: "restore",
          type: confirmState.type,
          id: confirmState.id,
          expiresAt: Date.now() + UNDO_TIMEOUT_MS,
        });
        setConfirmState(null);
      }
    } catch (error) {
      console.error("Action failed:", error);
      setUndoState({
        kind: "error",
        message: "네트워크 오류가 발생했습니다.",
        reversedAction: "restore",
        type: confirmState.type,
        id: confirmState.id,
        expiresAt: Date.now() + UNDO_TIMEOUT_MS,
      });
      setConfirmState(null);
    } finally {
      setActionLoading(null);
    }
  }, [confirmState, performAction, refresh]);

  // Undo banner → reverse the just-performed action
  const handleUndo = useCallback(async () => {
    if (!undoState || undoState.kind !== "success") return;
    setUndoing(true);
    try {
      const ok = await performAction({
        type: undoState.type,
        id: undoState.id,
        action: undoState.reversedAction,
      });

      if (ok) {
        setUndoState(null);
        refresh();
      } else {
        // Replace with error banner — surface failure
        setUndoState({
          kind: "error",
          message: "실행 취소에 실패했습니다.",
          reversedAction: undoState.reversedAction,
          type: undoState.type,
          id: undoState.id,
          expiresAt: Date.now() + UNDO_TIMEOUT_MS,
        });
      }
    } catch (error) {
      console.error("Undo failed:", error);
      setUndoState({
        kind: "error",
        message: "네트워크 오류로 실행 취소에 실패했습니다.",
        reversedAction: undoState.reversedAction,
        type: undoState.type,
        id: undoState.id,
        expiresAt: Date.now() + UNDO_TIMEOUT_MS,
      });
    } finally {
      setUndoing(false);
    }
  }, [undoState, performAction, refresh]);

  // Visible slice (Cupid H7)
  const visibleTimeline = useMemo(() => timeline.slice(0, visibleRows), [timeline, visibleRows]);
  const remainingCount = Math.max(0, timeline.length - visibleRows);

  return (
    <div
      className="space-y-5 max-w-6xl"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
        fontFeatureSettings: '"ss01", "cv11", "cv03"',
      }}
    >
      {/* Header — analytics/users 와 동일 스케일 */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="text-[20px] font-semibold leading-none tracking-[-0.01em] text-white/95"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            Community 관리
          </h1>
          <p className="mt-1.5 text-[12px] text-white/45 tracking-[-0.005em]">
            전체 활동 타임라인 · 게시물 · 댓글 · 삭제 기록 통합 관리
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
          <StatCard label="전체 Posts" value={stats.totalPosts} icon={FileText} />
          <StatCard label="전체 Comments" value={stats.totalComments} icon={MessageSquare} />
          <StatCard label="오늘 Posts" value={stats.todayPosts} icon={Activity} accent="coral" />
          <StatCard
            label="숨김 (Posts)"
            value={stats.deletedPosts}
            icon={EyeOff}
            accent="warning"
          />
          <StatCard
            label="숨김 (Comments)"
            value={stats.deletedComments}
            icon={EyeOff}
            accent="warning"
          />
        </div>
      )}

      {/* Filters */}
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

          {/* Type Filter — Segmented */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3 w-3 text-white/40" strokeWidth={1.75} aria-hidden="true" />
            <TypeSegmented value={typeFilter} onChange={setTypeFilter} />
          </div>

          {/* Include Deleted Toggle */}
          <label className="flex items-center gap-1.5 text-[11.5px] text-white/65 cursor-pointer ml-auto select-none">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/20 bg-white/[0.04] text-[var(--color-claude-coral)] focus:ring-1 focus:ring-[var(--color-claude-coral)]/40 focus:ring-offset-0"
            />
            <span className="tracking-[-0.005em]">숨김 포함</span>
          </label>
        </div>
      </GlassCard>

      {/* Timeline — Calendar/Activity 스타일 */}
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
              <span
                className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/15 border-t-[var(--color-claude-coral)]"
                aria-hidden="true"
              />
              로딩 중…
            </div>
          </div>
        ) : timeline.length === 0 ? (
          <div className="py-14 text-center">
            <HelpCircle
              className="mx-auto h-5 w-5 text-white/25 mb-2"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div className="text-[12px] text-white/40 tracking-[-0.005em]">
              {search ? "검색 결과가 없습니다" : "활동 기록이 없습니다"}
            </div>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-white/[0.04]">
            {visibleTimeline.map((item) => (
              <TimelineRow
                key={`${item.type}-${item.id}`}
                item={item}
                actionLoading={actionLoading === item.id}
                onActionRequest={() => requestAction(item)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer meta — count + load more (Cupid H7) */}
      {!loading && timeline.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <div
            className="text-[11px] text-white/45 tabular-nums tracking-[-0.005em]"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            <span className="text-white/75 font-medium">
              {visibleTimeline.length.toLocaleString("en-US")}
            </span>
            <span className="mx-1 text-white/25">/</span>
            <span>{timeline.length.toLocaleString("en-US")}</span>
            <span className="ml-1.5 text-white/30">표시됨</span>
            {timeline.length >= 100 && (
              <span className="ml-2 text-amber-200/65">· 최대 100건 (필터로 좁히기)</span>
            )}
          </div>

          {remainingCount > 0 && (
            <button
              type="button"
              onClick={() => setVisibleRows((v) => Math.min(timeline.length, v + LOAD_MORE_STEP))}
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

      {/* Confirm Sheet — Cupid H1 */}
      <ConfirmSheet
        state={confirmState}
        loading={actionLoading !== null}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmState(null)}
      />

      {/* Undo Banner — Cupid H1 */}
      <UndoBanner
        state={undoState}
        onUndo={handleUndo}
        onDismiss={() => setUndoState(null)}
        undoing={undoing}
      />
    </div>
  );
}

// =====================================================
// Timeline Row — extracted for clarity
// =====================================================
function TimelineRow({
  item,
  actionLoading,
  onActionRequest,
}: {
  item: TimelineItem;
  actionLoading: boolean;
  onActionRequest: () => void;
}) {
  const isDeleted = item.deleted_at !== null;
  const isDeletion = item.type === "deletion";
  const cascadeComments = item.extra.cascade_deleted_comments ?? 0;
  const cascadeReplies = item.extra.cascade_deleted_replies ?? 0;
  const hasCascade = cascadeComments > 0 || cascadeReplies > 0;

  return (
    <li
      className={`group flex items-start gap-3 px-4 py-3 hover:bg-white/[0.025] ${
        isDeleted ? "opacity-55" : ""
      }`}
      style={{ transition: `background-color 160ms ${MAC_EASE}` }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {item.author?.avatar_url ? (
          <Image
            src={item.author.avatar_url}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-full ring-1 ring-white/[0.08]"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-white/[0.06] ring-1 ring-white/[0.08] flex items-center justify-center text-[11px] text-white/40 font-medium uppercase">
            {item.author?.username?.charAt(0) || "?"}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <span className="text-[12px] font-medium text-white/90 tracking-[-0.005em]">
            {item.author?.display_name || item.author?.username || "알 수 없음"}
          </span>
          <span className="text-[10.5px] text-white/40 tracking-[-0.005em]">
            @{item.author?.username || "unknown"}
          </span>

          <TypeChip item={item} />

          {isDeletion && item.extra.deleted_by_role && (
            <span
              className={`inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium tracking-[-0.005em] ring-1 ${
                item.extra.deleted_by_role === "admin"
                  ? "ring-rose-300/22 bg-rose-300/10 text-rose-200"
                  : "ring-white/[0.08] bg-white/[0.04] text-white/65"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1 w-1 rounded-full ${
                  item.extra.deleted_by_role === "admin" ? "bg-rose-300" : "bg-white/55"
                }`}
              />
              {item.extra.deleted_by_role === "admin" ? "Admin" : "본인"}
            </span>
          )}

          {item.extra.tab && (
            <span className="inline-flex items-center gap-0.5 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium tracking-[-0.005em] ring-1 ring-white/[0.06] bg-white/[0.025] text-white/55">
              <Hash className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />
              {item.extra.tab}
            </span>
          )}
        </div>

        {/* Body */}
        <p className="text-[12px] text-white/65 mb-1.5 leading-relaxed tracking-[-0.005em]">
          {truncate(item.content, 150)}
        </p>

        {/* Footer */}
        <div className="flex items-center gap-3 text-[10.5px] text-white/40 tracking-[-0.005em] flex-wrap">
          <span
            className="tabular-nums"
            style={{ fontFeatureSettings: '"tnum"' }}
            title={new Date(item.created_at).toLocaleString("ko-KR")}
          >
            {formatRelative(item.created_at)}
          </span>

          {!isDeletion && (
            <>
              {item.extra.likes_count !== undefined && (
                <span
                  className="inline-flex items-center gap-1 tabular-nums"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  <Heart className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />
                  {item.extra.likes_count.toLocaleString("en-US")}
                </span>
              )}
              {item.extra.comments_count !== undefined && (
                <span
                  className="inline-flex items-center gap-1 tabular-nums"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  <MessageSquare className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />
                  {item.extra.comments_count.toLocaleString("en-US")}
                </span>
              )}
            </>
          )}

          {isDeletion && hasCascade && (
            <span
              className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium tracking-[-0.005em] ring-1 ring-amber-300/22 bg-amber-300/8 text-amber-200/90"
              title="연쇄 삭제된 항목 수"
            >
              <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />
              <span className="tabular-nums" style={{ fontFeatureSettings: '"tnum"' }}>
                연쇄 {(cascadeComments + cascadeReplies).toLocaleString("en-US")}건
              </span>
            </span>
          )}

          {isDeletion && item.extra.reason && (
            <span className="text-white/35 truncate max-w-[240px]">사유: {item.extra.reason}</span>
          )}
        </div>
      </div>

      {/* Action (only posts/comments) */}
      {!isDeletion && (
        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={onActionRequest}
            disabled={actionLoading}
            aria-label={
              isDeleted
                ? `${item.type === "post" ? "게시물" : "댓글"} 복구`
                : `${item.type === "post" ? "게시물" : "댓글"} 숨김`
            }
            className={`inline-flex h-7 items-center gap-1 rounded-[6px] px-2.5 text-[10.5px] font-medium tracking-[-0.005em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98] disabled:opacity-50 ${
              isDeleted
                ? "text-emerald-300 hover:bg-emerald-400/12 ring-1 ring-emerald-400/20 hover:ring-emerald-400/35"
                : "text-[var(--color-claude-coral)] hover:bg-[var(--color-claude-coral)]/12 ring-1 ring-[var(--color-claude-coral)]/20 hover:ring-[var(--color-claude-coral)]/35"
            }`}
            style={{ transition: `all 180ms ${MAC_EASE}` }}
          >
            {actionLoading ? (
              <span
                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
            ) : isDeleted ? (
              <Eye className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            ) : (
              <EyeOff className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            )}
            <span>{isDeleted ? "복구" : "숨김"}</span>
          </button>
        </div>
      )}
    </li>
  );
}
