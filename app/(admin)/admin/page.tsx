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
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, activeToday: 0, totalTokens: 0 });

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
        });
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
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

      {/* 통계 카드 */}
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
                  <td colSpan={7} className="px-4 py-8 text-center text-[12px] text-white/30">
                    로딩 중...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[12px] text-white/30">
                    {searchQuery ? "검색 결과가 없습니다." : "사용자가 없습니다."}
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
