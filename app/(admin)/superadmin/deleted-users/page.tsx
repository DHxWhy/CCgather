"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { FlagIcon } from "@/components/ui/FlagIcon";

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

export default function DeletedUsersPage() {
  const [users, setUsers] = useState<DeletedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchDeletedUsers();
  }, []);

  async function fetchDeletedUsers() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/deleted-users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch deleted users:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      user.username.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.display_name?.toLowerCase().includes(q)
    );
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + "B";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const renderPlanBadge = (ccplan: string | null) => {
    if (!ccplan) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-white/40">-</span>;
    }
    const plan = ccplan.toLowerCase();
    const badgeStyles: Record<string, string> = {
      free: "bg-white/10 text-white/60",
      pro: "bg-blue-500/20 text-blue-400",
      max: "bg-purple-500/20 text-purple-400",
      team: "bg-emerald-500/20 text-emerald-400",
      enterprise: "bg-amber-500/20 text-amber-400",
    };
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${badgeStyles[plan] || "bg-white/10 text-white/40"}`}
      >
        {plan}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">탈퇴 사용자</h1>
          <p className="text-[12px] text-white/50 mt-0.5">
            탈퇴한 사용자 목록 (총 {users.length}명)
          </p>
        </div>
        <button
          onClick={fetchDeletedUsers}
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

      {/* Search */}
      <input
        type="text"
        placeholder="사용자 검색..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-3 py-2 bg-[#161616] border border-white/[0.06] rounded-lg text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
      />

      {/* Table */}
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
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                  가입일
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase">
                  탈퇴일
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
                    {searchQuery ? "검색 결과가 없습니다." : "탈퇴한 사용자가 없습니다."}
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
                            className="rounded-full opacity-50"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-white/5" />
                        )}
                        <div>
                          <div className="text-[13px] text-white/50">
                            {user.display_name || user.username}
                          </div>
                          <div className="text-[11px] text-white/30">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">{renderPlanBadge(user.ccplan)}</td>
                    <td className="px-4 py-2.5 text-[12px] text-white/40">{user.email || "-"}</td>
                    <td className="px-4 py-2.5 text-center">
                      {user.country_code ? (
                        <FlagIcon countryCode={user.country_code} size="xs" />
                      ) : (
                        <span className="text-[12px] text-white/30">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[12px] text-white/40 font-mono">
                      {formatNumber(user.total_tokens)}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-white/40">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-red-400/70">
                      {formatDateTime(user.deleted_at)}
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
