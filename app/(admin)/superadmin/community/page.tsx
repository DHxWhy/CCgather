"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Search,
  Eye,
  EyeOff,
  RefreshCw,
  MessageSquare,
  Heart,
  Trash2,
  FileText,
  Filter,
} from "lucide-react";

// =====================================================
// Types
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

// =====================================================
// Admin Community Page (Timeline View)
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

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/community?view=overview");
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  // Fetch timeline data
  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        view: "timeline",
        type: typeFilter,
        includeDeleted: includeDeleted.toString(),
        search,
        limit: "100",
      });

      const response = await fetch(`/api/admin/community?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTimeline(data.timeline || []);
      }
    } catch (error) {
      console.error("Error fetching timeline:", error);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, includeDeleted, search]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  // Hide/Restore action
  const handleAction = async (type: "post" | "comment", id: string, action: "hide" | "restore") => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/community/${type}s/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        fetchTimeline();
        fetchStats();
      }
    } catch (error) {
      console.error("Action failed:", error);
    } finally {
      setActionLoading(null);
    }
  };

  // Format date
  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return "방금 전";
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  // Truncate content
  const truncate = (text: string, length: number) => {
    if (text.length <= length) return text;
    return text.slice(0, length) + "...";
  };

  // Get type badge config
  const getTypeBadge = (item: TimelineItem) => {
    if (item.type === "post") {
      return {
        icon: <FileText size={10} />,
        label: "게시물",
        bg: "bg-blue-500/20",
        text: "text-blue-400",
      };
    }
    if (item.type === "comment") {
      return {
        icon: <MessageSquare size={10} />,
        label: item.extra.parent_comment_id ? "대댓글" : "댓글",
        bg: "bg-emerald-500/20",
        text: "text-emerald-400",
      };
    }
    return {
      icon: <Trash2 size={10} />,
      label: `${item.extra.content_type === "post" ? "게시물" : "댓글"} 삭제`,
      bg: "bg-rose-500/20",
      text: "text-rose-400",
    };
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Community 관리</h1>
          <p className="text-[12px] text-white/50 mt-0.5">
            전체 활동 타임라인 · 게시물, 댓글, 삭제 기록 통합 관리
          </p>
        </div>
        <button
          onClick={() => {
            fetchStats();
            fetchTimeline();
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-white/70 hover:text-white bg-[#161616] border border-white/[0.06] hover:border-white/10 rounded-lg transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="전체 Posts" value={stats.totalPosts} icon="📝" />
          <StatCard label="전체 Comments" value={stats.totalComments} icon="💬" />
          <StatCard label="오늘 Posts" value={stats.todayPosts} icon="✨" highlight />
          <StatCard label="삭제 대기 (Posts)" value={stats.deletedPosts} icon="🗑️" muted />
          <StatCard label="삭제 대기 (Comments)" value={stats.deletedComments} icon="🗑️" muted />
        </div>
      )}

      {/* Filters */}
      <div className="bg-[#161616] rounded-lg p-3 border border-white/[0.06]">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="내용 또는 닉네임 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/[0.06] rounded-lg text-white text-[12px] placeholder:text-white/40 focus:outline-none focus:border-white/20"
            />
          </form>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={12} className="text-white/40" />
            <div className="flex gap-1 p-0.5 bg-white/5 rounded-lg">
              {(["all", "post", "comment", "deletion"] as TypeFilter[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                    typeFilter === t
                      ? "bg-[var(--color-claude-coral)] text-white"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {t === "all" && "전체"}
                  {t === "post" && "게시물"}
                  {t === "comment" && "댓글"}
                  {t === "deletion" && "삭제기록"}
                </button>
              ))}
            </div>
          </div>

          {/* Include Deleted Toggle */}
          <label className="flex items-center gap-2 text-[11px] text-white/60 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="rounded border-white/20 bg-white/5 text-[var(--color-claude-coral)] focus:ring-0 focus:ring-offset-0"
            />
            숨김 포함
          </label>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-[#161616] rounded-lg border border-white/[0.06] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : timeline.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-white/30 text-[13px]">
              {search ? "검색 결과가 없습니다" : "활동 기록이 없습니다"}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {timeline.map((item) => {
              const badge = getTypeBadge(item);
              const isDeleted = item.deleted_at !== null;

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors ${
                    isDeleted ? "opacity-50" : ""
                  }`}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {item.author?.avatar_url ? (
                      <Image
                        src={item.author.avatar_url}
                        alt=""
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[11px] text-white/40">
                        {item.author?.username?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-medium text-white/80">
                        {item.author?.display_name || item.author?.username || "알 수 없음"}
                      </span>
                      <span className="text-[10px] text-white/40">
                        @{item.author?.username || "unknown"}
                      </span>
                      <span
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${badge.bg} ${badge.text}`}
                      >
                        {badge.icon}
                        {badge.label}
                      </span>
                      {item.type === "deletion" && item.extra.deleted_by_role && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] ${
                            item.extra.deleted_by_role === "admin"
                              ? "bg-rose-500/20 text-rose-400"
                              : "bg-white/10 text-white/50"
                          }`}
                        >
                          {item.extra.deleted_by_role === "admin" ? "Admin" : "본인"}
                        </span>
                      )}
                      {item.extra.tab && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-white/50">
                          #{item.extra.tab}
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <p className="text-[12px] text-white/60 mb-1.5 leading-relaxed">
                      {truncate(item.content, 150)}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center gap-3 text-[10px] text-white/40">
                      <span>{formatDate(item.created_at)}</span>

                      {item.type !== "deletion" && (
                        <>
                          {item.extra.likes_count !== undefined && (
                            <span className="flex items-center gap-1">
                              <Heart size={10} /> {item.extra.likes_count}
                            </span>
                          )}
                          {item.extra.comments_count !== undefined && (
                            <span className="flex items-center gap-1">
                              <MessageSquare size={10} /> {item.extra.comments_count}
                            </span>
                          )}
                        </>
                      )}

                      {item.type === "deletion" && (
                        <>
                          {(item.extra.cascade_deleted_comments || 0) > 0 && (
                            <span className="text-amber-400">
                              +{item.extra.cascade_deleted_comments} 댓글 연쇄삭제
                            </span>
                          )}
                          {(item.extra.cascade_deleted_replies || 0) > 0 && (
                            <span className="text-amber-400">
                              +{item.extra.cascade_deleted_replies} 대댓글 연쇄삭제
                            </span>
                          )}
                          {item.extra.reason && (
                            <span className="text-white/30">사유: {item.extra.reason}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions (only for posts/comments, not deletions) */}
                  {item.type !== "deletion" && (
                    <div className="flex-shrink-0">
                      <button
                        onClick={() =>
                          handleAction(
                            item.type as "post" | "comment",
                            item.id,
                            isDeleted ? "restore" : "hide"
                          )
                        }
                        disabled={actionLoading === item.id}
                        className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
                          isDeleted
                            ? "text-emerald-400 hover:bg-emerald-500/10"
                            : "text-rose-400 hover:bg-rose-500/10"
                        }`}
                      >
                        {actionLoading === item.id ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : isDeleted ? (
                          <>
                            <Eye size={12} /> 복구
                          </>
                        ) : (
                          <>
                            <EyeOff size={12} /> 숨김
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Results count */}
      {!loading && timeline.length > 0 && (
        <div className="text-[11px] text-white/40 text-center">
          {timeline.length}개의 항목 표시됨
        </div>
      )}
    </div>
  );
}

// =====================================================
// Sub Components
// =====================================================

function StatCard({
  label,
  value,
  icon,
  highlight,
  muted,
}: {
  label: string;
  value: number;
  icon: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        highlight
          ? "bg-[var(--color-claude-coral)]/10 border-[var(--color-claude-coral)]/20"
          : "bg-[#161616] border-white/[0.06]"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{icon}</span>
        <span className={`text-[10px] ${muted ? "text-white/30" : "text-white/50"}`}>{label}</span>
      </div>
      <p className={`text-xl font-semibold ${muted ? "text-white/30" : "text-white"}`}>{value}</p>
    </div>
  );
}
