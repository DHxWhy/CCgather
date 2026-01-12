"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import ThumbnailManager from "@/components/admin/ThumbnailManager";
import type { ThumbnailSource } from "@/types/automation";

type ContentType = "news" | "youtube";
type ContentStatus = "pending" | "ready" | "published" | "rejected";
type ContentTab = "news" | "youtube";

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

type AutomationMode = "on" | "confirm" | "off";

interface AutomationSettings {
  newsMode: AutomationMode;
  youtubeMode: AutomationMode;
  newsCrawlInterval: number;
  youtubeCrawlInterval: number;
  lastNewsCrawlAt?: string;
  lastYoutubeCrawlAt?: string;
}

const AUTOMATION_MODE_INFO: Record<AutomationMode, { label: string; desc: string; color: string }> =
  {
    on: { label: "ON", desc: "완전 자동", color: "bg-emerald-500" },
    confirm: { label: "CONFIRM", desc: "검토 필요", color: "bg-yellow-500" },
    off: { label: "OFF", desc: "수동 모드", color: "bg-red-500" },
  };

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
  const [settings, setSettings] = useState<AutomationSettings>({
    newsMode: "confirm",
    youtubeMode: "confirm",
    newsCrawlInterval: 6,
    youtubeCrawlInterval: 12,
  });
  const [manualUrl, setManualUrl] = useState("");
  const [filter, setFilter] = useState<"all" | ContentStatus>("all");
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [crawling, setCrawling] = useState(false);

  useEffect(() => {
    fetchContents();
    fetchSettings();
  }, []);

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

  async function fetchSettings() {
    try {
      const response = await fetch("/api/admin/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings((prev) => ({
          ...prev,
          newsMode: data.newsMode || data.news_mode || prev.newsMode,
          youtubeMode: data.youtubeMode || data.youtube_mode || prev.youtubeMode,
          newsCrawlInterval:
            data.newsCrawlInterval || data.news_crawl_interval || prev.newsCrawlInterval,
          youtubeCrawlInterval:
            data.youtubeCrawlInterval || data.youtube_crawl_interval || prev.youtubeCrawlInterval,
          lastNewsCrawlAt: data.lastNewsCrawlAt || data.last_news_crawl_at,
          lastYoutubeCrawlAt: data.lastYoutubeCrawlAt || data.last_youtube_crawl_at,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  }

  async function updateSettings(newSettings: Partial<AutomationSettings>) {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch (error) {
      console.error("Failed to update settings:", error);
    }
  }

  async function triggerCrawl(type: ContentTab, targetUrl?: string) {
    setCrawling(true);
    try {
      const response = await fetch("/api/admin/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, url: targetUrl }),
      });
      if (response.ok) {
        const data = await response.json();
        alert(`${data.message || "수집 완료"}`);
        fetchContents();
        fetchSettings();
        setManualUrl("");
      } else {
        const data = await response.json();
        alert(`${data.error || "수집 실패"}`);
      }
    } catch {
      alert("수집 오류");
    } finally {
      setCrawling(false);
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

  const filteredContents = contents.filter((item) => {
    if (item.type !== activeTab) return false;
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
        <p className="text-[12px] text-white/50 mt-0.5">뉴스 및 YouTube 영상 콘텐츠 관리</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        <button
          onClick={() => setActiveTab("news")}
          className={`px-4 py-2.5 text-[12px] font-medium relative transition-colors ${
            activeTab === "news" ? "text-white" : "text-white/40 hover:text-white/60"
          }`}
        >
          <span className="flex items-center gap-1.5">
            뉴스
            {newsPendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-yellow-500/20 text-yellow-400">
                {newsPendingCount}
              </span>
            )}
          </span>
          {activeTab === "news" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-claude-coral)]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("youtube")}
          className={`px-4 py-2.5 text-[12px] font-medium relative transition-colors ${
            activeTab === "youtube" ? "text-white" : "text-white/40 hover:text-white/60"
          }`}
        >
          <span className="flex items-center gap-1.5">
            YouTube
            {youtubePendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-yellow-500/20 text-yellow-400">
                {youtubePendingCount}
              </span>
            )}
          </span>
          {activeTab === "youtube" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
          )}
        </button>
      </div>

      {/* Automation Panel */}
      {activeTab === "news" ? (
        <AutomationPanel
          type="news"
          settings={settings}
          onUpdateSettings={updateSettings}
          onCrawl={(url) => triggerCrawl("news", url)}
          crawling={crawling}
          manualUrl={manualUrl}
          setManualUrl={setManualUrl}
        />
      ) : (
        <AutomationPanel
          type="youtube"
          settings={settings}
          onUpdateSettings={updateSettings}
          onCrawl={(url) => triggerCrawl("youtube", url)}
          crawling={crawling}
          manualUrl={manualUrl}
          setManualUrl={setManualUrl}
        />
      )}

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

// 3-way Toggle
function ThreeWayToggle({
  value,
  onChange,
}: {
  value: AutomationMode;
  onChange: (mode: AutomationMode) => void;
}) {
  const modes: AutomationMode[] = ["on", "confirm", "off"];
  return (
    <div className="flex gap-0.5 p-0.5 bg-white/5 rounded">
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
            value === mode
              ? `${AUTOMATION_MODE_INFO[mode].color} text-white`
              : "text-white/40 hover:text-white/60"
          }`}
        >
          {AUTOMATION_MODE_INFO[mode].label}
        </button>
      ))}
    </div>
  );
}

// Automation Panel
function AutomationPanel({
  type,
  settings,
  onUpdateSettings,
  onCrawl,
  crawling,
  manualUrl,
  setManualUrl,
}: {
  type: "news" | "youtube";
  settings: AutomationSettings;
  onUpdateSettings: (s: Partial<AutomationSettings>) => void;
  onCrawl: (url?: string) => void;
  crawling: boolean;
  manualUrl: string;
  setManualUrl: (url: string) => void;
}) {
  const currentMode = type === "news" ? settings.newsMode : settings.youtubeMode;
  const lastCrawl = type === "news" ? settings.lastNewsCrawlAt : settings.lastYoutubeCrawlAt;
  const borderColor = type === "news" ? "border-blue-500/20" : "border-red-500/20";
  const bgColor = type === "news" ? "bg-blue-500/5" : "bg-red-500/5";

  return (
    <div className={`${bgColor} rounded-lg p-4 border ${borderColor}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-medium text-white">
          {type === "news" ? "뉴스" : "YouTube"} 자동화
        </div>
        <ThreeWayToggle
          value={currentMode}
          onChange={(mode) =>
            onUpdateSettings(type === "news" ? { newsMode: mode } : { youtubeMode: mode })
          }
        />
      </div>

      <div className="text-[11px] text-white/50 mb-3">{AUTOMATION_MODE_INFO[currentMode].desc}</div>

      {currentMode === "off" ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder={type === "news" ? "뉴스 URL 입력..." : "YouTube URL 입력..."}
            className="flex-1 px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[12px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
          />
          <button
            onClick={() => onCrawl(manualUrl)}
            disabled={crawling || !manualUrl}
            className={`px-4 py-2 ${type === "news" ? "bg-blue-500" : "bg-red-500"} text-white rounded text-[12px] hover:opacity-90 transition-colors disabled:opacity-50`}
          >
            {crawling ? "..." : "수집"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <select
            value={type === "news" ? settings.newsCrawlInterval : settings.youtubeCrawlInterval}
            onChange={(e) =>
              onUpdateSettings(
                type === "news"
                  ? { newsCrawlInterval: Number(e.target.value) }
                  : { youtubeCrawlInterval: Number(e.target.value) }
              )
            }
            className="px-2.5 py-1.5 bg-white/5 border border-white/[0.06] rounded text-[12px] text-white focus:outline-none"
          >
            <option value={1}>1시간</option>
            <option value={3}>3시간</option>
            <option value={6}>6시간</option>
            <option value={12}>12시간</option>
            <option value={24}>24시간</option>
          </select>
          <button
            onClick={() => onCrawl()}
            disabled={crawling}
            className="px-3 py-1.5 bg-white/10 text-white/70 rounded text-[12px] hover:bg-white/15 transition-colors disabled:opacity-50"
          >
            {crawling ? "수집 중..." : "수동 실행"}
          </button>
          {lastCrawl && (
            <span className="text-[11px] text-white/40">
              마지막:{" "}
              {new Date(lastCrawl).toLocaleString("ko-KR", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      )}
    </div>
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
