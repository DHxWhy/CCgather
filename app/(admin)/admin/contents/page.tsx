"use client";

import { useState, useEffect } from "react";

type ContentType = "news" | "youtube";
type ContentStatus = "pending" | "ready" | "published" | "rejected";
type ContentTab = "news" | "youtube";

interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  source_url: string;
  source_name: string;
  thumbnail_url?: string;
  summary_md?: string;
  key_points?: string[];
  category?: string;
  tags?: string[];
  status: ContentStatus;
  created_at: string;
  published_at?: string;
  // YouTube specific
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
    on: { label: "ON", desc: "완전 자동 (수집 → 자동 게시)", color: "bg-green-500" },
    confirm: {
      label: "CONFIRM",
      desc: "검토 필요 (수집 → 검토 → 수동 게시)",
      color: "bg-yellow-500",
    },
    off: { label: "OFF", desc: "수동 모드 (URL 직접 입력)", color: "bg-red-500" },
  };

const STATUS_STYLES: Record<ContentStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "검토 대기" },
  ready: { bg: "bg-blue-500/20", text: "text-blue-400", label: "게시 준비" },
  published: { bg: "bg-green-500/20", text: "text-green-400", label: "게시됨" },
  rejected: { bg: "bg-red-500/20", text: "text-red-400", label: "거부됨" },
};

const CATEGORY_OPTIONS = [
  { value: "tutorial", label: "튜토리얼" },
  { value: "update", label: "업데이트" },
  { value: "tip", label: "팁 & 트릭" },
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
        setSettings(data);
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
        alert(`✅ ${data.message || "수집 완료"}`);
        fetchContents();
        fetchSettings();
        setManualUrl("");
      } else {
        const data = await response.json();
        alert(`❌ ${data.error || "수집 실패"}`);
      }
    } catch (error) {
      alert("❌ 수집 오류");
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

  // Filter contents by active tab and status
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">콘텐츠 관리</h2>
        <p className="text-white/60">뉴스 및 YouTube 영상 콘텐츠를 관리합니다.</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        <button
          onClick={() => setActiveTab("news")}
          className={`px-6 py-4 text-sm font-medium relative transition-colors ${
            activeTab === "news" ? "text-white" : "text-white/40 hover:text-white/60"
          }`}
        >
          <span className="flex items-center gap-2">
            📰 뉴스
            {newsPendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
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
          className={`px-6 py-4 text-sm font-medium relative transition-colors ${
            activeTab === "youtube" ? "text-white" : "text-white/40 hover:text-white/60"
          }`}
        >
          <span className="flex items-center gap-2">
            🎬 YouTube
            {youtubePendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
                {youtubePendingCount}
              </span>
            )}
          </span>
          {activeTab === "youtube" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
          )}
        </button>
      </div>

      {/* Tab-specific Automation Settings */}
      {activeTab === "news" ? (
        <NewsAutomationPanel
          settings={settings}
          onUpdateSettings={updateSettings}
          onCrawl={(url) => triggerCrawl("news", url)}
          crawling={crawling}
          manualUrl={manualUrl}
          setManualUrl={setManualUrl}
        />
      ) : (
        <YouTubeAutomationPanel
          settings={settings}
          onUpdateSettings={updateSettings}
          onCrawl={(url) => triggerCrawl("youtube", url)}
          crawling={crawling}
          manualUrl={manualUrl}
          setManualUrl={setManualUrl}
        />
      )}

      {/* Status Filter */}
      <div className="flex gap-2">
        {(["all", "pending", "ready", "published", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === s ? "bg-white/20 text-white" : "bg-white/5 text-white/40 hover:text-white"
            }`}
          >
            {s === "all" ? "전체" : STATUS_STYLES[s].label}
          </button>
        ))}
      </div>

      {/* Content List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-white/40">로딩 중...</div>
        ) : filteredContents.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            {activeTab === "news" ? "뉴스" : "YouTube 영상"}가 없습니다.
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

// 3-way Toggle Component
function ThreeWayToggle({
  value,
  onChange,
}: {
  value: AutomationMode;
  onChange: (mode: AutomationMode) => void;
}) {
  const modes: AutomationMode[] = ["on", "confirm", "off"];

  return (
    <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
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

// News Automation Panel
function NewsAutomationPanel({
  settings,
  onUpdateSettings,
  onCrawl,
  crawling,
  manualUrl,
  setManualUrl,
}: {
  settings: AutomationSettings;
  onUpdateSettings: (s: Partial<AutomationSettings>) => void;
  onCrawl: (url?: string) => void;
  crawling: boolean;
  manualUrl: string;
  setManualUrl: (url: string) => void;
}) {
  const currentMode = settings.newsMode;

  return (
    <div className="bg-blue-500/5 rounded-xl p-6 border border-blue-500/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          📰 뉴스 자동화 설정
        </h3>
        <ThreeWayToggle
          value={currentMode}
          onChange={(mode) => onUpdateSettings({ newsMode: mode })}
        />
      </div>

      {/* Mode Description */}
      <div className="mb-4 p-3 bg-white/5 rounded-lg">
        <div className="text-sm text-white/60">
          현재 모드:{" "}
          <span className="text-white font-medium">{AUTOMATION_MODE_INFO[currentMode].desc}</span>
        </div>
      </div>

      {/* Mode-specific UI */}
      {currentMode === "off" ? (
        // Manual Mode: URL Input
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              수집할 뉴스 URL 입력
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://example.com/news/article..."
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => onCrawl(manualUrl)}
                disabled={crawling || !manualUrl}
                className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {crawling ? "⏳" : "📥"} 수집
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Auto/Confirm Mode: Crawl Settings
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Crawl Interval */}
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-white font-medium mb-2">수집 주기</div>
            <select
              value={settings.newsCrawlInterval}
              onChange={(e) => onUpdateSettings({ newsCrawlInterval: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white"
            >
              <option value={1}>1시간마다</option>
              <option value={3}>3시간마다</option>
              <option value={6}>6시간마다</option>
              <option value={12}>12시간마다</option>
              <option value={24}>24시간마다</option>
            </select>
          </div>

          {/* Manual Crawl Button */}
          <div className="p-4 bg-white/5 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-white font-medium">수동 수집</div>
              <div className="text-sm text-white/40">지금 바로 크롤링 실행</div>
            </div>
            <button
              onClick={() => onCrawl()}
              disabled={crawling}
              className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50"
            >
              {crawling ? "⏳ 수집 중..." : "🔄 실행"}
            </button>
          </div>
        </div>
      )}

      {settings.lastNewsCrawlAt && (
        <div className="mt-4 text-sm text-white/40">
          마지막 수집: {new Date(settings.lastNewsCrawlAt).toLocaleString("ko-KR")}
        </div>
      )}
    </div>
  );
}

// YouTube Automation Panel
function YouTubeAutomationPanel({
  settings,
  onUpdateSettings,
  onCrawl,
  crawling,
  manualUrl,
  setManualUrl,
}: {
  settings: AutomationSettings;
  onUpdateSettings: (s: Partial<AutomationSettings>) => void;
  onCrawl: (url?: string) => void;
  crawling: boolean;
  manualUrl: string;
  setManualUrl: (url: string) => void;
}) {
  const currentMode = settings.youtubeMode;

  return (
    <div className="bg-red-500/5 rounded-xl p-6 border border-red-500/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          🎬 YouTube 자동화 설정
        </h3>
        <ThreeWayToggle
          value={currentMode}
          onChange={(mode) => onUpdateSettings({ youtubeMode: mode })}
        />
      </div>

      {/* Mode Description */}
      <div className="mb-4 p-3 bg-white/5 rounded-lg">
        <div className="text-sm text-white/60">
          현재 모드:{" "}
          <span className="text-white font-medium">{AUTOMATION_MODE_INFO[currentMode].desc}</span>
        </div>
      </div>

      {/* Mode-specific UI */}
      {currentMode === "off" ? (
        // Manual Mode: URL Input
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              수집할 YouTube URL 입력
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                onClick={() => onCrawl(manualUrl)}
                disabled={crawling || !manualUrl}
                className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {crawling ? "⏳" : "📥"} 수집
              </button>
            </div>
          </div>
          <p className="text-xs text-white/40">💡 YouTube 영상 URL 또는 채널 URL을 입력하세요</p>
        </div>
      ) : (
        // Auto/Confirm Mode: Crawl Settings
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Crawl Interval */}
            <div className="p-4 bg-white/5 rounded-lg">
              <div className="text-white font-medium mb-2">수집 주기</div>
              <select
                value={settings.youtubeCrawlInterval}
                onChange={(e) => onUpdateSettings({ youtubeCrawlInterval: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white"
              >
                <option value={6}>6시간마다</option>
                <option value={12}>12시간마다</option>
                <option value={24}>24시간마다</option>
                <option value={48}>2일마다</option>
              </select>
            </div>

            {/* Manual Crawl Button */}
            <div className="p-4 bg-white/5 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-white font-medium">수동 수집</div>
                <div className="text-sm text-white/40">지금 바로 검색 실행</div>
              </div>
              <button
                onClick={() => onCrawl()}
                disabled={crawling}
                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {crawling ? "⏳ 수집 중..." : "🔄 실행"}
              </button>
            </div>
          </div>

          {/* Search Keywords */}
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-white font-medium mb-2">검색 키워드</div>
            <div className="flex flex-wrap gap-2">
              {[
                "Claude Code",
                "Claude Code tutorial",
                "Anthropic Claude 코딩",
                "vibe coding Claude",
              ].map((keyword) => (
                <span
                  key={keyword}
                  className="px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-sm"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {settings.lastYoutubeCrawlAt && (
        <div className="mt-4 text-sm text-white/40">
          마지막 수집: {new Date(settings.lastYoutubeCrawlAt).toLocaleString("ko-KR")}
        </div>
      )}
    </div>
  );
}

// Content Card Component
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
    <div className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-white/20 transition-colors">
      <div className="flex gap-4">
        {/* Thumbnail */}
        {item.thumbnail_url && (
          <div className="w-40 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-black">
            <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
            {item.duration && (
              <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 rounded text-xs text-white">
                {item.duration}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLES[item.status].bg} ${STATUS_STYLES[item.status].text}`}
                >
                  {STATUS_STYLES[item.status].label}
                </span>
                {item.category && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/60">
                    {CATEGORY_OPTIONS.find((c) => c.value === item.category)?.label ||
                      item.category}
                  </span>
                )}
              </div>
              <h4 className="text-white font-medium line-clamp-2">{item.title}</h4>
              <div className="text-sm text-white/40 mt-1">
                {item.type === "youtube" ? item.channel_name : item.source_name}
                {item.view_count && ` • ${(item.view_count / 1000).toFixed(1)}K 조회`}
                {" • "}
                {new Date(item.created_at).toLocaleDateString("ko-KR")}
              </div>
            </div>
          </div>

          {/* Summary Preview */}
          {item.summary_md && (
            <p className="text-sm text-white/60 line-clamp-2 mb-3">{item.summary_md}</p>
          )}

          {/* Key Points */}
          {item.key_points && item.key_points.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {item.key_points.slice(0, 3).map((point, i) => (
                <span key={i} className="text-xs px-2 py-1 bg-white/5 rounded text-white/60">
                  • {point.length > 40 ? point.slice(0, 40) + "..." : point}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-sm bg-white/10 text-white/60 rounded-lg hover:text-white transition-colors"
            >
              🔗 원본 보기
            </a>
            <button
              onClick={onEdit}
              className="px-3 py-1.5 text-sm bg-white/10 text-white/60 rounded-lg hover:text-white transition-colors"
            >
              ✏️ 수정
            </button>
            {item.status === "pending" && (
              <>
                <button
                  onClick={() => onStatusChange(item.id, "published")}
                  className="px-3 py-1.5 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                >
                  ✅ 바로 게시
                </button>
                <button
                  onClick={() => onStatusChange(item.id, "rejected")}
                  className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  ❌ 거부
                </button>
              </>
            )}
            {item.status === "ready" && (
              <button
                onClick={() => onStatusChange(item.id, "published")}
                className="px-3 py-1.5 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
              >
                ✅ 게시
              </button>
            )}
            {item.status === "published" && (
              <button
                onClick={() => onStatusChange(item.id, "pending")}
                className="px-3 py-1.5 text-sm bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
              >
                ↩️ 게시 취소
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Edit Modal Component
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
  const [keyPoints, setKeyPoints] = useState(item.key_points?.join("\n") || "");

  const handleSave = () => {
    onSave({
      title,
      summary_md: summary,
      category,
      key_points: keyPoints.split("\n").filter((p) => p.trim()),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-xl font-bold text-white">
            {item.type === "youtube" ? "🎬 영상" : "📰 뉴스"} 수정
          </h3>
        </div>

        <div className="p-6 space-y-4">
          {/* Preview */}
          {item.type === "youtube" && item.video_id && (
            <div className="aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${item.video_id}`}
                className="w-full h-full"
                allowFullScreen
              />
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
            >
              <option value="">카테고리 선택...</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">요약</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)] resize-none"
            />
          </div>

          {/* Key Points */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              핵심 포인트 (줄바꿈으로 구분)
            </label>
            <textarea
              value={keyPoints}
              onChange={(e) => setKeyPoints(e.target.value)}
              rows={4}
              placeholder="첫 번째 포인트&#10;두 번째 포인트&#10;세 번째 포인트"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)] resize-none placeholder:text-white/20"
            />
          </div>
        </div>

        <div className="p-6 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => {
              handleSave();
              onSave({ ...item, status: "published" });
            }}
            className="px-6 py-3 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-colors"
          >
            저장 후 게시
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-[var(--color-claude-coral)] text-white rounded-xl hover:opacity-90 transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
