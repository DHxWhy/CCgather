"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Search, Eye, EyeOff, RefreshCw, MessageSquare, Heart, Trash2 } from "lucide-react";

// =====================================================
// Types
// =====================================================

interface Author {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Post {
  id: string;
  content: string;
  tab: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  deleted_at: string | null;
  author: Author;
}

interface Comment {
  id: string;
  content: string;
  post_id: string;
  parent_comment_id: string | null;
  likes_count: number;
  created_at: string;
  deleted_at: string | null;
  author: Author;
}

interface DeletionLog {
  id: string;
  content_type: "post" | "comment";
  content_id: string;
  content_snapshot: {
    content: string;
    tab?: string;
    likes_count: number;
    comments_count?: number;
    replies_count?: number;
  };
  deleted_by: string;
  deleted_by_role: "owner" | "admin";
  cascade_deleted_comments?: number;
  cascade_deleted_replies?: number;
  reason?: string;
  created_at: string;
  deleted_by_user?: {
    username: string;
    display_name: string | null;
  };
}

interface Stats {
  totalPosts: number;
  totalComments: number;
  todayPosts: number;
  deletedPosts: number;
  deletedComments: number;
}

type TabView = "overview" | "posts" | "comments" | "deletions";

// =====================================================
// Admin Community Page
// =====================================================

export default function AdminCommunityPage() {
  const [tab, setTab] = useState<TabView>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentDeletions, setRecentDeletions] = useState<DeletionLog[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [deletions, setDeletions] = useState<DeletionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch data based on current tab
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        view: tab,
        includeDeleted: includeDeleted.toString(),
        search,
      });

      const response = await fetch(`/api/admin/community?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();

      if (tab === "overview") {
        setStats(data.stats);
        setRecentDeletions(data.recentDeletions || []);
      } else if (tab === "posts") {
        setPosts(data.posts || []);
      } else if (tab === "comments") {
        setComments(data.comments || []);
      } else if (tab === "deletions") {
        setDeletions(data.deletions || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [tab, includeDeleted, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        // Refresh data
        fetchData();
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
    return d.toLocaleDateString("ko-KR");
  };

  // Truncate content
  const truncate = (text: string, length: number) => {
    if (text.length <= length) return text;
    return text.slice(0, length) + "...";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Community 관리</h1>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-lg w-fit">
        {(["overview", "posts", "comments", "deletions"] as TabView[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              tab === t
                ? "bg-[var(--color-claude-coral)] text-white"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            {t === "overview" && "Overview"}
            {t === "posts" && "Posts"}
            {t === "comments" && "Comments"}
            {t === "deletions" && "삭제 기록"}
          </button>
        ))}
      </div>

      {/* Search & Filters (for posts/comments) */}
      {(tab === "posts" || tab === "comments") && (
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-claude-coral)]/50"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="rounded border-white/20"
            />
            삭제된 항목 포함
          </label>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {tab === "overview" && stats && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard label="전체 Posts" value={stats.totalPosts} icon="📝" />
                <StatCard label="전체 Comments" value={stats.totalComments} icon="💬" />
                <StatCard label="오늘 Posts" value={stats.todayPosts} icon="✨" highlight />
                <StatCard label="삭제 대기 (Posts)" value={stats.deletedPosts} icon="🗑️" muted />
                <StatCard
                  label="삭제 대기 (Comments)"
                  value={stats.deletedComments}
                  icon="🗑️"
                  muted
                />
              </div>

              {/* Recent Deletions */}
              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <Trash2 size={14} />
                  최근 삭제 기록
                </h3>
                {recentDeletions.length === 0 ? (
                  <p className="text-sm text-white/40 py-4 text-center">삭제 기록이 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {recentDeletions.slice(0, 5).map((log) => (
                      <DeletionLogRow
                        key={log.id}
                        log={log}
                        formatDate={formatDate}
                        truncate={truncate}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Posts Tab */}
          {tab === "posts" && (
            <div className="bg-white/5 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs text-white/50 font-medium px-4 py-3">
                      작성자
                    </th>
                    <th className="text-left text-xs text-white/50 font-medium px-4 py-3">내용</th>
                    <th className="text-left text-xs text-white/50 font-medium px-4 py-3">탭</th>
                    <th className="text-left text-xs text-white/50 font-medium px-4 py-3">반응</th>
                    <th className="text-left text-xs text-white/50 font-medium px-4 py-3">
                      작성일
                    </th>
                    <th className="text-left text-xs text-white/50 font-medium px-4 py-3">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-white/40 py-8">
                        게시물이 없습니다
                      </td>
                    </tr>
                  ) : (
                    posts.map((post) => (
                      <tr
                        key={post.id}
                        className={`border-b border-white/5 hover:bg-white/5 ${
                          post.deleted_at ? "opacity-50" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {post.author.avatar_url ? (
                              <Image
                                src={post.author.avatar_url}
                                alt=""
                                width={24}
                                height={24}
                                className="w-6 h-6 rounded-full"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-white/10" />
                            )}
                            <span className="text-sm text-white/80">{post.author.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-white/70">
                            {truncate(post.content, 50)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/60">
                            {post.tab}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 text-xs text-white/50">
                            <span className="flex items-center gap-1">
                              <Heart size={12} /> {post.likes_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare size={12} /> {post.comments_count}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/50">
                          {formatDate(post.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              handleAction("post", post.id, post.deleted_at ? "restore" : "hide")
                            }
                            disabled={actionLoading === post.id}
                            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                              post.deleted_at
                                ? "text-emerald-400 hover:bg-emerald-500/10"
                                : "text-rose-400 hover:bg-rose-500/10"
                            }`}
                          >
                            {actionLoading === post.id ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : post.deleted_at ? (
                              <>
                                <Eye size={12} /> 복구
                              </>
                            ) : (
                              <>
                                <EyeOff size={12} /> 숨김
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Comments Tab */}
          {tab === "comments" && (
            <div className="bg-white/5 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs text-white/50 font-medium px-4 py-3">
                      작성자
                    </th>
                    <th className="text-left text-xs text-white/50 font-medium px-4 py-3">내용</th>
                    <th className="text-left text-xs text-white/50 font-medium px-4 py-3">유형</th>
                    <th className="text-left text-xs text-white/50 font-medium px-4 py-3">
                      좋아요
                    </th>
                    <th className="text-left text-xs text-white/50 font-medium px-4 py-3">
                      작성일
                    </th>
                    <th className="text-left text-xs text-white/50 font-medium px-4 py-3">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {comments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-white/40 py-8">
                        댓글이 없습니다
                      </td>
                    </tr>
                  ) : (
                    comments.map((comment) => (
                      <tr
                        key={comment.id}
                        className={`border-b border-white/5 hover:bg-white/5 ${
                          comment.deleted_at ? "opacity-50" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {comment.author.avatar_url ? (
                              <Image
                                src={comment.author.avatar_url}
                                alt=""
                                width={24}
                                height={24}
                                className="w-6 h-6 rounded-full"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-white/10" />
                            )}
                            <span className="text-sm text-white/80">{comment.author.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-white/70">
                            {truncate(comment.content, 60)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-white/50">
                            {comment.parent_comment_id ? "대댓글" : "댓글"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs text-white/50">
                            <Heart size={12} /> {comment.likes_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/50">
                          {formatDate(comment.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              handleAction(
                                "comment",
                                comment.id,
                                comment.deleted_at ? "restore" : "hide"
                              )
                            }
                            disabled={actionLoading === comment.id}
                            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                              comment.deleted_at
                                ? "text-emerald-400 hover:bg-emerald-500/10"
                                : "text-rose-400 hover:bg-rose-500/10"
                            }`}
                          >
                            {actionLoading === comment.id ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : comment.deleted_at ? (
                              <>
                                <Eye size={12} /> 복구
                              </>
                            ) : (
                              <>
                                <EyeOff size={12} /> 숨김
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Deletions Tab */}
          {tab === "deletions" && (
            <div className="bg-white/5 rounded-xl p-4">
              {deletions.length === 0 ? (
                <p className="text-sm text-white/40 py-8 text-center">삭제 기록이 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {deletions.map((log) => (
                    <DeletionLogRow
                      key={log.id}
                      log={log}
                      formatDate={formatDate}
                      truncate={truncate}
                      expanded
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
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
      className={`p-4 rounded-xl ${
        highlight
          ? "bg-[var(--color-claude-coral)]/10 border border-[var(--color-claude-coral)]/20"
          : "bg-white/5"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className={`text-xs ${muted ? "text-white/40" : "text-white/60"}`}>{label}</span>
      </div>
      <p className={`text-2xl font-semibold ${muted ? "text-white/40" : "text-white"}`}>{value}</p>
    </div>
  );
}

function DeletionLogRow({
  log,
  formatDate,
  truncate,
  expanded,
}: {
  log: DeletionLog;
  formatDate: (d: string) => string;
  truncate: (t: string, l: number) => string;
  expanded?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/[0.07] transition-colors">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
          log.content_type === "post"
            ? "bg-rose-500/20 text-rose-400"
            : "bg-amber-500/20 text-amber-400"
        }`}
      >
        {log.content_type === "post" ? "📝" : "💬"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-white/50">
            {log.content_type === "post" ? "게시물" : "댓글"} 삭제
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              log.deleted_by_role === "admin"
                ? "bg-rose-500/20 text-rose-400"
                : "bg-emerald-500/20 text-emerald-400"
            }`}
          >
            {log.deleted_by_role === "admin" ? "Admin" : "본인"}
          </span>
          {log.deleted_by_user && (
            <span className="text-xs text-white/40">by @{log.deleted_by_user.username}</span>
          )}
        </div>
        <p className="text-sm text-white/70 mb-1">
          {truncate(log.content_snapshot.content, expanded ? 200 : 80)}
        </p>
        <div className="flex items-center gap-3 text-[10px] text-white/40">
          <span>{formatDate(log.created_at)}</span>
          {(log.cascade_deleted_comments || 0) > 0 && (
            <span className="text-amber-400">+{log.cascade_deleted_comments} 댓글 연쇄삭제</span>
          )}
          {(log.cascade_deleted_replies || 0) > 0 && (
            <span className="text-amber-400">+{log.cascade_deleted_replies} 대댓글 연쇄삭제</span>
          )}
          {log.reason && <span className="text-white/30">사유: {log.reason}</span>}
        </div>
      </div>
    </div>
  );
}
