"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import ThumbnailManager from "@/components/admin/ThumbnailManager";
import TargetManager from "@/components/admin/TargetManager";
import CronScheduler from "@/components/admin/CronScheduler";
import type { ThumbnailSource } from "@/types/automation";

type ContentType = "news" | "youtube";
type ContentStatus = "pending" | "ready" | "published" | "rejected";
type ContentTab = "news" | "youtube" | "targets" | "scheduler";

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
  status: ContentStatus;
  created_at: string;
  published_at?: string;
  video_id?: string;
  channel_name?: string;
  duration?: string;
  view_count?: number;
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

export default function AdminContentsPage() {
  const [activeTab, setActiveTab] = useState<ContentTab>("news");
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ContentStatus>("all");
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (activeTab === "news" || activeTab === "youtube") {
      fetchContents();
    }
  }, [activeTab]);

  async function fetchContents() {
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
  }

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
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* Target Manager */}
        {activeTab === "targets" && <TargetManager onRefresh={handleRefresh} />}

        {/* Cron Scheduler */}
        {activeTab === "scheduler" && <CronScheduler onRefresh={handleRefresh} />}
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
}: {
  item: ContentItem;
  onEdit: () => void;
  onStatusChange: (id: string, status: ContentStatus) => void;
}) {
  return (
    <div className="bg-[#161616] rounded-lg p-3 border border-white/[0.06] hover:border-white/10 transition-colors">
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
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] ${STATUS_STYLES[item.status].bg} ${STATUS_STYLES[item.status].text}`}
            >
              {STATUS_STYLES[item.status].label}
            </span>
            {item.category && (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-white/50">
                {CATEGORY_OPTIONS.find((c) => c.value === item.category)?.label || item.category}
              </span>
            )}
          </div>
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
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161616] rounded-lg w-full max-w-xl max-h-[85vh] overflow-y-auto border border-white/[0.06]">
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
              className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20"
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
                className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20"
              >
                {CONTENT_TYPE_OPTIONS.filter((opt) => opt.value !== "youtube").map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20"
            >
              <option value="">선택...</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">요약</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 resize-none"
            />
          </div>

          {/* Key Points */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">
              핵심 포인트 (줄바꿈)
            </label>
            <textarea
              value={keyPoints}
              onChange={(e) => setKeyPoints(e.target.value)}
              rows={3}
              placeholder="첫 번째 포인트&#10;두 번째 포인트"
              className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 resize-none placeholder:text-white/20"
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
              handleSave();
              onSave({ ...item, status: "published" });
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
