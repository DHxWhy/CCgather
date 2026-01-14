"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import ThumbnailManager from "@/components/admin/ThumbnailManager";
import TargetManager from "@/components/admin/TargetManager";
import CronScheduler from "@/components/admin/CronScheduler";
import UnusedThumbnailManager from "@/components/admin/UnusedThumbnailManager";
import { useToast } from "@/components/ui/ToastProvider";
import type { ThumbnailSource } from "@/types/automation";

type ContentType = "news" | "youtube";
type ContentStatus = "pending" | "ready" | "published" | "rejected";
type ContentTab = "news" | "youtube" | "targets" | "scheduler" | "storage";

// AI Article Types (from gemini-client.ts)
type AIArticleType =
  | "product_launch"
  | "version_update"
  | "tutorial"
  | "interview"
  | "analysis"
  | "security"
  | "event"
  | "research"
  | "integration"
  | "pricing"
  | "showcase"
  | "opinion"
  | "general";

interface ContentItem {
  id: string;
  type: ContentType;
  content_type?: "version_update" | "official" | "press" | "community" | "youtube";
  title: string;
  source_url: string;
  source_name: string;
  thumbnail_url?: string;
  thumbnail_source?: ThumbnailSource;
  summary_md?: string;
  key_points?: string[];
  category?: string;
  tags?: string[];
  news_tags?: string[]; // New tag-based filtering system
  status: ContentStatus;
  created_at: string;
  published_at?: string;
  video_id?: string;
  channel_name?: string;
  duration?: string;
  view_count?: number;
  // AI Classification fields
  ai_article_type?: AIArticleType;
  ai_article_type_secondary?: AIArticleType;
  ai_classification_confidence?: number;
  ai_classification_signals?: string[];
  ai_processed_at?: string;
}

const STATUS_STYLES: Record<ContentStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "대기" },
  ready: { bg: "bg-blue-500/20", text: "text-blue-400", label: "준비" },
  published: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "게시" },
  rejected: { bg: "bg-red-500/20", text: "text-red-400", label: "거부" },
};

const CATEGORY_OPTIONS = [
  { value: "tutorial", label: "튜토리얼" },
  { value: "update", label: "업데이트" },
  { value: "tip", label: "팁" },
  { value: "showcase", label: "쇼케이스" },
  { value: "news", label: "뉴스" },
  { value: "community", label: "커뮤니티" },
];

// AI Article Type Labels with colors
const AI_TYPE_STYLES: Record<
  AIArticleType,
  { label: string; emoji: string; bg: string; text: string }
> = {
  product_launch: { label: "출시", emoji: "🚀", bg: "bg-purple-500/20", text: "text-purple-400" },
  version_update: { label: "업데이트", emoji: "📦", bg: "bg-blue-500/20", text: "text-blue-400" },
  tutorial: { label: "튜토리얼", emoji: "📚", bg: "bg-green-500/20", text: "text-green-400" },
  interview: { label: "인터뷰", emoji: "🎤", bg: "bg-pink-500/20", text: "text-pink-400" },
  analysis: { label: "분석", emoji: "🔍", bg: "bg-cyan-500/20", text: "text-cyan-400" },
  security: { label: "보안", emoji: "🔒", bg: "bg-red-500/20", text: "text-red-400" },
  event: { label: "이벤트", emoji: "🎪", bg: "bg-orange-500/20", text: "text-orange-400" },
  research: { label: "연구", emoji: "🔬", bg: "bg-indigo-500/20", text: "text-indigo-400" },
  integration: { label: "연동", emoji: "🔗", bg: "bg-teal-500/20", text: "text-teal-400" },
  pricing: { label: "가격", emoji: "💰", bg: "bg-amber-500/20", text: "text-amber-400" },
  showcase: { label: "쇼케이스", emoji: "✨", bg: "bg-fuchsia-500/20", text: "text-fuchsia-400" },
  opinion: { label: "의견", emoji: "💬", bg: "bg-slate-500/20", text: "text-slate-400" },
  general: { label: "일반", emoji: "📰", bg: "bg-gray-500/20", text: "text-gray-400" },
};

// News Tags Styles
const NEWS_TAG_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  claude: { label: "Claude", bg: "bg-orange-500/20", text: "text-orange-400" },
  anthropic: { label: "Anthropic", bg: "bg-orange-500/20", text: "text-orange-300" },
  "claude-code": { label: "Claude Code", bg: "bg-orange-500/20", text: "text-orange-500" },
  update: { label: "업데이트", bg: "bg-blue-500/20", text: "text-blue-400" },
  industry: { label: "Industry", bg: "bg-purple-500/20", text: "text-purple-400" },
  "dev-tools": { label: "Dev Tools", bg: "bg-green-500/20", text: "text-green-400" },
  openai: { label: "OpenAI", bg: "bg-emerald-500/20", text: "text-emerald-400" },
  google: { label: "Google", bg: "bg-blue-500/20", text: "text-blue-300" },
  meta: { label: "Meta", bg: "bg-indigo-500/20", text: "text-indigo-400" },
  community: { label: "커뮤니티", bg: "bg-pink-500/20", text: "text-pink-400" },
  youtube: { label: "YouTube", bg: "bg-red-500/20", text: "text-red-400" },
};

// Available news tags for editing
const AVAILABLE_NEWS_TAGS = [
  "claude",
  "anthropic",
  "claude-code",
  "update",
  "industry",
  "dev-tools",
  "openai",
  "google",
  "meta",
  "community",
  "youtube",
];

export default function AdminContentsPage() {
  const [activeTab, setActiveTab] = useState<ContentTab>("news");
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ContentStatus>("all");
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { showToast } = useToast();

  const fetchContents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/contents");
      if (response.ok) {
        const data = await response.json();
        setContents(data.contents || []);
      }
    } catch (error) {
      console.error("Failed to fetch contents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "news" || activeTab === "youtube") {
      fetchContents();
    }
  }, [activeTab, fetchContents]);

  // Handler for when collection completes - shows toast notification
  const handleCollectionComplete = useCallback(
    (count: number, type: "news" | "youtube" = "news") => {
      if (count > 0) {
        showToast({
          type: "success",
          title: "수집 완료",
          message: `${count}개의 새로운 ${type === "news" ? "뉴스" : "영상"}가 수집되었습니다.`,
          icon: <span>{type === "news" ? "📰" : "🎬"}</span>,
          duration: 5000,
        });
        // Refresh the contents list
        fetchContents();
      }
    },
    [showToast, fetchContents]
  );

  async function updateContentStatus(id: string, status: ContentStatus) {
    try {
      await fetch(`/api/admin/contents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchContents();
    } catch (error) {
      console.error("Failed to update content:", error);
    }
  }

  async function updateContent(id: string, updates: Partial<ContentItem>) {
    try {
      await fetch(`/api/admin/contents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      setEditingItem(null);
      fetchContents();
    } catch (error) {
      console.error("Failed to update content:", error);
    }
  }

  async function deleteContent(id: string) {
    if (!confirm("이 콘텐츠를 삭제하시겠습니까?\n\n삭제된 콘텐츠는 복구할 수 없습니다.")) {
      return;
    }
    try {
      await fetch(`/api/admin/contents/${id}`, {
        method: "DELETE",
      });
      fetchContents();
    } catch (error) {
      console.error("Failed to delete content:", error);
    }
  }

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    if (activeTab === "news" || activeTab === "youtube") {
      fetchContents();
    }
  };

  const filteredContents = contents.filter((item) => {
    const tabType = activeTab === "news" ? "news" : "youtube";
    if (item.type !== tabType) return false;
    if (filter !== "all" && item.status !== filter) return false;
    return true;
  });

  const newsPendingCount = contents.filter(
    (c) => c.type === "news" && c.status === "pending"
  ).length;
  const youtubePendingCount = contents.filter(
    (c) => c.type === "youtube" && c.status === "pending"
  ).length;

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-white">콘텐츠 관리</h1>
        <p className="text-[12px] text-white/50 mt-0.5">뉴스 수집 설정 및 콘텐츠 관리</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        <TabButton
          active={activeTab === "news"}
          onClick={() => setActiveTab("news")}
          badge={newsPendingCount}
        >
          뉴스
        </TabButton>
        <TabButton
          active={activeTab === "youtube"}
          onClick={() => setActiveTab("youtube")}
          badge={youtubePendingCount}
          accentColor="red"
        >
          YouTube
        </TabButton>
        <div className="mx-2 self-center h-4 w-px bg-white/10" />
        <TabButton active={activeTab === "targets"} onClick={() => setActiveTab("targets")}>
          수집 대상
        </TabButton>
        <TabButton active={activeTab === "scheduler"} onClick={() => setActiveTab("scheduler")}>
          스케줄러
        </TabButton>
        <TabButton active={activeTab === "storage"} onClick={() => setActiveTab("storage")}>
          🗂️ 스토리지
        </TabButton>
      </div>

      {/* Tab Content */}
      <div key={refreshKey}>
        {/* News/YouTube Content List */}
        {(activeTab === "news" || activeTab === "youtube") && (
          <>
            {/* Status Filter */}
            <div className="flex gap-1.5">
              {(["all", "pending", "ready", "published", "rejected"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 py-1.5 rounded text-[11px] font-medium transition-colors ${
                    filter === s
                      ? "bg-white/15 text-white"
                      : "bg-white/5 text-white/40 hover:text-white/60"
                  }`}
                >
                  {s === "all" ? "전체" : STATUS_STYLES[s].label}
                </button>
              ))}
            </div>

            {/* Content List */}
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredContents.length === 0 ? (
                <div className="text-center py-8 text-[12px] text-white/30">
                  {activeTab === "news" ? "뉴스" : "YouTube 영상"}가 없습니다
                </div>
              ) : (
                filteredContents.map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    onEdit={() => setEditingItem(item)}
                    onStatusChange={updateContentStatus}
                    onDelete={() => deleteContent(item.id)}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* Target Manager */}
        {activeTab === "targets" && <TargetManager onRefresh={handleRefresh} />}

        {/* Cron Scheduler */}
        {activeTab === "scheduler" && (
          <CronScheduler onRefresh={handleRefresh} onCollectionComplete={handleCollectionComplete} />
        )}

        {/* Storage - Unused Thumbnails */}
        {activeTab === "storage" && <UnusedThumbnailManager />}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <EditContentModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(updates) => updateContent(editingItem.id, updates)}
        />
      )}
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  children,
  badge,
  accentColor = "coral",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
  accentColor?: "coral" | "red";
}) {
  const underlineColor = accentColor === "red" ? "bg-red-500" : "bg-[var(--color-claude-coral)]";

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-[12px] font-medium relative transition-colors ${
        active ? "text-white" : "text-white/40 hover:text-white/60"
      }`}
    >
      <span className="flex items-center gap-1.5">
        {children}
        {badge !== undefined && badge > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-yellow-500/20 text-yellow-400">
            {badge}
          </span>
        )}
      </span>
      {active && <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${underlineColor}`} />}
    </button>
  );
}

// Content Card
function ContentCard({
  item,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  item: ContentItem;
  onEdit: () => void;
  onStatusChange: (id: string, status: ContentStatus) => void;
  onDelete: () => void;
}) {
  // Check if original published_at is before created_at (collection date)
  const publishedDate = item.published_at ? new Date(item.published_at) : null;
  const createdDate = new Date(item.created_at);
  const isPastContent = publishedDate && publishedDate < createdDate;
  // Calculate days difference
  const daysDiff = isPastContent
    ? Math.floor((createdDate.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="bg-[#161616] rounded-lg p-3 border border-white/[0.06] hover:border-white/10 transition-colors relative">
      {/* Past Content Badge */}
      {isPastContent && daysDiff > 0 && (
        <div className="absolute top-2 right-2 z-10">
          <span
            className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-400"
            title={`원본 게시일: ${publishedDate.toLocaleDateString("ko-KR")}\n수집일: ${createdDate.toLocaleDateString("ko-KR")}`}
          >
            과거: {publishedDate.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
            <span className="text-amber-500/60 ml-0.5">({daysDiff}일 전)</span>
          </span>
        </div>
      )}
      <div className="flex gap-3">
        {/* Thumbnail */}
        {item.thumbnail_url && (
          <div className="relative w-28 h-16 rounded overflow-hidden flex-shrink-0 bg-black">
            <Image src={item.thumbnail_url} alt="" fill className="object-cover" unoptimized />
            {item.duration && (
              <div className="absolute bottom-0.5 right-0.5 px-1 py-0.5 bg-black/80 rounded text-[9px] text-white">
                {item.duration}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] ${STATUS_STYLES[item.status].bg} ${STATUS_STYLES[item.status].text}`}
            >
              {STATUS_STYLES[item.status].label}
            </span>
            {/* AI Article Type Badge */}
            {item.ai_article_type && (
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] ${AI_TYPE_STYLES[item.ai_article_type].bg} ${AI_TYPE_STYLES[item.ai_article_type].text}`}
                title={`AI 분류: ${item.ai_article_type}${item.ai_article_type_secondary ? ` + ${item.ai_article_type_secondary}` : ""}`}
              >
                {AI_TYPE_STYLES[item.ai_article_type].emoji}{" "}
                {AI_TYPE_STYLES[item.ai_article_type].label}
                {item.ai_article_type_secondary && (
                  <span className="ml-0.5 opacity-70">
                    +{AI_TYPE_STYLES[item.ai_article_type_secondary].emoji}
                  </span>
                )}
              </span>
            )}
            {/* Confidence indicator */}
            {item.ai_classification_confidence !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] ${
                  item.ai_classification_confidence >= 0.9
                    ? "bg-emerald-500/20 text-emerald-400"
                    : item.ai_classification_confidence >= 0.7
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                }`}
                title={`신뢰도: ${(item.ai_classification_confidence * 100).toFixed(0)}%\n근거: ${item.ai_classification_signals?.join(", ") || "N/A"}`}
              >
                {(item.ai_classification_confidence * 100).toFixed(0)}%
              </span>
            )}
            {item.category && (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-white/50">
                {CATEGORY_OPTIONS.find((c) => c.value === item.category)?.label || item.category}
              </span>
            )}
          </div>
          {/* News Tags */}
          {item.news_tags && item.news_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.news_tags.slice(0, 4).map((tag) => {
                const style = NEWS_TAG_STYLES[tag] || {
                  label: tag,
                  bg: "bg-gray-500/20",
                  text: "text-gray-400",
                };
                return (
                  <span
                    key={tag}
                    className={`px-1.5 py-0.5 rounded text-[8px] ${style.bg} ${style.text}`}
                  >
                    {style.label}
                  </span>
                );
              })}
              {item.news_tags.length > 4 && (
                <span className="px-1.5 py-0.5 rounded text-[8px] bg-white/10 text-white/40">
                  +{item.news_tags.length - 4}
                </span>
              )}
            </div>
          )}
          <h4 className="text-[13px] text-white font-medium line-clamp-1 mb-0.5">{item.title}</h4>
          <div className="text-[11px] text-white/40">
            {item.type === "youtube" ? item.channel_name : item.source_name}
            {item.view_count && ` • ${(item.view_count / 1000).toFixed(1)}K`}
            {" • "}
            {new Date(item.created_at).toLocaleDateString("ko-KR")}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 text-[10px] bg-white/5 text-white/50 rounded hover:text-white/70 transition-colors"
            >
              원본
            </a>
            <button
              onClick={onEdit}
              className="px-2 py-1 text-[10px] bg-white/5 text-white/50 rounded hover:text-white/70 transition-colors"
            >
              수정
            </button>
            {item.status === "pending" && (
              <>
                <button
                  onClick={() => onStatusChange(item.id, "published")}
                  className="px-2 py-1 text-[10px] bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors"
                >
                  게시
                </button>
                <button
                  onClick={() => onStatusChange(item.id, "rejected")}
                  className="px-2 py-1 text-[10px] bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                >
                  거부
                </button>
              </>
            )}
            {item.status === "ready" && (
              <button
                onClick={() => onStatusChange(item.id, "published")}
                className="px-2 py-1 text-[10px] bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors"
              >
                게시
              </button>
            )}
            {item.status === "published" && (
              <button
                onClick={() => onStatusChange(item.id, "pending")}
                className="px-2 py-1 text-[10px] bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-colors"
              >
                취소
              </button>
            )}
            {/* 삭제 버튼 - 항상 표시 */}
            <button
              onClick={onDelete}
              className="px-2 py-1 text-[10px] bg-white/5 text-white/30 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors"
              title="삭제"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Content Type Options
const CONTENT_TYPE_OPTIONS = [
  { value: "version_update", label: "버전 업데이트" },
  { value: "official", label: "공식 발표" },
  { value: "press", label: "언론 뉴스" },
  { value: "community", label: "커뮤니티" },
  { value: "youtube", label: "YouTube" },
];

// Edit Modal
function EditContentModal({
  item,
  onClose,
  onSave,
}: {
  item: ContentItem;
  onClose: () => void;
  onSave: (updates: Partial<ContentItem>) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [summary, setSummary] = useState(item.summary_md || "");
  const [category, setCategory] = useState(item.category || "");
  const [contentType, setContentType] = useState<string>(item.content_type || "press");
  const [keyPoints, setKeyPoints] = useState(item.key_points?.join("\n") || "");
  const [thumbnailUrl, setThumbnailUrl] = useState(item.thumbnail_url || "");
  const [thumbnailSource, setThumbnailSource] = useState<ThumbnailSource | undefined>(
    item.thumbnail_source
  );
  const [newsTags, setNewsTags] = useState<string[]>(item.news_tags || []);

  const toggleNewsTag = (tag: string) => {
    setNewsTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleThumbnailUpdate = (url: string, source: ThumbnailSource) => {
    setThumbnailUrl(url);
    setThumbnailSource(source);
  };

  const handleSave = () => {
    onSave({
      title,
      summary_md: summary,
      category,
      content_type: contentType as ContentItem["content_type"],
      key_points: keyPoints.split("\n").filter((p) => p.trim()),
      thumbnail_url: thumbnailUrl || undefined,
      thumbnail_source: thumbnailSource,
      news_tags: newsTags.length > 0 ? newsTags : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#161616] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/[0.06]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/[0.06]">
          <h3 className="text-[14px] font-semibold text-white">
            {item.type === "youtube" ? "영상" : "뉴스"} 수정
          </h3>
        </div>

        <div className="p-4 space-y-4">
          {/* Preview */}
          {item.type === "youtube" && item.video_id && (
            <div className="aspect-video rounded overflow-hidden bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${item.video_id}`}
                className="w-full h-full"
                allowFullScreen
              />
            </div>
          )}

          {/* Thumbnail Manager */}
          {item.type === "news" && (
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-2">썸네일</label>
              <ThumbnailManager
                contentId={item.id}
                currentThumbnail={thumbnailUrl}
                thumbnailSource={thumbnailSource}
                title={title}
                summary={summary}
                onThumbnailUpdate={handleThumbnailUpdate}
              />
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
            />
          </div>

          {/* Content Type */}
          {item.type === "news" && (
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                콘텐츠 유형
              </label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
              >
                {CONTENT_TYPE_OPTIONS.filter((opt) => opt.value !== "youtube").map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* News Tags */}
          {item.type === "news" && (
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                뉴스 태그 (필터링용)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_NEWS_TAGS.map((tag) => {
                  const style = NEWS_TAG_STYLES[tag] || {
                    label: tag,
                    bg: "bg-gray-500/20",
                    text: "text-gray-400",
                  };
                  const isSelected = newsTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleNewsTag(tag)}
                      className={`px-2 py-1 rounded text-[10px] transition-all ${
                        isSelected
                          ? `${style.bg} ${style.text} ring-1 ring-white/20`
                          : "bg-white/5 text-white/40 hover:bg-white/10"
                      }`}
                    >
                      {style.label}
                    </button>
                  );
                })}
              </div>
              {newsTags.length > 0 && (
                <p className="text-[10px] text-white/30 mt-1.5">선택됨: {newsTags.join(", ")}</p>
              )}
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
            >
              <option value="">선택...</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Summary - Expanded */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-white/50">요약</label>
              <span className="text-[10px] text-white/30">{summary.length}자</span>
            </div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={8}
              className="w-full px-3 py-2.5 bg-black/30 border border-white/[0.08] rounded-lg text-[13px] text-white leading-relaxed focus:outline-none focus:border-white/20 resize-y min-h-[180px]"
            />
          </div>

          {/* Key Points - Expanded */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-white/50">
                핵심 포인트 <span className="text-white/30">(줄바꿈으로 구분)</span>
              </label>
              <span className="text-[10px] text-white/30">
                {keyPoints.split("\n").filter((p) => p.trim()).length}개
              </span>
            </div>
            <textarea
              value={keyPoints}
              onChange={(e) => setKeyPoints(e.target.value)}
              rows={5}
              placeholder="• 첫 번째 핵심 포인트&#10;• 두 번째 핵심 포인트&#10;• 세 번째 핵심 포인트"
              className="w-full px-3 py-2.5 bg-black/30 border border-white/[0.08] rounded-lg text-[13px] text-white leading-relaxed focus:outline-none focus:border-white/20 resize-y min-h-[120px] placeholder:text-white/20"
            />
          </div>
        </div>

        <div className="p-4 border-t border-white/[0.06] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 text-white/70 rounded text-[12px] hover:bg-white/10 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => {
              // 모든 변경사항을 한번에 저장 (thumbnail 포함)
              onSave({
                title,
                summary_md: summary,
                category,
                content_type: contentType as ContentItem["content_type"],
                key_points: keyPoints.split("\n").filter((p) => p.trim()),
                thumbnail_url: thumbnailUrl || undefined,
                thumbnail_source: thumbnailSource,
                news_tags: newsTags.length > 0 ? newsTags : undefined,
                status: "published",
              });
            }}
            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded text-[12px] hover:bg-emerald-500/30 transition-colors"
          >
            저장 후 게시
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[var(--color-claude-coral)] text-white rounded text-[12px] hover:opacity-90 transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
