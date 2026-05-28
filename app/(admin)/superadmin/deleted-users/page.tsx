"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Calendar,
  Globe2,
  HelpCircle,
  Mail,
  RefreshCw,
  Search,
  Trash2,
  UserMinus,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FlagIcon } from "@/components/ui/FlagIcon";

// =====================================================
// macOS Big Sur+ Easing — 이전 9 페이지 (ai-usage / analytics / community 등) 100% 동일
// =====================================================
const MAC_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// Grace period — 탈퇴 후 30일 보관 표준
const GRACE_PERIOD_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// 표시 행 수 (Cupid H7) — UI 한도, 데이터 한도 X
const INITIAL_VISIBLE_ROWS = 30;
const LOAD_MORE_STEP = 30;

// Search debounce — Cupid H6
const SEARCH_DEBOUNCE_MS = 220;

// Coral CSS variable token — 전 페이지 동일
const CORAL_RGB = "218,119,86"; // var(--color-claude-coral) 의 RGB

// =====================================================
// API contract types — 변경 X
// =====================================================
interface DeletedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  country_code: string | null;
  total_tokens: number;
  total_cost: number;
  global_rank: number | null;
  created_at: string;
  deleted_at: string;
  ccplan: string | null;
}

type PlanFilter = "all" | "free" | "pro" | "max" | "team" | "enterprise" | "none";

// =====================================================
// Grace period 계산 — 사용자 facing 핵심 정보
// =====================================================
interface GraceState {
  remainingDays: number;
  expiredDays: number; // 음수 = 만료 후 며칠
  progressPercent: number; // 0~100 (남은 비율, 100 = 갓 탈퇴, 0 = 만료 시점)
  status: "fresh" | "midway" | "imminent" | "expired";
}

function computeGrace(deletedAt: string): GraceState {
  const deletedTime = new Date(deletedAt).getTime();
  const expiresTime = deletedTime + GRACE_PERIOD_DAYS * MS_PER_DAY;
  const now = Date.now();
  const remainingMs = expiresTime - now;
  const remainingDays = Math.ceil(remainingMs / MS_PER_DAY);

  // 진행률: 남은 시간 / 전체 grace period
  const rawPercent = Math.max(0, Math.min(1, remainingMs / (GRACE_PERIOD_DAYS * MS_PER_DAY)));
  const progressPercent = Math.round(rawPercent * 100);

  // status 등급
  let status: GraceState["status"];
  if (remainingDays <= 0) status = "expired";
  else if (remainingDays <= 3) status = "imminent";
  else if (remainingDays <= 14) status = "midway";
  else status = "fresh";

  return {
    remainingDays: Math.max(0, remainingDays),
    expiredDays: remainingDays < 0 ? -remainingDays : 0,
    progressPercent,
    status,
  };
}

// =====================================================
// GlassCard — frosted glass container (이전 페이지 100% 재사용)
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
// StatCard — macOS Widget (이전 페이지 100% 재사용)
// =====================================================
interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: "neutral" | "coral" | "success" | "warning";
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
          {caption && (
            <div className="mt-0.5 text-[10px] text-white/30 tracking-[-0.005em]">{caption}</div>
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
// Plan Filter — NSSegmentedControl 패턴 (이전 페이지 100% 동일)
// =====================================================
const PLAN_OPTIONS: { value: PlanFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "max", label: "Max" },
  { value: "team", label: "Team" },
  { value: "enterprise", label: "Ent" },
];

function PlanSegmented({
  value,
  onChange,
}: {
  value: PlanFilter;
  onChange: (v: PlanFilter) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="플랜 필터"
      className="inline-flex items-center rounded-[7px] p-0.5 ring-1 ring-white/[0.08]"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {PLAN_OPTIONS.map((opt) => {
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
// PlanBadge — 무채색 + semantic dot (coral 단일 정책)
// =====================================================
function PlanBadge({ plan }: { plan: string | null }) {
  if (!plan) {
    return (
      <span className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium tracking-[-0.005em] ring-1 ring-white/[0.06] bg-white/[0.025] text-white/40">
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-white/30" />
        none
      </span>
    );
  }

  const normalized = plan.toLowerCase();

  // 의미적 점진 강도 — coral 단일색 + dot 으로 등급 신호
  const dotColor =
    normalized === "enterprise"
      ? "bg-[var(--color-claude-coral)]"
      : normalized === "team"
        ? "bg-[var(--color-claude-coral)]/80"
        : normalized === "max"
          ? "bg-[var(--color-claude-coral)]/60"
          : normalized === "pro"
            ? "bg-white/65"
            : "bg-white/35";

  return (
    <span
      className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] ring-1 ring-white/[0.08] bg-white/[0.04] text-white/75"
      aria-label={`플랜 ${normalized}`}
    >
      <span aria-hidden="true" className={`h-1 w-1 rounded-full ${dotColor}`} />
      {normalized}
    </span>
  );
}

// =====================================================
// Grace Period Progress — macOS progress bar (요구사항 핵심)
// 30일 중 남은 일수 시각화 + status pill
// =====================================================
function GracePeriodBar({ grace }: { grace: GraceState }) {
  const isExpired = grace.status === "expired";
  const isImminent = grace.status === "imminent";

  // 시각 강도 — fresh = 부드러운 white, midway = 부드러운 coral, imminent = 강한 coral, expired = rose
  const fillBg = isExpired
    ? `linear-gradient(90deg, rgba(244,114,128,0.92) 0%, rgba(244,114,128,0.65) 100%)`
    : isImminent
      ? `linear-gradient(90deg, rgba(${CORAL_RGB},1) 0%, rgba(${CORAL_RGB},0.75) 100%)`
      : grace.status === "midway"
        ? `linear-gradient(90deg, rgba(${CORAL_RGB},0.85) 0%, rgba(${CORAL_RGB},0.6) 100%)`
        : `linear-gradient(90deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.35) 100%)`;

  const statusDot = isExpired
    ? "bg-rose-300"
    : isImminent
      ? "bg-[var(--color-claude-coral)]"
      : grace.status === "midway"
        ? "bg-amber-300"
        : "bg-white/55";

  const statusLabel = isExpired
    ? `만료 +${grace.expiredDays}일`
    : isImminent
      ? `${grace.remainingDays}일 남음`
      : `${grace.remainingDays}일 남음`;

  // a11y aria-label
  const ariaLabel = isExpired
    ? `Grace period 만료 ${grace.expiredDays}일 경과 (영구 삭제 대상)`
    : `Grace period ${grace.remainingDays}일 남음 (총 ${GRACE_PERIOD_DAYS}일 중 ${grace.progressPercent}% 진행)`;

  return (
    <div className="inline-flex items-center gap-2 min-w-[148px]">
      {/* Progress bar */}
      <div
        className="flex-1 h-1.5 rounded-[3px] overflow-hidden ring-1 ring-white/[0.04]"
        style={{ background: "rgba(255,255,255,0.04)" }}
        role="meter"
        aria-valuenow={grace.progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
      >
        <div
          className="h-full rounded-[3px]"
          style={{
            width: `${Math.max(2, grace.progressPercent)}%`,
            background: fillBg,
            transition: `width 420ms ${MAC_EASE}`,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        />
      </div>
      {/* Status pill */}
      <span
        className={`inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium tabular-nums tracking-[-0.005em] ring-1 shrink-0 ${
          isExpired
            ? "ring-rose-300/22 bg-rose-300/10 text-rose-200"
            : isImminent
              ? "ring-[var(--color-claude-coral)]/22 bg-[var(--color-claude-coral)]/10 text-[var(--color-claude-coral)]"
              : "ring-white/[0.08] bg-white/[0.04] text-white/75"
        }`}
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        <span aria-hidden="true" className={`h-1 w-1 rounded-full ${statusDot}`} />
        {statusLabel}
      </span>
    </div>
  );
}

// =====================================================
// Formatters
// =====================================================
function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + "B";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toLocaleString("en-US");
}

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

function formatDateShort(date: string): string {
  return new Date(date).toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(date: string): string {
  return new Date(date).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =====================================================
// Main Page
// =====================================================
export default function DeletedUsersPage() {
  const [users, setUsers] = useState<DeletedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [visibleRows, setVisibleRows] = useState(INITIAL_VISIBLE_ROWS);

  // grace period 라이브 카운트다운 — 1분마다 재계산 (1시간 단위 정확도면 충분, 60s tick)
  const [now, setNow] = useState(() => Date.now());
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Search — debounced via useDeferredValue (Cupid H6)
  const deferredSearch = useDeferredValue(searchInput);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(deferredSearch), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [deferredSearch]);

  // Live tick — grace period UI 정확도 (1분 단위)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Fetch
  const fetchDeletedUsers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/deleted-users", { signal });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setVisibleRows(INITIAL_VISIBLE_ROWS);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      console.error("Failed to fetch deleted users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchDeletedUsers(controller.signal);
    return () => controller.abort();
  }, [fetchDeletedUsers]);

  // Keyboard shortcut — "/" 키로 검색 포커스 (macOS Spotlight 유사, Cupid H5)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isTyping =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement;
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearchInput("");
        searchInputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Grace state per user (now 변경 시 재계산)
  const enrichedUsers = useMemo(
    () =>
      users.map((u) => ({
        user: u,
        grace: computeGrace(u.deleted_at),
      })),
    // now 의존성: live tick 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, now]
  );

  // Filtered list — 검색 + plan filter
  const filteredUsers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return enrichedUsers.filter(({ user }) => {
      // plan filter
      if (planFilter !== "all") {
        const userPlan = (user.ccplan || "none").toLowerCase();
        if (planFilter === "none" && userPlan !== "none") return false;
        if (planFilter !== "none" && userPlan !== planFilter) return false;
      }
      // search
      if (!q) return true;
      return (
        user.username.toLowerCase().includes(q) ||
        (user.email?.toLowerCase().includes(q) ?? false) ||
        (user.display_name?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [enrichedUsers, debouncedSearch, planFilter]);

  // Stats — Trash 메타포 (전체 / imminent / expired / 오늘 탈퇴)
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    let imminent = 0;
    let expired = 0;
    let todayCount = 0;
    for (const { user, grace } of enrichedUsers) {
      if (grace.status === "imminent") imminent += 1;
      if (grace.status === "expired") expired += 1;
      if (new Date(user.deleted_at).getTime() >= todayTs) todayCount += 1;
    }
    return {
      total: enrichedUsers.length,
      imminent,
      expired,
      today: todayCount,
    };
  }, [enrichedUsers]);

  const visibleSlice = useMemo(
    () => filteredUsers.slice(0, visibleRows),
    [filteredUsers, visibleRows]
  );
  const remainingCount = Math.max(0, filteredUsers.length - visibleRows);

  return (
    <div
      className="space-y-5 max-w-6xl"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
        fontFeatureSettings: '"ss01", "cv11", "cv03"',
      }}
    >
      {/* ─────────── Header — analytics/users / community 와 100% 동일 패턴 ─────────── */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Trash2 className="h-3.5 w-3.5 text-white/40" strokeWidth={1.75} aria-hidden="true" />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40">
              Admin · Deleted Users
            </span>
          </div>
          <h1
            className="text-[20px] font-semibold leading-none tracking-[-0.01em] text-white/95"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            탈퇴 사용자
          </h1>
          <p className="mt-1.5 text-[12px] text-white/45 tracking-[-0.005em]">
            30일 grace period · 만료된 계정은 영구 삭제 대상
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchDeletedUsers()}
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

      {/* ─────────── Stats Grid — macOS Widget ─────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="전체 탈퇴" value={stats.total} icon={UserMinus} caption="Total in trash" />
        <StatCard
          label="오늘 탈퇴"
          value={stats.today}
          icon={Calendar}
          accent="coral"
          caption="Today"
        />
        <StatCard
          label="만료 임박"
          value={stats.imminent}
          icon={AlertTriangle}
          accent="warning"
          caption="3일 이내 남음"
        />
        <StatCard
          label="영구 삭제 대상"
          value={stats.expired}
          icon={Trash2}
          accent="coral"
          caption="Grace 만료"
        />
      </div>

      {/* ─────────── Filters ─────────── */}
      <GlassCard padded={true}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search — NSSearchField pattern (debounced) */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="이름 · @username · 이메일 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="탈퇴 사용자 검색"
              className="w-full pl-9 pr-9 h-8 rounded-[7px] bg-white/[0.04] ring-1 ring-white/[0.08] text-white text-[12px] placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/25 tracking-[-0.005em]"
              style={{ transition: `box-shadow 180ms ${MAC_EASE}` }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  searchInputRef.current?.focus();
                }}
                aria-label="검색어 지우기"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded-md text-white/45 hover:bg-white/[0.06] hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.95]"
                style={{ transition: `all 160ms ${MAC_EASE}` }}
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            )}
            {!searchInput && (
              <kbd
                className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-[4px] px-1 text-[9.5px] font-mono font-medium text-white/40 ring-1 ring-white/[0.08] bg-white/[0.025] pointer-events-none tracking-[-0.005em]"
                aria-hidden="true"
              >
                /
              </kbd>
            )}
          </div>

          {/* Plan Filter */}
          <div className="flex items-center gap-1.5">
            <PlanSegmented value={planFilter} onChange={setPlanFilter} />
          </div>
        </div>
      </GlassCard>

      {/* ─────────── List — macOS Finder sorted list ─────────── */}
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
        ) : filteredUsers.length === 0 ? (
          <div className="py-14 text-center">
            <HelpCircle
              className="mx-auto h-5 w-5 text-white/25 mb-2"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div className="text-[12px] text-white/40 tracking-[-0.005em]">
              {debouncedSearch || planFilter !== "all"
                ? "검색 결과가 없습니다"
                : "탈퇴한 사용자가 없습니다"}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full border-separate border-spacing-0"
              aria-rowcount={filteredUsers.length}
            >
              <caption className="sr-only">
                탈퇴 사용자 목록 — 총 {filteredUsers.length.toLocaleString("en-US")}건. 30일 grace
                period 동안 표시되며, 만료된 계정은 영구 삭제 대상입니다.
              </caption>
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
                    className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 border-b border-white/[0.08] text-left"
                  >
                    사용자
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 border-b border-white/[0.08] text-left w-[88px]"
                  >
                    플랜
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 border-b border-white/[0.08] text-left"
                  >
                    이메일
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 border-b border-white/[0.08] text-center w-[60px]"
                  >
                    국가
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 border-b border-white/[0.08] text-right w-[80px]"
                  >
                    토큰
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 border-b border-white/[0.08] text-left w-[88px]"
                  >
                    탈퇴일
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 border-b border-white/[0.08] text-left w-[200px]"
                  >
                    Grace Period
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleSlice.map(({ user, grace }) => {
                  const isExpired = grace.status === "expired";
                  return (
                    <tr
                      key={user.id}
                      className={`group hover:bg-white/[0.025] ${isExpired ? "opacity-60" : ""}`}
                      style={{ transition: `background-color 160ms ${MAC_EASE}` }}
                      aria-label={`${user.display_name || user.username} 탈퇴 사용자`}
                    >
                      {/* User */}
                      <td className="px-4 py-2.5 border-b border-white/[0.04]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {user.avatar_url ? (
                            <Image
                              src={user.avatar_url}
                              alt=""
                              width={28}
                              height={28}
                              className="h-7 w-7 rounded-full ring-1 ring-white/[0.08] shrink-0 grayscale opacity-75"
                            />
                          ) : (
                            <div
                              className="h-7 w-7 rounded-full bg-white/[0.06] ring-1 ring-white/[0.08] flex items-center justify-center text-[11px] text-white/40 font-medium uppercase shrink-0"
                              aria-hidden="true"
                            >
                              {user.username?.charAt(0) || "?"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div
                              className="text-[12.5px] font-medium text-white/85 tracking-[-0.005em] truncate"
                              title={user.display_name || user.username}
                            >
                              {user.display_name || user.username}
                            </div>
                            <div className="text-[10.5px] text-white/40 tracking-[-0.005em] truncate">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-3 py-2.5 border-b border-white/[0.04]">
                        <PlanBadge plan={user.ccplan} />
                      </td>

                      {/* Email */}
                      <td className="px-3 py-2.5 border-b border-white/[0.04]">
                        {user.email ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Mail
                              className="h-3 w-3 text-white/30 shrink-0"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            <span
                              className="text-[11.5px] text-white/55 font-mono tracking-[-0.005em] truncate"
                              style={{ fontFeatureSettings: '"ss01"' }}
                              title={user.email}
                            >
                              {user.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11.5px] text-white/25 tracking-[-0.005em]">—</span>
                        )}
                      </td>

                      {/* Country */}
                      <td className="px-3 py-2.5 text-center border-b border-white/[0.04]">
                        {user.country_code ? (
                          <span
                            title={user.country_code}
                            aria-label={`국가 ${user.country_code}`}
                            className="inline-flex"
                          >
                            <FlagIcon countryCode={user.country_code} size="xs" />
                          </span>
                        ) : (
                          <span aria-hidden="true" className="inline-flex">
                            <Globe2 className="h-3.5 w-3.5 text-white/25" strokeWidth={1.75} />
                          </span>
                        )}
                      </td>

                      {/* Tokens */}
                      <td
                        className="px-3 py-2.5 text-right text-[12px] text-white/65 font-mono tabular-nums tracking-[-0.005em] border-b border-white/[0.04]"
                        style={{ fontFeatureSettings: '"tnum", "ss01"' }}
                        title={`${user.total_tokens.toLocaleString("en-US")} tokens`}
                      >
                        {formatNumber(user.total_tokens)}
                      </td>

                      {/* Deleted at */}
                      <td className="px-3 py-2.5 border-b border-white/[0.04]">
                        <div className="flex flex-col">
                          <span
                            className="text-[11.5px] text-white/65 font-mono tabular-nums tracking-[-0.005em]"
                            style={{ fontFeatureSettings: '"tnum", "ss01"' }}
                            title={formatDateTime(user.deleted_at)}
                          >
                            {formatDateShort(user.deleted_at)}
                          </span>
                          <span
                            className="text-[10px] text-white/35 tabular-nums tracking-[-0.005em]"
                            style={{ fontFeatureSettings: '"tnum"' }}
                          >
                            {formatRelative(user.deleted_at)}
                          </span>
                        </div>
                      </td>

                      {/* Grace Period — 시각적 progress bar */}
                      <td className="px-3 py-2.5 border-b border-white/[0.04]">
                        <GracePeriodBar grace={grace} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────── Footer meta — count + load more (Cupid H7) ─────────── */}
      {!loading && filteredUsers.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <div
            className="text-[11px] text-white/45 tabular-nums tracking-[-0.005em]"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            <span className="text-white/75 font-medium">
              {visibleSlice.length.toLocaleString("en-US")}
            </span>
            <span className="mx-1 text-white/25">/</span>
            <span>{filteredUsers.length.toLocaleString("en-US")}</span>
            <span className="ml-1.5 text-white/30">표시됨</span>
            {(debouncedSearch || planFilter !== "all") &&
              filteredUsers.length !== enrichedUsers.length && (
                <span className="ml-2 text-white/35">
                  · 필터 ({enrichedUsers.length.toLocaleString("en-US")}건 중)
                </span>
              )}
          </div>

          {remainingCount > 0 && (
            <button
              type="button"
              onClick={() =>
                setVisibleRows((v) => Math.min(filteredUsers.length, v + LOAD_MORE_STEP))
              }
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

      {/* ─────────── Empty / 0 user — Trash empty state ─────────── */}
      {!loading && enrichedUsers.length === 0 && (
        <div
          className="rounded-[9px] px-4 py-8 ring-1 ring-white/[0.06] text-center"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <Trash2
            className="mx-auto h-6 w-6 text-white/25 mb-2"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <div className="text-[12.5px] font-medium text-white/65 tracking-[-0.005em] mb-0.5">
            휴지통이 비어 있습니다
          </div>
          <p className="text-[11px] text-white/40 tracking-[-0.005em]">
            탈퇴한 사용자가 표시되는 영역입니다.
          </p>
        </div>
      )}
    </div>
  );
}
