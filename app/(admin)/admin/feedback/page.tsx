"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Search,
  RefreshCw,
  Bug,
  Lightbulb,
  MessageSquare,
  Filter,
  Check,
  Clock,
  X,
  ChevronDown,
} from "lucide-react";

// =====================================================
// Types
// =====================================================

interface FeedbackUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Feedback {
  id: string;
  type: "bug" | "feature" | "general";
  content: string;
  page_url: string | null;
  user_agent: string | null;
  status: "new" | "in_progress" | "resolved" | "closed";
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

type StatusFilter = "all" | "new" | "in_progress" | "resolved" | "closed";
type TypeFilter = "all" | "bug" | "feature" | "general";

// =====================================================
// Admin Feedback Page
// =====================================================

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");

  // Fetch feedbacks
  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      const response = await fetch(`/api/feedback?${params}`);
      if (response.ok) {
        const data = await response.json();
        let filtered = data.feedbacks || [];

        // Client-side type filtering
        if (typeFilter !== "all") {
          filtered = filtered.filter((f: Feedback) => f.type === typeFilter);
        }

        setFeedbacks(filtered);

        // Calculate stats from all feedbacks
        if (statusFilter === "all" && typeFilter === "all") {
          const allFeedbacks = data.feedbacks || [];
          setStats({
            total: allFeedbacks.length,
            new: allFeedbacks.filter((f: Feedback) => f.status === "new").length,
            in_progress: allFeedbacks.filter((f: Feedback) => f.status === "in_progress").length,
            resolved: allFeedbacks.filter((f: Feedback) => f.status === "resolved").length,
            closed: allFeedbacks.filter((f: Feedback) => f.status === "closed").length,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching feedbacks:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Update feedback status
  const handleStatusUpdate = async (id: string, newStatus: string, note?: string) => {
    setActionLoading(id);
    try {
      const response = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus, admin_note: note }),
      });

      if (response.ok) {
        fetchFeedbacks();
        setExpandedId(null);
        setAdminNote("");
      }
    } catch (error) {
      console.error("Update failed:", error);
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

  // Get type config
  const getTypeConfig = (type: "bug" | "feature" | "general") => {
    switch (type) {
      case "bug":
        return {
          icon: <Bug size={12} />,
          label: "Bug",
          color: "text-red-400",
          bg: "bg-red-500/20",
        };
      case "feature":
        return {
          icon: <Lightbulb size={12} />,
          label: "Feature",
          color: "text-yellow-400",
          bg: "bg-yellow-500/20",
        };
      case "general":
        return {
          icon: <MessageSquare size={12} />,
          label: "General",
          color: "text-blue-400",
          bg: "bg-blue-500/20",
        };
    }
  };

  // Get status config
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "new":
        return { icon: <Clock size={10} />, label: "New", color: "text-white", bg: "bg-white/20" };
      case "in_progress":
        return {
          icon: <RefreshCw size={10} />,
          label: "진행중",
          color: "text-amber-400",
          bg: "bg-amber-500/20",
        };
      case "resolved":
        return {
          icon: <Check size={10} />,
          label: "해결",
          color: "text-emerald-400",
          bg: "bg-emerald-500/20",
        };
      case "closed":
        return { icon: <X size={10} />, label: "닫힘", color: "text-white/50", bg: "bg-white/10" };
      default:
        return { icon: null, label: status, color: "text-white/50", bg: "bg-white/10" };
    }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Feedback 관리</h1>
          <p className="text-[12px] text-white/50 mt-0.5">사용자 피드백 및 버그 제보 관리</p>
        </div>
        <button
          onClick={fetchFeedbacks}
          className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-white/70 hover:text-white bg-[#161616] border border-white/[0.06] hover:border-white/10 rounded-lg transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="전체" value={stats.total} icon="📋" />
          <StatCard label="New" value={stats.new} icon="✨" highlight />
          <StatCard label="진행중" value={stats.in_progress} icon="🔄" />
          <StatCard label="해결됨" value={stats.resolved} icon="✅" />
          <StatCard label="닫힘" value={stats.closed} icon="🗂️" muted />
        </div>
      )}

      {/* Filters */}
      <div className="bg-[#161616] rounded-lg p-3 border border-white/[0.06]">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={12} className="text-white/40" />
            <span className="text-[11px] text-white/40">상태:</span>
            <div className="flex gap-1 p-0.5 bg-white/5 rounded-lg">
              {(["all", "new", "in_progress", "resolved", "closed"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                    statusFilter === s
                      ? "bg-[var(--color-claude-coral)] text-white"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {s === "all" && "전체"}
                  {s === "new" && "New"}
                  {s === "in_progress" && "진행중"}
                  {s === "resolved" && "해결"}
                  {s === "closed" && "닫힘"}
                </button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-white/40">유형:</span>
            <div className="flex gap-1 p-0.5 bg-white/5 rounded-lg">
              {(["all", "bug", "feature", "general"] as TypeFilter[]).map((t) => (
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
                  {t === "bug" && "Bug"}
                  {t === "feature" && "Feature"}
                  {t === "general" && "General"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback List */}
      <div className="bg-[#161616] rounded-lg border border-white/[0.06] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-white/30 text-[13px]">피드백이 없습니다</div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {feedbacks.map((feedback) => {
              const typeConfig = getTypeConfig(feedback.type);
              const statusConfig = getStatusConfig(feedback.status);
              const isExpanded = expandedId === feedback.id;

              return (
                <div key={feedback.id} className="hover:bg-white/[0.02] transition-colors">
                  {/* Main Row */}
                  <div
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : feedback.id);
                      setAdminNote(feedback.admin_note || "");
                    }}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {feedback.user?.avatar_url ? (
                        <Image
                          src={feedback.user.avatar_url}
                          alt=""
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[11px] text-white/40">
                          {feedback.user?.username?.charAt(0).toUpperCase() || "?"}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px] font-medium text-white/80">
                          {feedback.user?.display_name || feedback.user?.username || "알 수 없음"}
                        </span>
                        <span className="text-[10px] text-white/40">
                          @{feedback.user?.username || "unknown"}
                        </span>
                        <span
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${typeConfig.bg} ${typeConfig.color}`}
                        >
                          {typeConfig.icon}
                          {typeConfig.label}
                        </span>
                        <span
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${statusConfig.bg} ${statusConfig.color}`}
                        >
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      </div>

                      {/* Body */}
                      <p className="text-[12px] text-white/60 mb-1.5 leading-relaxed line-clamp-2">
                        {feedback.content}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center gap-3 text-[10px] text-white/40">
                        <span>{formatDate(feedback.created_at)}</span>
                        {feedback.page_url && (
                          <span className="truncate max-w-[200px]">{feedback.page_url}</span>
                        )}
                      </div>
                    </div>

                    {/* Expand Icon */}
                    <div className="flex-shrink-0">
                      <ChevronDown
                        size={16}
                        className={`text-white/40 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>

                  {/* Expanded Panel */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-white/[0.04] bg-white/[0.02]">
                      <div className="pl-11 space-y-3">
                        {/* Full Content */}
                        <div>
                          <div className="text-[10px] text-white/40 mb-1">전체 내용</div>
                          <div className="text-[12px] text-white/70 p-2 bg-black/20 rounded-lg whitespace-pre-wrap">
                            {feedback.content}
                          </div>
                        </div>

                        {/* User Agent */}
                        {feedback.user_agent && (
                          <div>
                            <div className="text-[10px] text-white/40 mb-1">User Agent</div>
                            <div className="text-[10px] text-white/50 p-2 bg-black/20 rounded-lg break-all">
                              {feedback.user_agent}
                            </div>
                          </div>
                        )}

                        {/* Admin Note */}
                        <div>
                          <div className="text-[10px] text-white/40 mb-1">Admin Note</div>
                          <textarea
                            value={adminNote}
                            onChange={(e) => setAdminNote(e.target.value)}
                            placeholder="관리자 메모 입력..."
                            className="w-full p-2 bg-black/20 border border-white/[0.06] rounded-lg text-[12px] text-white/70 placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none"
                            rows={2}
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-white/40">상태 변경:</span>
                          {(["new", "in_progress", "resolved", "closed"] as const).map((s) => {
                            const config = getStatusConfig(s);
                            const isCurrentStatus = feedback.status === s;
                            return (
                              <button
                                key={s}
                                onClick={() => handleStatusUpdate(feedback.id, s, adminNote)}
                                disabled={actionLoading === feedback.id || isCurrentStatus}
                                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
                                  isCurrentStatus
                                    ? `${config.bg} ${config.color} cursor-default`
                                    : `border border-white/[0.06] text-white/50 hover:text-white hover:border-white/20`
                                }`}
                              >
                                {actionLoading === feedback.id ? (
                                  <RefreshCw size={10} className="animate-spin" />
                                ) : (
                                  config.icon
                                )}
                                {config.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Results count */}
      {!loading && feedbacks.length > 0 && (
        <div className="text-[11px] text-white/40 text-center">{feedbacks.length}개의 피드백</div>
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
