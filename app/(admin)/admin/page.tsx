"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("");
  const [filterCountries, setFilterCountries] = useState<string[]>([]);
  const [filterOnboarding, setFilterOnboarding] = useState<string>("");
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeToday: 0,
    totalTokens: 0,
    planStats: { free: 0, pro: 0, max: 0, business: 0, null: 0, unknown: 0 } as PlanStats,
  });

  useEffect(() => {
    fetchUsers();
    fetchAlerts();
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
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
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

  // Helper to categorize ccplan
  const getPlanCategory = (ccplan: string | null): string => {
    if (!ccplan) return "null";
    const plan = ccplan.toLowerCase();
    if (["free", "pro", "max"].includes(plan)) return plan;
    if (["team", "enterprise"].includes(plan)) return "business";
    return "unknown";
  };

  // Country statistics
  const countryStats = users.reduce(
    (acc, user) => {
      const code = user.country_code || "unknown";
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Sorted country list (by count descending)
  const sortedCountries = Object.entries(countryStats)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count }));

  const filteredUsers = users.filter((user) => {
    // Search filter
    const matchesSearch =
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(searchQuery.toLowerCase());

    // Plan filter
    const matchesPlan = !filterPlan || getPlanCategory(user.ccplan) === filterPlan;

    // Country filter (multi-select)
    const matchesCountry =
      filterCountries.length === 0 ||
      filterCountries.some((code) =>
        code === "unknown" ? !user.country_code : user.country_code === code
      );

    // Onboarding filter
    const matchesOnboarding =
      !filterOnboarding ||
      (filterOnboarding === "completed" ? user.onboarding_completed : !user.onboarding_completed);

    return matchesSearch && matchesPlan && matchesCountry && matchesOnboarding;
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  // CCplan badge renderer
  const renderPlanBadge = (ccplan: string | null) => {
    if (!ccplan) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-400">
          ⚠️ 미설정
        </span>
      );
    }

    const plan = ccplan.toLowerCase();
    const badgeStyles: Record<string, string> = {
      free: "bg-white/10 text-white/60",
      pro: "bg-blue-500/20 text-blue-400",
      max: "bg-purple-500/20 text-purple-400",
      team: "bg-emerald-500/20 text-emerald-400",
      enterprise: "bg-amber-500/20 text-amber-400",
    };

    if (badgeStyles[plan]) {
      const label = plan === "team" || plan === "enterprise" ? `🏢 ${plan}` : plan;
      return (
        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${badgeStyles[plan]}`}>
          {label}
        </span>
      );
    }

    // Unknown plan
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400">
        ❓ {ccplan}
      </span>
    );
  };

  return (
    <div className="space-y-4 max-w-6xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">사용자 관리</h1>
          <p className="text-[12px] text-white/50 mt-0.5">등록된 사용자 목록 및 통계</p>
        </div>
        <button
          onClick={fetchUsers}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-[12px] text-white/70 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          새로고침
        </button>
      </div>

      {/* 알림 */}
      {alerts.length > 0 && (
        <div className="space-y-1.5">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
            >
              <div className="flex items-center gap-2.5 text-[12px]">
                <span>⚠️</span>
                <span className="text-yellow-400">{alert.message}</span>
                {alert.type === "unknown_ccplan" && (
                  <code className="px-1.5 py-0.5 bg-white/5 rounded text-[11px] text-white/50">
                    {(alert.metadata as { ccplan?: string }).ccplan}
                  </code>
                )}
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="px-2 py-1 text-[11px] bg-white/5 hover:bg-white/10 rounded text-white/50 transition-colors"
              >
                확인
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 기본 통계 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
          <div className="text-xl font-semibold text-white">{formatNumber(stats.totalUsers)}</div>
          <div className="text-[11px] text-white/50 mt-0.5">전체 사용자</div>
        </div>
        <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
          <div className="text-xl font-semibold text-emerald-400">
            {formatNumber(stats.activeToday)}
          </div>
          <div className="text-[11px] text-white/50 mt-0.5">오늘 활성</div>
        </div>
        <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
          <div className="text-xl font-semibold text-[var(--color-claude-coral)]">
            {formatNumber(stats.totalTokens)}
          </div>
          <div className="text-[11px] text-white/50 mt-0.5">총 토큰</div>
        </div>
      </div>

      {/* 플랜별 통계 */}
      <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
        <div className="text-[11px] text-white/40 uppercase tracking-wide mb-3">플랜 분포</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterPlan("")}
            className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
              filterPlan === ""
                ? "bg-white/20 text-white"
                : "bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            전체 {stats.totalUsers}
          </button>
          <button
            onClick={() => setFilterPlan("max")}
            className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
              filterPlan === "max"
                ? "bg-purple-500/30 text-purple-300"
                : "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
            }`}
          >
            Max {stats.planStats.max}
          </button>
          <button
            onClick={() => setFilterPlan("pro")}
            className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
              filterPlan === "pro"
                ? "bg-blue-500/30 text-blue-300"
                : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
            }`}
          >
            Pro {stats.planStats.pro}
          </button>
          <button
            onClick={() => setFilterPlan("free")}
            className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
              filterPlan === "free"
                ? "bg-white/20 text-white"
                : "bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            Free {stats.planStats.free}
          </button>
          <button
            onClick={() => setFilterPlan("business")}
            className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
              filterPlan === "business"
                ? "bg-emerald-500/30 text-emerald-300"
                : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            }`}
          >
            🏢 Business(추정) {stats.planStats.business}
          </button>
          {stats.planStats.null > 0 && (
            <button
              onClick={() => setFilterPlan("null")}
              className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                filterPlan === "null"
                  ? "bg-yellow-500/30 text-yellow-300"
                  : "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
              }`}
            >
              ⚠️ 미설정 {stats.planStats.null}
            </button>
          )}
          {stats.planStats.unknown > 0 && (
            <button
              onClick={() => setFilterPlan("unknown")}
              className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                filterPlan === "unknown"
                  ? "bg-red-500/30 text-red-300"
                  : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
              }`}
            >
              ❓ 기타 {stats.planStats.unknown}
            </button>
          )}
        </div>
      </div>

      {/* 국가 & 온보딩 필터 */}
      <div className="flex gap-3">
        {/* 국가 필터 (중복 선택 가능) */}
        <div className="flex-1 bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] text-white/40 uppercase tracking-wide">국가별 필터</div>
            {filterCountries.length > 0 && (
              <button
                onClick={() => setFilterCountries([])}
                className="text-[10px] text-white/40 hover:text-white/60 transition-colors"
              >
                초기화 ({filterCountries.length}개 선택)
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sortedCountries.slice(0, 12).map(({ code, count }) => {
              const isSelected = filterCountries.includes(code);
              return (
                <button
                  key={code}
                  onClick={() => {
                    if (isSelected) {
                      setFilterCountries(filterCountries.filter((c) => c !== code));
                    } else {
                      setFilterCountries([...filterCountries, code]);
                    }
                  }}
                  className={`px-2 py-1 rounded text-[11px] transition-colors ${
                    isSelected
                      ? "bg-blue-500/30 text-blue-300 ring-1 ring-blue-500/50"
                      : "bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >
                  {code === "unknown" ? "🌐 미설정" : code} {count}
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
                className="px-2 py-1 rounded text-[11px] bg-white/5 text-white/50 border-none focus:outline-none cursor-pointer"
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

        {/* 온보딩 상태 필터 */}
        <div className="bg-[#161616] rounded-lg p-4 border border-white/[0.06]">
          <div className="text-[11px] text-white/40 uppercase tracking-wide mb-3">온보딩 상태</div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilterOnboarding("")}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                filterOnboarding === ""
                  ? "bg-white/20 text-white"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilterOnboarding("completed")}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                filterOnboarding === "completed"
                  ? "bg-emerald-500/30 text-emerald-300"
                  : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              }`}
            >
              완료 {users.filter((u) => u.onboarding_completed).length}
            </button>
            <button
              onClick={() => setFilterOnboarding("pending")}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                filterOnboarding === "pending"
                  ? "bg-yellow-500/30 text-yellow-300"
                  : "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
              }`}
            >
              대기 {users.filter((u) => !u.onboarding_completed).length}
            </button>
          </div>
        </div>
      </div>

      {/* 검색 */}
      <input
        type="text"
        placeholder="사용자 검색..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-3 py-2 bg-[#161616] border border-white/[0.06] rounded-lg text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
      />

      {/* 테이블 */}
      <div className="bg-[#161616] rounded-lg border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                  사용자
                </th>
                <th className="px-4 py-2.5 text-center text-[11px] font-medium text-white/40 uppercase">
                  플랜
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                  이메일
                </th>
                <th className="px-4 py-2.5 text-center text-[11px] font-medium text-white/40 uppercase">
                  국가
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-white/40 uppercase">
                  토큰
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-white/40 uppercase">
                  순위
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                  가입일
                </th>
                <th className="px-4 py-2.5 text-center text-[11px] font-medium text-white/40 uppercase">
                  상태
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[12px] text-white/30">
                    로딩 중...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[12px] text-white/30">
                    {searchQuery || filterPlan || filterCountries.length > 0 || filterOnboarding
                      ? "검색 결과가 없습니다."
                      : "사용자가 없습니다."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {user.avatar_url ? (
                          <Image
                            src={user.avatar_url}
                            alt=""
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-white/10" />
                        )}
                        <div>
                          <div className="text-[13px] text-white">
                            {user.display_name || user.username}
                          </div>
                          <div className="text-[11px] text-white/40">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">{renderPlanBadge(user.ccplan)}</td>
                    <td className="px-4 py-2.5 text-[12px] text-white/50">{user.email || "-"}</td>
                    <td className="px-4 py-2.5 text-center text-[12px] text-white/50">
                      {user.country_code || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[12px] text-white/70 font-mono">
                      {formatNumber(user.total_tokens)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[12px] text-white/70">
                      {user.global_rank ? `#${user.global_rank}` : "-"}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-white/50">
                      {new Date(user.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {user.onboarding_completed ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400">
                          활성
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-400">
                          대기
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
