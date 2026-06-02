"use client";

import { useState, useEffect, useDeferredValue, useMemo, useRef } from "react";
import Image from "next/image";
import {
  Search,
  RefreshCw,
  AlertTriangle,
  Building2,
  HelpCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
  Command as CommandIcon,
  Users as UsersIcon,
  Activity,
  Coins,
  EyeOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FlagIcon } from "@/components/ui/FlagIcon";

// ─────────────────────────────────────────────────────────────
// Types (API contract — 변경 X)
// ─────────────────────────────────────────────────────────────
interface User {
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
  onboarding_completed: boolean;
  ccplan: string | null;
  ccplan_updated_at: string | null;
  device_count: number;
  shadow_banned: boolean;
  deleted_at: string | null;
}

interface PlanStats {
  free: number;
  pro: number;
  max: number;
  business: number;
  null: number;
  unknown: number;
}

interface AdminAlert {
  id: string;
  type: string;
  message: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

type SortKey = "created_at" | "total_tokens" | "global_rank";
type SortDir = "asc" | "desc";

// ─────────────────────────────────────────────────────────────
// macOS Big Sur+ Easing — AdminLayoutClient 와 동일
// ─────────────────────────────────────────────────────────────
const MAC_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// ─────────────────────────────────────────────────────────────
// Local Chip component — pill·segmented·neutral 세 variant
// macOS NSSegmentedControl + Tag 통합
// ─────────────────────────────────────────────────────────────
type ChipVariant = "neutral" | "active" | "warning" | "danger";

interface ChipProps {
  children: React.ReactNode;
  variant?: ChipVariant;
  count?: number | null;
  icon?: LucideIcon;
  active?: boolean;
  onClick?: () => void;
  ariaPressed?: boolean;
  ariaLabel?: string;
  size?: "sm" | "md";
}

function Chip({
  children,
  variant = "neutral",
  count,
  icon: Icon,
  active = false,
  onClick,
  ariaPressed,
  ariaLabel,
  size = "md",
}: ChipProps) {
  const interactive = !!onClick;
  const sizeCls = size === "sm" ? "h-6 px-2 text-[11px] gap-1" : "h-7 px-2.5 text-[11.5px] gap-1.5";

  // active 상태: coral accent — macOS 시스템 액센트 단일화
  const activeCls = active
    ? "bg-[var(--color-claude-coral)]/15 text-[var(--color-claude-coral)] ring-1 ring-[var(--color-claude-coral)]/30"
    : "bg-white/[0.04] text-white/65 ring-1 ring-white/[0.06] hover:bg-white/[0.07] hover:text-white/90 hover:ring-white/[0.1]";

  // variant: semantic dot (활성 아닌 경우만 작은 dot 으로 시멘틱 표시)
  const dotColor =
    variant === "warning"
      ? "bg-amber-400/80"
      : variant === "danger"
        ? "bg-rose-400/80"
        : variant === "active"
          ? "bg-[var(--color-claude-coral)]"
          : null;

  const baseCls = `inline-flex items-center rounded-[7px] font-medium tracking-[-0.005em] ${sizeCls} ${activeCls}`;
  const transitionStyle = {
    transition: `background-color 180ms ${MAC_EASE}, color 180ms ${MAC_EASE}, box-shadow 180ms ${MAC_EASE}, transform 180ms ${MAC_EASE}`,
  };

  const content = (
    <>
      {dotColor && !active && (
        <span aria-hidden="true" className={`inline-block h-1 w-1 rounded-full ${dotColor}`} />
      )}
      {Icon && <Icon className="h-3 w-3 shrink-0" strokeWidth={1.75} />}
      <span>{children}</span>
      {typeof count === "number" && (
        <span
          className={`tabular-nums font-medium ${
            active ? "text-[var(--color-claude-coral)]/80" : "text-white/45"
          }`}
        >
          {count}
        </span>
      )}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={ariaPressed}
        aria-label={ariaLabel}
        className={`${baseCls} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98]`}
        style={transitionStyle}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={baseCls} aria-label={ariaLabel}>
      {content}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// StatCard — macOS Widget 스타일 (큰 숫자 + 작은 라벨 + accent)
// ─────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: "neutral" | "success" | "coral";
  formatter?: (n: number) => string;
}

function StatCard({ label, value, icon: Icon, accent = "neutral", formatter }: StatCardProps) {
  const accentColor =
    accent === "coral"
      ? "text-[var(--color-claude-coral)]"
      : accent === "success"
        ? "text-emerald-300"
        : "text-white";

  const iconBg =
    accent === "coral"
      ? "bg-[var(--color-claude-coral)]/12 text-[var(--color-claude-coral)] ring-[var(--color-claude-coral)]/20"
      : accent === "success"
        ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
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
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div
            className={`text-[28px] font-semibold leading-none tabular-nums tracking-[-0.02em] ${accentColor}`}
            style={{ fontFeatureSettings: '"ss01", "tnum", "cv11"' }}
          >
            {formatter ? formatter(value) : value.toLocaleString("en-US")}
          </div>
          <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-white/45">
            {label}
          </div>
        </div>
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ring-1 ${iconBg}`}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Plan badge — Lucide + 무채색 + 작은 시멘틱 dot
// ─────────────────────────────────────────────────────────────
function PlanBadge({ ccplan }: { ccplan: string | null }) {
  if (!ccplan) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-amber-400/25 bg-amber-400/10 text-amber-200"
        aria-label="플랜 미설정"
      >
        <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2} />
        미설정
      </span>
    );
  }

  const plan = ccplan.toLowerCase();
  const isBusiness = plan === "team" || plan === "enterprise";
  const known = ["free", "pro", "max", "team", "enterprise"].includes(plan);

  if (!known) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-rose-400/25 bg-rose-400/10 text-rose-200"
        aria-label={`알 수 없는 플랜: ${ccplan}`}
      >
        <HelpCircle className="h-2.5 w-2.5" strokeWidth={2} />
        {ccplan}
      </span>
    );
  }

  // macOS-style monochrome chip + 작은 시멘틱 dot
  const dotMap: Record<string, string> = {
    free: "bg-white/40",
    pro: "bg-sky-300",
    max: "bg-violet-300",
    team: "bg-emerald-300",
    enterprise: "bg-amber-300",
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-white/[0.08] bg-white/[0.05] text-white/85"
      aria-label={`플랜: ${plan}`}
    >
      <span aria-hidden="true" className={`h-1 w-1 rounded-full ${dotMap[plan]}`} />
      {isBusiness && <Building2 className="h-2.5 w-2.5" strokeWidth={2} />}
      <span>{plan}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Status chip (활성/대기)
// ─────────────────────────────────────────────────────────────
function StatusChip({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium ring-1 ${
        active
          ? "ring-emerald-400/25 bg-emerald-400/10 text-emerald-300"
          : "ring-amber-400/25 bg-amber-400/10 text-amber-200"
      }`}
      aria-label={active ? "활성 사용자" : "온보딩 대기"}
    >
      <span
        aria-hidden="true"
        className={`h-1 w-1 rounded-full ${active ? "bg-emerald-300" : "bg-amber-300"}`}
      />
      {active ? "활성" : "대기"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Sort chevron — macOS Finder column header
// ─────────────────────────────────────────────────────────────
function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <ChevronsUpDown className="h-3 w-3 text-white/30 transition-colors" strokeWidth={1.75} />
    );
  }
  return dir === "asc" ? (
    <ChevronUp className="h-3 w-3 text-[var(--color-claude-coral)]" strokeWidth={2} />
  ) : (
    <ChevronDown className="h-3 w-3 text-[var(--color-claude-coral)]" strokeWidth={2} />
  );
}

// ─────────────────────────────────────────────────────────────
// formatNumber
// ─────────────────────────────────────────────────────────────
function formatNumber(num: number) {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + "B";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

// ─────────────────────────────────────────────────────────────
// Helper: categorize ccplan (기존 로직 그대로)
// ─────────────────────────────────────────────────────────────
function getPlanCategory(ccplan: string | null): string {
  if (!ccplan) return "null";
  const plan = ccplan.toLowerCase();
  if (["free", "pro", "max"].includes(plan)) return plan;
  if (["team", "enterprise"].includes(plan)) return "business";
  return "unknown";
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("");
  const [filterCountries, setFilterCountries] = useState<string[]>([]);
  const [filterOnboarding, setFilterOnboarding] = useState<string>("");
  const [filterSubmission, setFilterSubmission] = useState<string>("");
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeToday: 0,
    totalTokens: 0,
    planStats: {
      free: 0,
      pro: 0,
      max: 0,
      business: 0,
      null: 0,
      unknown: 0,
    } as PlanStats,
  });

  // useDeferredValue — UI 레벨 debounce (state/effect 변경 X)
  const deferredQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    fetchUsers();
    fetchAlerts();
  }, []);

  // Cmd+K / Ctrl+K — focus search input (macOS Quick Look 패턴)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;
      if (cmdKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function fetchAlerts() {
    try {
      const response = await fetch("/api/admin/alerts");
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    }
  }

  async function dismissAlert(alertId: string) {
    try {
      await fetch(`/api/admin/alerts/${alertId}`, { method: "DELETE" });
      setAlerts(alerts.filter((a) => a.id !== alertId));
    } catch (error) {
      console.error("Failed to dismiss alert:", error);
    }
  }

  async function fetchUsers() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setLastFetchedAt(new Date());
        setStats({
          totalUsers: data.stats?.totalUsers || 0,
          activeToday: data.stats?.activeToday || 0,
          totalTokens: data.stats?.totalTokens || 0,
          planStats: data.stats?.planStats || {
            free: 0,
            pro: 0,
            max: 0,
            business: 0,
            null: 0,
            unknown: 0,
          },
        });
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  }

  // Shadow ban 토글 — 낙관적 업데이트 + 실패 시 롤백
  async function toggleShadowBan(userId: string, username: string, next: boolean) {
    const msg = next
      ? `@${username} 을(를) 쉐도우 밴 처리할까요?\n\n리더보드·통계에서 숨겨지지만 본인 화면엔 정상으로 보입니다. (데이터는 보존)`
      : `@${username} 의 쉐도우 밴을 해제할까요?\n\n리더보드에 다시 노출됩니다.`;
    if (!window.confirm(msg)) return;

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, shadow_banned: next } : u)));

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, shadowBanned: next }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch (error) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, shadow_banned: !next } : u)));
      console.error("Shadow ban toggle failed:", error);
      window.alert("쉐도우 밴 처리에 실패했습니다. 다시 시도해주세요.");
    }
  }

  // Country statistics — 기존 로직 그대로
  const countryStats = useMemo(
    () =>
      users.reduce(
        (acc, user) => {
          const code = user.country_code || "unknown";
          acc[code] = (acc[code] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    [users]
  );

  const sortedCountries = useMemo(
    () =>
      Object.entries(countryStats)
        .sort((a, b) => {
          if (a[0] === "unknown") return 1;
          if (b[0] === "unknown") return -1;
          return b[1] - a[1];
        })
        .map(([code, count]) => ({ code, count })),
    [countryStats]
  );

  // 필터 — deferred 검색어 사용 (UI debounce)
  const filteredUsers = useMemo(() => {
    const q = deferredQuery.toLowerCase();
    const filtered = users.filter((user) => {
      const matchesSearch =
        !q ||
        user.username.toLowerCase().includes(q) ||
        user.email?.toLowerCase().includes(q) ||
        user.display_name?.toLowerCase().includes(q);

      const matchesPlan = !filterPlan || getPlanCategory(user.ccplan) === filterPlan;

      const matchesCountry =
        filterCountries.length === 0 ||
        filterCountries.some((code) =>
          code === "unknown" ? !user.country_code : user.country_code === code
        );

      const matchesOnboarding =
        !filterOnboarding ||
        (filterOnboarding === "completed" ? user.onboarding_completed : !user.onboarding_completed);

      const matchesSubmission =
        !filterSubmission ||
        (filterSubmission === "has" ? user.total_tokens > 0 : user.total_tokens === 0);

      return (
        matchesSearch && matchesPlan && matchesCountry && matchesOnboarding && matchesSubmission
      );
    });

    // Sort (UI 레벨, 데이터 흐름 변경 X)
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "created_at") {
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      }
      if (sortKey === "total_tokens") {
        return (a.total_tokens - b.total_tokens) * dir;
      }
      // global_rank — null 은 항상 뒤로
      const ra = a.global_rank ?? Number.POSITIVE_INFINITY;
      const rb = b.global_rank ?? Number.POSITIVE_INFINITY;
      return (ra - rb) * dir;
    });
  }, [
    users,
    deferredQuery,
    filterPlan,
    filterCountries,
    filterOnboarding,
    filterSubmission,
    sortKey,
    sortDir,
  ]);

  const isFiltered =
    !!searchQuery ||
    !!filterPlan ||
    filterCountries.length > 0 ||
    !!filterOnboarding ||
    !!filterSubmission;

  const completedCount = useMemo(() => users.filter((u) => u.onboarding_completed).length, [users]);
  const pendingCount = useMemo(() => users.filter((u) => !u.onboarding_completed).length, [users]);
  const hasSubmissionCount = useMemo(() => users.filter((u) => u.total_tokens > 0).length, [users]);
  const noSubmissionCount = useMemo(
    () => users.filter((u) => u.total_tokens === 0).length,
    [users]
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function resetAllFilters() {
    setSearchQuery("");
    setFilterPlan("");
    setFilterCountries([]);
    setFilterOnboarding("");
    setFilterSubmission("");
  }

  return (
    <div
      className="space-y-5 max-w-6xl"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
        fontFeatureSettings: '"ss01", "cv11", "cv03"',
      }}
    >
      {/* 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <h1
            className="text-[20px] font-semibold leading-none tracking-[-0.01em] text-white/95"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            사용자 관리
          </h1>
          <p className="mt-1.5 text-[12px] text-white/45 tracking-[-0.005em]">
            등록된 사용자 목록 및 통계
            {lastFetchedAt && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-white/20">
                  ·
                </span>
                <span className="tabular-nums" title={lastFetchedAt.toLocaleString("ko-KR")}>
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
        <button
          type="button"
          onClick={fetchUsers}
          disabled={loading}
          aria-label="사용자 목록 새로고침"
          className="inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[12px] font-medium text-white/75 bg-white/[0.04] ring-1 ring-white/[0.08] hover:bg-[var(--color-claude-coral)]/10 hover:text-[var(--color-claude-coral)] hover:ring-[var(--color-claude-coral)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-claude-coral)]/40 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            transition: `all 180ms ${MAC_EASE}`,
          }}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            strokeWidth={1.75}
          />
          새로고침
        </button>
      </div>

      {/* 알림 */}
      {alerts.length > 0 && (
        <div className="space-y-1.5">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              role="alert"
              className="flex items-center justify-between rounded-[9px] p-3 ring-1 ring-amber-400/20 bg-amber-400/[0.06]"
              style={{
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
              }}
            >
              <div className="flex items-center gap-2.5 text-[12px]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-300" strokeWidth={2} />
                <span className="text-amber-200 tracking-[-0.005em]">{alert.message}</span>
                {alert.type === "unknown_ccplan" && (
                  <code className="rounded px-1.5 py-0.5 text-[11px] font-mono text-white/60 bg-white/[0.06] ring-1 ring-white/[0.08]">
                    {(alert.metadata as { ccplan?: string }).ccplan}
                  </code>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissAlert(alert.id)}
                aria-label="알림 닫기"
                className="inline-flex h-6 items-center gap-1 rounded-[5px] px-2 text-[11px] text-white/55 bg-white/[0.04] ring-1 ring-white/[0.06] hover:bg-white/[0.08] hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                style={{
                  transition: `all 180ms ${MAC_EASE}`,
                }}
              >
                확인
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 기본 통계 카드 — macOS Widget 스타일 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="전체 사용자"
          value={stats.totalUsers}
          icon={UsersIcon}
          accent="neutral"
          formatter={formatNumber}
        />
        <StatCard
          label="오늘 활성"
          value={stats.activeToday}
          icon={Activity}
          accent="success"
          formatter={formatNumber}
        />
        <StatCard
          label="총 토큰"
          value={stats.totalTokens}
          icon={Coins}
          accent="coral"
          formatter={formatNumber}
        />
      </div>

      {/* 검색 + 활성 필터 요약 — macOS NSSearchField 스타일 toolbar */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <label htmlFor="user-search" className="sr-only">
            사용자 검색 (이름, 이메일, 아이디)
          </label>
          <input
            ref={searchInputRef}
            id="user-search"
            type="search"
            placeholder="사용자 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="사용자 검색"
            aria-keyshortcuts="Control+K Meta+K"
            className="h-9 w-full rounded-full pl-9 pr-20 text-[13px] text-white placeholder:text-white/35 ring-1 ring-white/[0.08] bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]/40 focus:bg-white/[0.06]"
            style={{
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              fontFeatureSettings: '"ss01", "cv11"',
              transition: `all 180ms ${MAC_EASE}`,
            }}
          />
          <kbd
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium text-white/45 ring-1 ring-white/[0.08] bg-white/[0.03]"
            aria-hidden="true"
          >
            <CommandIcon className="h-2.5 w-2.5" strokeWidth={2} />K
          </kbd>
        </div>

        {/* 활성 필터 요약 chip 행 */}
        {isFiltered && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-white/45 tracking-[-0.005em]">활성 필터:</span>
            {filterPlan && (
              <Chip
                size="sm"
                active
                onClick={() => setFilterPlan("")}
                ariaLabel={`플랜 필터 해제: ${filterPlan}`}
                icon={X}
              >
                플랜: {filterPlan}
              </Chip>
            )}
            {filterCountries.map((code) => (
              <Chip
                key={code}
                size="sm"
                active
                onClick={() => setFilterCountries(filterCountries.filter((c) => c !== code))}
                ariaLabel={`국가 필터 해제: ${code}`}
                icon={X}
              >
                {code === "unknown" ? "미설정" : code}
              </Chip>
            ))}
            {filterOnboarding && (
              <Chip
                size="sm"
                active
                onClick={() => setFilterOnboarding("")}
                ariaLabel="온보딩 필터 해제"
                icon={X}
              >
                {filterOnboarding === "completed" ? "활성" : "대기"}
              </Chip>
            )}
            {filterSubmission && (
              <Chip
                size="sm"
                active
                onClick={() => setFilterSubmission("")}
                ariaLabel="제출 필터 해제"
                icon={X}
              >
                {filterSubmission === "has" ? "제출있음" : "미제출"}
              </Chip>
            )}
            {searchQuery && (
              <Chip
                size="sm"
                active
                onClick={() => setSearchQuery("")}
                ariaLabel="검색어 지우기"
                icon={X}
              >
                &quot;{searchQuery}&quot;
              </Chip>
            )}
            <button
              type="button"
              onClick={resetAllFilters}
              className="ml-1 text-[11px] text-white/40 hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 rounded px-1 py-0.5"
              style={{ transition: `color 180ms ${MAC_EASE}` }}
            >
              전체 초기화
            </button>
          </div>
        )}
      </div>

      {/* 필터 패널 — macOS Inspector 스타일 (Plan + Country + Onboarding + Submission 통합) */}
      <div
        className="rounded-[9px] ring-1 ring-white/[0.08] divide-y divide-white/[0.05]"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.18)",
        }}
      >
        {/* 플랜 행 — segmented control 스타일 */}
        <div className="flex items-start gap-4 px-4 py-3">
          <div className="w-20 shrink-0 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
            플랜
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="플랜 필터">
            <Chip
              size="sm"
              active={filterPlan === ""}
              onClick={() => setFilterPlan("")}
              count={stats.totalUsers}
              ariaPressed={filterPlan === ""}
            >
              전체
            </Chip>
            <Chip
              size="sm"
              active={filterPlan === "max"}
              onClick={() => setFilterPlan("max")}
              count={stats.planStats.max}
              ariaPressed={filterPlan === "max"}
            >
              Max
            </Chip>
            <Chip
              size="sm"
              active={filterPlan === "pro"}
              onClick={() => setFilterPlan("pro")}
              count={stats.planStats.pro}
              ariaPressed={filterPlan === "pro"}
            >
              Pro
            </Chip>
            <Chip
              size="sm"
              active={filterPlan === "free"}
              onClick={() => setFilterPlan("free")}
              count={stats.planStats.free}
              ariaPressed={filterPlan === "free"}
            >
              Free
            </Chip>
            <Chip
              size="sm"
              active={filterPlan === "business"}
              onClick={() => setFilterPlan("business")}
              count={stats.planStats.business}
              ariaPressed={filterPlan === "business"}
              icon={Building2}
            >
              Business
            </Chip>
            {stats.planStats.null > 0 && (
              <Chip
                size="sm"
                active={filterPlan === "null"}
                onClick={() => setFilterPlan("null")}
                count={stats.planStats.null}
                ariaPressed={filterPlan === "null"}
                variant="warning"
                icon={AlertTriangle}
              >
                미설정
              </Chip>
            )}
            {stats.planStats.unknown > 0 && (
              <Chip
                size="sm"
                active={filterPlan === "unknown"}
                onClick={() => setFilterPlan("unknown")}
                count={stats.planStats.unknown}
                ariaPressed={filterPlan === "unknown"}
                variant="danger"
                icon={HelpCircle}
              >
                기타
              </Chip>
            )}
          </div>
        </div>

        {/* 국가 행 */}
        <div className="flex items-start gap-4 px-4 py-3">
          <div className="w-20 shrink-0 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
            국가
          </div>
          <div
            className="flex flex-1 flex-wrap items-center gap-1.5"
            role="group"
            aria-label="국가 필터"
          >
            {sortedCountries.slice(0, 12).map(({ code, count }) => {
              const isSelected = filterCountries.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setFilterCountries(filterCountries.filter((c) => c !== code));
                    } else {
                      setFilterCountries([...filterCountries, code]);
                    }
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${code === "unknown" ? "국가 미설정" : code} 필터 ${isSelected ? "해제" : "적용"}, ${count}명`}
                  className={`inline-flex h-6 items-center gap-1 rounded-[6px] px-1.5 text-[11px] font-medium tracking-[-0.005em] ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98] ${
                    isSelected
                      ? "bg-[var(--color-claude-coral)]/15 text-[var(--color-claude-coral)] ring-[var(--color-claude-coral)]/30"
                      : "bg-white/[0.04] text-white/65 ring-white/[0.06] hover:bg-white/[0.07] hover:text-white/90 hover:ring-white/[0.1]"
                  }`}
                  style={{
                    transition: `all 180ms ${MAC_EASE}`,
                  }}
                >
                  <FlagIcon countryCode={code === "unknown" ? "" : code} size="xs" />
                  <span>{code === "unknown" ? "미설정" : code}</span>
                  <span
                    className={`tabular-nums ${isSelected ? "text-[var(--color-claude-coral)]/80" : "text-white/45"}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            {sortedCountries.length > 12 && (
              <select
                value=""
                onChange={(e) => {
                  const code = e.target.value;
                  if (code && !filterCountries.includes(code)) {
                    setFilterCountries([...filterCountries, code]);
                  }
                }}
                aria-label="국가 추가 선택"
                className="h-6 rounded-[6px] px-1.5 text-[11px] bg-white/[0.04] text-white/65 ring-1 ring-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/25 cursor-pointer"
                style={{
                  transition: `all 180ms ${MAC_EASE}`,
                }}
              >
                <option value="">+{sortedCountries.length - 12}개 더</option>
                {sortedCountries.slice(12).map(({ code, count }) => (
                  <option key={code} value={code} disabled={filterCountries.includes(code)}>
                    {code} ({count}) {filterCountries.includes(code) ? "✓" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 상태 행 — 온보딩 + 제출 */}
        <div className="flex items-start gap-4 px-4 py-3">
          <div className="w-20 shrink-0 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
            상태
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5" role="group" aria-label="온보딩 필터">
              <span className="text-[10.5px] uppercase tracking-wide text-white/35">온보딩</span>
              <Chip
                size="sm"
                active={filterOnboarding === ""}
                onClick={() => setFilterOnboarding("")}
                ariaPressed={filterOnboarding === ""}
              >
                전체
              </Chip>
              <Chip
                size="sm"
                active={filterOnboarding === "completed"}
                onClick={() => setFilterOnboarding("completed")}
                count={completedCount}
                ariaPressed={filterOnboarding === "completed"}
              >
                완료
              </Chip>
              <Chip
                size="sm"
                active={filterOnboarding === "pending"}
                onClick={() => setFilterOnboarding("pending")}
                count={pendingCount}
                ariaPressed={filterOnboarding === "pending"}
              >
                대기
              </Chip>
            </div>
            <div aria-hidden="true" className="hidden h-4 w-px bg-white/[0.08] md:block" />
            <div className="flex items-center gap-1.5" role="group" aria-label="제출 이력 필터">
              <span className="text-[10.5px] uppercase tracking-wide text-white/35">제출</span>
              <Chip
                size="sm"
                active={filterSubmission === ""}
                onClick={() => setFilterSubmission("")}
                ariaPressed={filterSubmission === ""}
              >
                전체
              </Chip>
              <Chip
                size="sm"
                active={filterSubmission === "has"}
                onClick={() => setFilterSubmission("has")}
                count={hasSubmissionCount}
                ariaPressed={filterSubmission === "has"}
              >
                제출있음
              </Chip>
              <Chip
                size="sm"
                active={filterSubmission === "none"}
                onClick={() => setFilterSubmission("none")}
                count={noSubmissionCount}
                ariaPressed={filterSubmission === "none"}
              >
                미제출
              </Chip>
            </div>
          </div>
        </div>
      </div>

      {/* 결과 요약 */}
      <div className="flex items-center justify-between px-1">
        <div className="text-[11.5px] tabular-nums tracking-[-0.005em] text-white/45">
          <span className="font-semibold text-white/75">
            {filteredUsers.length.toLocaleString("en-US")}
          </span>
          <span> / </span>
          <span>{users.length.toLocaleString("en-US")} 명</span>
          {deferredQuery !== searchQuery && (
            <span className="ml-2 text-[var(--color-claude-coral)]/75">검색 중...</span>
          )}
        </div>
      </div>

      {/* 테이블 — macOS Finder list view */}
      <div
        className="overflow-hidden rounded-[9px] ring-1 ring-white/[0.08]"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.18)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr
                className="sticky top-0 border-b border-white/[0.08] backdrop-blur-md"
                style={{ background: "rgba(28,28,30,0.55)" }}
              >
                <th
                  scope="col"
                  className="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                >
                  사용자
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                >
                  플랜
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                >
                  이메일
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                >
                  국가
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                  aria-sort={
                    sortKey === "total_tokens"
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("total_tokens")}
                    aria-label={`토큰으로 정렬 ${sortKey === "total_tokens" && sortDir === "desc" ? "오름차순" : "내림차순"}`}
                    className="ml-auto inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                    style={{ transition: `color 180ms ${MAC_EASE}` }}
                  >
                    토큰
                    <SortIndicator active={sortKey === "total_tokens"} dir={sortDir} />
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                  aria-sort={
                    sortKey === "global_rank"
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("global_rank")}
                    aria-label={`순위로 정렬 ${sortKey === "global_rank" && sortDir === "desc" ? "오름차순" : "내림차순"}`}
                    className="ml-auto inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                    style={{ transition: `color 180ms ${MAC_EASE}` }}
                  >
                    순위
                    <SortIndicator active={sortKey === "global_rank"} dir={sortDir} />
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                  aria-sort={
                    sortKey === "created_at"
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("created_at")}
                    aria-label={`가입일로 정렬 ${sortKey === "created_at" && sortDir === "desc" ? "오름차순" : "내림차순"}`}
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                    style={{ transition: `color 180ms ${MAC_EASE}` }}
                  >
                    가입일
                    <SortIndicator active={sortKey === "created_at"} dir={sortDir} />
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45"
                >
                  상태
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[12px] text-white/40">
                    <div className="inline-flex items-center gap-2">
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-[var(--color-claude-coral)]" />
                      로딩 중...
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[12px] text-white/40">
                    {isFiltered ? "검색 결과가 없습니다." : "사용자가 없습니다."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const displayName = user.display_name || user.username;
                  return (
                    <tr
                      key={user.id}
                      className="group border-b border-white/[0.04] last:border-b-0 hover:bg-[var(--color-claude-coral)]/[0.05]"
                      style={{
                        transition: `background-color 160ms ${MAC_EASE}`,
                      }}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {user.avatar_url ? (
                            <Image
                              src={user.avatar_url}
                              alt={`${user.username} 프로필 이미지`}
                              width={28}
                              height={28}
                              className="h-7 w-7 rounded-full ring-1 ring-white/10 shrink-0"
                            />
                          ) : (
                            <div
                              className="h-7 w-7 rounded-full bg-gradient-to-br from-white/15 to-white/5 ring-1 ring-white/10 shrink-0"
                              aria-label={`${user.username} 기본 프로필 이미지`}
                              role="img"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[13px] text-white/90 tracking-[-0.005em]">
                              <span className="truncate">{displayName}</span>
                              {user.device_count > 1 && (
                                <span
                                  className="inline-flex shrink-0 items-center rounded-[4px] px-1 py-0.5 text-[9px] font-semibold tabular-nums ring-1 ring-cyan-400/25 bg-cyan-400/10 text-cyan-200"
                                  aria-label={`${user.device_count}개 디바이스에서 접속`}
                                >
                                  {user.device_count}PC
                                </span>
                              )}
                              {user.shadow_banned && (
                                <span
                                  className="inline-flex shrink-0 items-center gap-0.5 rounded-[4px] px-1 py-0.5 text-[9px] font-semibold ring-1 ring-rose-500/30 bg-rose-500/15 text-rose-300"
                                  aria-label="쉐도우 밴 처리됨"
                                >
                                  <EyeOff className="h-2.5 w-2.5" strokeWidth={2} />
                                  SHADOW
                                </span>
                              )}
                              {user.deleted_at && (
                                <span
                                  className="inline-flex shrink-0 items-center rounded-[4px] px-1 py-0.5 text-[9px] font-semibold ring-1 ring-amber-500/30 bg-amber-500/15 text-amber-300"
                                  aria-label="탈퇴 (삭제 대기)"
                                  title={`탈퇴일: ${new Date(user.deleted_at).toLocaleString("ko-KR")}`}
                                >
                                  탈퇴
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-white/40 truncate">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <PlanBadge ccplan={user.ccplan} />
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-white/55 tracking-[-0.005em]">
                        <span className="truncate" title={user.email ?? ""}>
                          {user.email || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {user.country_code ? (
                          <span
                            className="inline-flex items-center justify-center"
                            aria-label={`국가: ${user.country_code}`}
                          >
                            <FlagIcon countryCode={user.country_code} size="xs" />
                          </span>
                        ) : (
                          <span className="text-[12px] text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[12.5px] tabular-nums font-medium text-white/80">
                        {formatNumber(user.total_tokens)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[12.5px] tabular-nums text-white/70">
                        {user.global_rank ? (
                          <span className="font-medium">
                            #{user.global_rank.toLocaleString("en-US")}
                          </span>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] tabular-nums text-white/55">
                        {new Date(user.created_at).toLocaleDateString("ko-KR", {
                          year: "2-digit",
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <StatusChip active={user.onboarding_completed} />
                          <button
                            type="button"
                            onClick={() =>
                              toggleShadowBan(user.id, user.username, !user.shadow_banned)
                            }
                            aria-label={
                              user.shadow_banned
                                ? `@${user.username} 쉐도우 밴 해제`
                                : `@${user.username} 쉐도우 밴 처리`
                            }
                            className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-[5px] px-1.5 text-[10px] font-medium ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-[0.98] ${
                              user.shadow_banned
                                ? "ring-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20"
                                : "ring-white/[0.08] bg-white/[0.04] text-white/50 opacity-0 group-hover:opacity-100 hover:bg-rose-400/10 hover:text-rose-300 hover:ring-rose-400/25"
                            }`}
                            style={{ transition: `all 180ms ${MAC_EASE}` }}
                          >
                            <EyeOff className="h-3 w-3" strokeWidth={1.75} />
                            {user.shadow_banned ? "해제" : "밴"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
