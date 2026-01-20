"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Sparkles, Check, RefreshCw, Loader2 } from "lucide-react";
import ThumbnailManager from "@/components/admin/ThumbnailManager";
import TargetManager from "@/components/admin/TargetManager";
import CronScheduler from "@/components/admin/CronScheduler";
import UnusedThumbnailManager from "@/components/admin/UnusedThumbnailManager";
import BatchCollector from "@/components/admin/BatchCollector";
import { useToast } from "@/components/ui/ToastProvider";
import type { ThumbnailSource } from "@/types/automation";

// Thumbnail model types
type ThumbnailModel = "imagen" | "gemini_flash";

const THUMBNAIL_MODELS: Record<ThumbnailModel, { label: string; price: string; color: string }> = {
  imagen: { label: "Imagen 4", price: "$0.04", color: "text-purple-400" },
  gemini_flash: { label: "Gemini Flash", price: "$0.039", color: "text-blue-400" },
};

const THUMBNAIL_MODEL_STORAGE_KEY = "ccgather_thumbnail_model";

type ContentType = "news" | "youtube";
type ContentStatus = "pending" | "ready" | "published" | "rejected";
type ContentTab = "news" | "youtube" | "targets" | "scheduler" | "storage" | "batch";

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

  // Thumbnail model settings
  const [thumbnailModel, setThumbnailModel] = useState<ThumbnailModel>("gemini_flash");
  const [showModelSettings, setShowModelSettings] = useState(false);

  // Bulk thumbnail regeneration state
  const [bulkRegenerating, setBulkRegenerating] = useState(false);
  const [bulkStats, setBulkStats] = useState<{ ogImages: number; aiGenerated: number } | null>(
    null
  );
  const [bulkProgress, setBulkProgress] = useState<{
    current: number;
    total: number;
    batchIndex: number;
  } | null>(null);
  const bulkAbortedRef = useRef(false);

  // Load thumbnail model preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(THUMBNAIL_MODEL_STORAGE_KEY);
    if (saved && (saved === "imagen" || saved === "gemini_flash")) {
      setThumbnailModel(saved);
    }
  }, []);

  // Save thumbnail model preference to localStorage
  const handleModelChange = (model: ThumbnailModel) => {
    setThumbnailModel(model);
    localStorage.setItem(THUMBNAIL_MODEL_STORAGE_KEY, model);
    setShowModelSettings(false);
    showToast({
      type: "success",
      title: "설정 저장",
      message: `기본 이미지 모델이 ${THUMBNAIL_MODELS[model].label}(으)로 설정되었습니다.`,
      duration: 3000,
    });
  };

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

  // Fetch bulk thumbnail stats
  const fetchBulkStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/thumbnail/bulk-regenerate");
      if (response.ok) {
        const data = await response.json();
        setBulkStats({ ogImages: data.ogImages, aiGenerated: data.aiGenerated });
      }
    } catch (error) {
      console.error("Failed to fetch bulk stats:", error);
    }
  }, []);

  // Bulk regenerate thumbnails
  // Handle single thumbnail update (from ContentCard)
  const handleThumbnailUpdate = (id: string, thumbnailUrl: string, source: string) => {
    setContents((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, thumbnail_url: thumbnailUrl, thumbnail_source: source as ThumbnailSource }
          : item
      )
    );
    // Update bulk stats
    fetchBulkStats();
  };

  const handleBulkRegenerate = async () => {
    const count = bulkStats?.ogImages || 0;
    const estimatedCost = (count * 0.039).toFixed(2);
    const estimatedTime = Math.ceil((count * 4) / 60);
    const batchCount = Math.ceil(count / 10);

    if (
      !confirm(
        `OG 이미지를 사용하는 ${count}개 콘텐츠의 썸네일을 AI로 재생성합니다.\n\n` +
          `📊 예상 비용: $${estimatedCost}\n` +
          `⏱️ 예상 시간: 약 ${estimatedTime}분\n` +
          `📦 배치 처리: ${batchCount}개 배치 (10개씩)\n\n` +
          `계속하시겠습니까?`
      )
    ) {
      return;
    }

    setBulkRegenerating(true);
    bulkAbortedRef.current = false;
    setBulkProgress({ current: 0, total: count, batchIndex: 0 });

    let totalSuccess = 0;
    let totalFailed = 0;
    let batchIndex = 0;
    let hasMore = true;

    try {
      while (hasMore && !bulkAbortedRef.current) {
        const response = await fetch("/api/admin/thumbnail/bulk-regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thumbnailModel, onlyOgImages: true, batchIndex }),
        });

        if (!response.ok) {
          const error = await response.json();
          showToast({
            type: "error",
            title: `배치 ${batchIndex + 1} 실패`,
            message: error.error || "알 수 없는 오류",
          });
          break;
        }

        const data = await response.json();
        totalSuccess += data.successCount;
        totalFailed += data.failedCount;
        hasMore = data.hasMore;
        batchIndex = data.nextBatchIndex ?? batchIndex + 1;

        // 진행 상태 업데이트
        const processed = batchIndex * 10;
        setBulkProgress({
          current: Math.min(processed, count),
          total: count,
          batchIndex: batchIndex,
        });

        // 중간 토스트 (매 3배치마다)
        if (batchIndex % 3 === 0 && hasMore) {
          showToast({
            type: "info",
            title: "진행 중...",
            message: `${Math.min(processed, count)}/${count} 완료`,
            duration: 2000,
          });
        }

        // UI 업데이트를 위한 잠시 대기
        await new Promise((r) => setTimeout(r, 100));
      }

      // 완료 토스트
      if (!bulkAbortedRef.current) {
        showToast({
          type: "success",
          title: "썸네일 재생성 완료",
          message: `${totalSuccess}개 성공, ${totalFailed}개 실패`,
          duration: 5000,
        });
      } else {
        showToast({
          type: "info",
          title: "재생성 중단됨",
          message: `${totalSuccess}개 완료 후 중단됨`,
          duration: 5000,
        });
      }

      fetchContents();
      fetchBulkStats();
    } catch (error) {
      showToast({
        type: "error",
        title: "재생성 실패",
        message: error instanceof Error ? error.message : "네트워크 오류",
      });
    } finally {
      setBulkRegenerating(false);
      setBulkProgress(null);
    }
  };

  const handleAbortBulkRegenerate = () => {
    bulkAbortedRef.current = true;
    showToast({
      type: "info",
      title: "중단 요청됨",
      message: "현재 배치 완료 후 중단됩니다",
      duration: 3000,
    });
  };

  useEffect(() => {
    if (activeTab === "news" || activeTab === "youtube") {
      fetchContents();
      fetchBulkStats();
    }
  }, [activeTab, fetchContents, fetchBulkStats]);

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
        <TabButton active={activeTab === "batch"} onClick={() => setActiveTab("batch")}>
          📚 배치 수집
        </TabButton>
      </div>

      {/* Tab Content */}
      <div key={refreshKey}>
        {/* News/YouTube Content List */}
        {(activeTab === "news" || activeTab === "youtube") && (
          <>
            {/* Status Filter + Model Settings + Bulk Regenerate */}
            <div className="flex items-center justify-between gap-4">
              {/* Status Filter */}
              <div className="flex gap-1.5 flex-wrap">
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

              {/* Thumbnail Model Settings */}
              <div className="relative">
                <button
                  onClick={() => setShowModelSettings(!showModelSettings)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-colors ${
                    showModelSettings
                      ? "bg-purple-500/20 text-purple-400"
                      : "bg-white/5 text-white/50 hover:text-white/70"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>이미지 모델</span>
                  <span className={`${THUMBNAIL_MODELS[thumbnailModel].color}`}>
                    {THUMBNAIL_MODELS[thumbnailModel].label}
                  </span>
                </button>

                {/* Model Selection Dropdown */}
                {showModelSettings && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowModelSettings(false)}
                    />
                    {/* Dropdown */}
                    <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                      <div className="px-3 py-2 border-b border-white/10">
                        <div className="text-[11px] font-medium text-white/70">
                          기본 이미지 생성 모델
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5">
                          배치 수집 및 자동 수집 시 사용됩니다
                        </div>
                      </div>
                      <div className="p-1.5">
                        {(Object.keys(THUMBNAIL_MODELS) as ThumbnailModel[]).map((model) => (
                          <button
                            key={model}
                            onClick={() => handleModelChange(model)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded text-[11px] transition-colors ${
                              thumbnailModel === model
                                ? "bg-purple-500/20 text-purple-400"
                                : "text-white/70 hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={THUMBNAIL_MODELS[model].color}>
                                {THUMBNAIL_MODELS[model].label}
                              </span>
                              <span className="text-white/40">{THUMBNAIL_MODELS[model].price}</span>
                            </div>
                            {thumbnailModel === model && (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="px-3 py-2 border-t border-white/10 text-[9px] text-white/30">
                        💡 Imagen 4: 사실적 스타일 • Gemini Flash: 일러스트 스타일
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Bulk Thumbnail Regenerate Button */}
              {activeTab === "news" && bulkStats && bulkStats.ogImages > 0 && (
                <div className="flex items-center gap-2">
                  {bulkRegenerating && bulkProgress ? (
                    <>
                      {/* Progress indicator */}
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>
                          {bulkProgress.current}/{bulkProgress.total}
                        </span>
                        <div className="w-16 h-1.5 bg-amber-900/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 transition-all duration-300"
                            style={{
                              width: `${(bulkProgress.current / bulkProgress.total) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      {/* Abort button */}
                      <button
                        onClick={handleAbortBulkRegenerate}
                        className="px-2 py-1.5 rounded text-[11px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        title="현재 배치 완료 후 중단"
                      >
                        중단
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleBulkRegenerate}
                      disabled={bulkRegenerating}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-colors bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
                      title={`OG 이미지 ${bulkStats.ogImages}개를 AI 썸네일로 재생성 (예상: $${(bulkStats.ogImages * 0.039).toFixed(2)})`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>OG→AI</span>
                      <span className="text-amber-300">{bulkStats.ogImages}</span>
                    </button>
                  )}
                </div>
              )}
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
                    thumbnailModel={thumbnailModel}
                    onThumbnailUpdate={handleThumbnailUpdate}
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
          <CronScheduler
            onRefresh={handleRefresh}
            onCollectionComplete={handleCollectionComplete}
          />
        )}

        {/* Storage - Unused Thumbnails */}
        {activeTab === "storage" && <UnusedThumbnailManager />}

        {/* Batch Collection */}
        {activeTab === "batch" && (
          <BatchCollector onComplete={fetchContents} thumbnailModel={thumbnailModel} />
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
  thumbnailModel,
  onThumbnailUpdate,
}: {
  item: ContentItem;
  onEdit: () => void;
  onStatusChange: (id: string, status: ContentStatus) => void;
  onDelete: () => void;
  thumbnailModel: ThumbnailModel;
  onThumbnailUpdate: (id: string, thumbnailUrl: string, source: string) => void;
}) {
  const [regenerating, setRegenerating] = useState(false);

  // Regenerate thumbnail
  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/admin/thumbnail/regenerate/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailModel }),
      });
      if (res.ok) {
        const data = await res.json();
        onThumbnailUpdate(item.id, data.thumbnail_url, data.source);
      }
    } catch (error) {
      console.error("Failed to regenerate thumbnail:", error);
    } finally {
      setRegenerating(false);
    }
  };

  // Check if thumbnail is OG image (needs AI generation)
  const isOgImage = !item.thumbnail_source || item.thumbnail_source === "og_image";

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
          <div className="relative w-28 h-16 rounded overflow-hidden flex-shrink-0 bg-black group">
            <Image src={item.thumbnail_url} alt="" fill className="object-cover" unoptimized />
            {item.duration && (
              <div className="absolute bottom-0.5 right-0.5 px-1 py-0.5 bg-black/80 rounded text-[9px] text-white">
                {item.duration}
              </div>
            )}
            {/* AI Generate Button - Show on hover or if OG image */}
            {item.type === "news" && (
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                  isOgImage
                    ? "bg-black/60 opacity-100"
                    : "bg-black/60 opacity-0 group-hover:opacity-100"
                }`}
                title={isOgImage ? "AI 썸네일 생성" : "AI 썸네일 재생성"}
              >
                {regenerating ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <span className="text-[10px] text-white font-medium px-2 py-1 bg-purple-500/80 rounded">
                    {isOgImage ? "✨ AI" : "🔄 AI"}
                  </span>
                )}
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] ${STATUS_STYLES[item.status]?.bg || "bg-gray-500/20"} ${STATUS_STYLES[item.status]?.text || "text-gray-400"}`}
            >
              {STATUS_STYLES[item.status]?.label || item.status}
            </span>
            {/* AI Article Type Badge */}
            {item.ai_article_type && AI_TYPE_STYLES[item.ai_article_type] && (
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] ${AI_TYPE_STYLES[item.ai_article_type].bg} ${AI_TYPE_STYLES[item.ai_article_type].text}`}
                title={`AI 분류: ${item.ai_article_type}${item.ai_article_type_secondary ? ` + ${item.ai_article_type_secondary}` : ""}`}
              >
                {AI_TYPE_STYLES[item.ai_article_type].emoji}{" "}
                {AI_TYPE_STYLES[item.ai_article_type].label}
                {item.ai_article_type_secondary &&
                  AI_TYPE_STYLES[item.ai_article_type_secondary] && (
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
            {item.view_count !== undefined && item.view_count > 0 && (
              <span className="text-white/50">
                {" "}
                • 👁{" "}
                {item.view_count >= 1000
                  ? `${(item.view_count / 1000).toFixed(1)}K`
                  : item.view_count}
              </span>
            )}
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
