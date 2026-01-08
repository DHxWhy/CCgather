"use client";

import { useState, useEffect } from "react";

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
  ccplan?: string | null;
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
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeToday: 0,
    totalTokens: 0,
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">사용자 관리</h2>
        <p className="text-white/60">등록된 사용자 목록 및 통계를 확인합니다.</p>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <div className="text-yellow-400 font-medium">{alert.message}</div>
                  <div className="text-sm text-white/60">
                    {alert.type === "unknown_ccplan" && (
                      <>
                        User ID: {(alert.metadata as { user_id?: string }).user_id} • CCplan:{" "}
                        <code className="px-1 py-0.5 bg-white/10 rounded">
                          {(alert.metadata as { ccplan?: string }).ccplan}
                        </code>
                      </>
                    )}
                    <span className="ml-2">
                      {new Date(alert.created_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 rounded-lg text-white/60 transition-colors"
              >
                확인
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <div className="text-3xl font-bold text-white mb-1">{formatNumber(stats.totalUsers)}</div>
          <div className="text-sm text-white/60">전체 사용자</div>
        </div>
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <div className="text-3xl font-bold text-green-400 mb-1">
            {formatNumber(stats.activeToday)}
          </div>
          <div className="text-sm text-white/60">오늘 활성 사용자</div>
        </div>
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <div className="text-3xl font-bold text-[var(--color-claude-coral)] mb-1">
            {formatNumber(stats.totalTokens)}
          </div>
          <div className="text-sm text-white/60">총 토큰 사용량</div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="사용자 검색 (이름, 이메일, 사용자명)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
        />
        <button
          onClick={fetchUsers}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
        >
          🔄 새로고침
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-4 text-left text-sm font-medium text-white/60">사용자</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-white/60">이메일</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-white/60">국가</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-white/60">토큰</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-white/60">순위</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-white/60">가입일</th>
                <th className="px-6 py-4 text-center text-sm font-medium text-white/60">상태</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-white/40">
                    로딩 중...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-white/40">
                    {searchQuery ? "검색 결과가 없습니다." : "사용자가 없습니다."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/10" />
                        )}
                        <div>
                          <div className="text-white font-medium">
                            {user.display_name || user.username}
                          </div>
                          <div className="text-sm text-white/40">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/60">{user.email || "-"}</td>
                    <td className="px-6 py-4 text-white/60">{user.country_code || "-"}</td>
                    <td className="px-6 py-4 text-right text-white">
                      {formatNumber(user.total_tokens)}
                    </td>
                    <td className="px-6 py-4 text-right text-white">
                      {user.global_rank ? `#${user.global_rank}` : "-"}
                    </td>
                    <td className="px-6 py-4 text-white/60">
                      {new Date(user.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {user.onboarding_completed ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                          활성
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
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
