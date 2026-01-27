"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Loader2, X, Clipboard } from "lucide-react";
import {
  TOOL_CATEGORIES,
  TOOL_PRICING_TYPES,
  CATEGORY_META,
  PRICING_META,
  TRUST_TIER_META,
  type ToolCategory,
  type ToolPricingType,
  type ToolStatus,
  type AdminToolListItem,
  type AdminToolStats,
  type TrustTier,
} from "@/lib/types/tools";

// =====================================================
// Status Styles
// =====================================================

const STATUS_STYLES: Record<ToolStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "대기" },
  approved: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "승인" },
  featured: { bg: "bg-purple-500/20", text: "text-purple-400", label: "특집" },
  rejected: { bg: "bg-red-500/20", text: "text-red-400", label: "거부" },
};

const PRIORITY_STYLES: Record<
  "high" | "medium" | "low",
  { bg: string; text: string; label: string }
> = {
  high: { bg: "bg-orange-500/20", text: "text-orange-400", label: "높음" },
  medium: { bg: "bg-blue-500/20", text: "text-blue-400", label: "중간" },
  low: { bg: "bg-gray-500/20", text: "text-gray-400", label: "낮음" },
};

// =====================================================
// Main Component
// =====================================================

export default function AdminToolsPage() {
  const [tools, setTools] = useState<AdminToolListItem[]>([]);
  const [stats, setStats] = useState<AdminToolStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ToolStatus | "all">("all");
  const [editingTool, setEditingTool] = useState<AdminToolListItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCrawlModal, setShowCrawlModal] = useState(false);

  useEffect(() => {
    fetchTools();
  }, []);

  async function fetchTools() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/tools");
      if (response.ok) {
        const data = await response.json();
        setTools(data.tools || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error("Failed to fetch tools:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateToolStatus(id: string, status: ToolStatus) {
    try {
      const response = await fetch(`/api/admin/tools/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        fetchTools();
      }
    } catch (error) {
      console.error("Failed to update tool:", error);
    }
  }

  async function deleteTool(id: string, name: string) {
    if (!confirm(`"${name}" 도구를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/tools/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchTools();
      }
    } catch (error) {
      console.error("Failed to delete tool:", error);
    }
  }

  const filteredTools = tools.filter((tool) => {
    if (filter === "all") return true;
    return tool.status === filter;
  });

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">도구 관리</h1>
          <p className="text-[12px] text-white/50 mt-0.5">사용자 제출 도구 검토 및 관리</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCrawlModal(true)}
            className="px-3 py-1.5 bg-blue-500/20 text-blue-400 text-[12px] font-medium rounded hover:bg-blue-500/30 transition-colors flex items-center gap-1.5"
          >
            <span>🔍</span> URL 크롤링
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-[var(--color-claude-coral)] text-white text-[12px] font-medium rounded hover:opacity-90 transition-colors"
          >
            + 도구 추가
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-2">
          <StatCard label="전체" value={stats.total} />
          <StatCard
            label="대기"
            value={stats.pending}
            accent="yellow"
            highlight={stats.pending > 0}
          />
          <StatCard label="승인" value={stats.approved} accent="emerald" />
          <StatCard label="특집" value={stats.featured} accent="purple" />
          <StatCard label="거부" value={stats.rejected} accent="red" />
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1.5">
        {(["all", "pending", "approved", "featured", "rejected"] as const).map((s) => (
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
            {s === "pending" && stats && stats.pending > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-yellow-500/30 text-yellow-400 text-[10px]">
                {stats.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tool List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredTools.length === 0 ? (
          <div className="text-center py-8 text-[12px] text-white/30">도구가 없습니다</div>
        ) : (
          filteredTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onEdit={() => setEditingTool(tool)}
              onStatusChange={updateToolStatus}
              onDelete={() => deleteTool(tool.id, tool.name)}
            />
          ))
        )}
      </div>

      {/* Edit Modal */}
      {editingTool && (
        <EditToolModal
          tool={editingTool}
          onClose={() => setEditingTool(null)}
          onSave={(updates) => {
            fetch(`/api/admin/tools/${editingTool.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updates),
            }).then(() => {
              setEditingTool(null);
              fetchTools();
            });
          }}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddToolModal
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false);
            fetchTools();
          }}
        />
      )}

      {/* Crawl Modal */}
      {showCrawlModal && (
        <CrawlToolModal
          onClose={() => setShowCrawlModal(false)}
          onComplete={() => {
            setShowCrawlModal(false);
            fetchTools();
          }}
        />
      )}
    </div>
  );
}

// =====================================================
// Stat Card Component
// =====================================================

function StatCard({
  label,
  value,
  accent,
  highlight,
}: {
  label: string;
  value: number;
  accent?: "yellow" | "emerald" | "purple" | "red";
  highlight?: boolean;
}) {
  const accentColors = {
    yellow: "text-yellow-400",
    emerald: "text-emerald-400",
    purple: "text-purple-400",
    red: "text-red-400",
  };

  return (
    <div
      className={`bg-[#161616] rounded-lg p-3 border border-white/[0.06] ${
        highlight ? "ring-1 ring-yellow-500/30" : ""
      }`}
    >
      <div className="text-[11px] text-white/50">{label}</div>
      <div className={`text-xl font-semibold ${accent ? accentColors[accent] : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

// =====================================================
// Tool Card Component
// =====================================================

function ToolCard({
  tool,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  tool: AdminToolListItem;
  onEdit: () => void;
  onStatusChange: (id: string, status: ToolStatus) => void;
  onDelete: () => void;
}) {
  const categoryMeta = CATEGORY_META[tool.category];
  const pricingMeta = PRICING_META[tool.pricing_type];

  return (
    <div className="bg-[#161616] rounded-lg p-3 border border-white/[0.06] hover:border-white/10 transition-colors">
      <div className="flex gap-3">
        {/* Logo */}
        <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
          {tool.logo_url ? (
            <Image src={tool.logo_url} alt={tool.name} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl">
              {categoryMeta.emoji}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] ${
                STATUS_STYLES[tool.status].bg
              } ${STATUS_STYLES[tool.status].text}`}
            >
              {STATUS_STYLES[tool.status].label}
            </span>
            {tool.status === "pending" && (
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] ${
                  PRIORITY_STYLES[tool.priority].bg
                } ${PRIORITY_STYLES[tool.priority].text}`}
                title="신뢰도 기반 우선순위"
              >
                우선순위: {PRIORITY_STYLES[tool.priority].label}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-white/50">
              {categoryMeta.emoji} {categoryMeta.label}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-white/40">
              {pricingMeta.label}
            </span>
          </div>

          {/* Title & Tagline */}
          <h4 className="text-[13px] text-white font-medium">{tool.name}</h4>
          <p className="text-[11px] text-white/40 line-clamp-1">{tool.tagline}</p>

          {/* Submitter Info */}
          {tool.submitter && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="text-[10px] text-white/30">제출자: {tool.submitter.username}</div>
              <span
                className={`px-1.5 py-0.5 rounded text-[8px] ${
                  getTrustTierStyle(tool.submitter.trust_tier).bg
                } ${getTrustTierStyle(tool.submitter.trust_tier).text}`}
              >
                {TRUST_TIER_META[tool.submitter.trust_tier].label}
              </span>
              <span className="text-[10px] text-white/30">
                Lv.{tool.submitter.current_level}
                {tool.submitter.global_rank && ` • #${tool.submitter.global_rank}`}
              </span>
            </div>
          )}

          {/* Meta Info */}
          <div className="text-[10px] text-white/30 mt-1">
            {tool.source === "admin" && "관리자 추가 • "}
            {tool.source === "automation" && "자동 수집 • "}
            {new Date(tool.created_at).toLocaleDateString("ko-KR")}
            {tool.upvote_count > 0 && ` • 👍 ${tool.upvote_count}`}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <a
              href={tool.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 text-[10px] bg-white/5 text-white/50 rounded hover:text-white/70 transition-colors"
            >
              방문
            </a>
            <button
              onClick={onEdit}
              className="px-2 py-1 text-[10px] bg-white/5 text-white/50 rounded hover:text-white/70 transition-colors"
            >
              수정
            </button>
            {tool.status === "pending" && (
              <>
                <button
                  onClick={() => onStatusChange(tool.id, "approved")}
                  className="px-2 py-1 text-[10px] bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors"
                >
                  승인
                </button>
                <button
                  onClick={() => onStatusChange(tool.id, "featured")}
                  className="px-2 py-1 text-[10px] bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 transition-colors"
                >
                  특집
                </button>
                <button
                  onClick={() => onStatusChange(tool.id, "rejected")}
                  className="px-2 py-1 text-[10px] bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                >
                  거부
                </button>
              </>
            )}
            {tool.status === "approved" && (
              <>
                <button
                  onClick={() => onStatusChange(tool.id, "featured")}
                  className="px-2 py-1 text-[10px] bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 transition-colors"
                >
                  특집 지정
                </button>
                <button
                  onClick={() => onStatusChange(tool.id, "rejected")}
                  className="px-2 py-1 text-[10px] bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                >
                  거부
                </button>
              </>
            )}
            {tool.status === "featured" && (
              <button
                onClick={() => onStatusChange(tool.id, "approved")}
                className="px-2 py-1 text-[10px] bg-white/10 text-white/50 rounded hover:bg-white/15 transition-colors"
              >
                특집 해제
              </button>
            )}
            {tool.status === "rejected" && (
              <button
                onClick={() => onStatusChange(tool.id, "approved")}
                className="px-2 py-1 text-[10px] bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors"
              >
                복구
              </button>
            )}
            <button
              onClick={onDelete}
              className="px-2 py-1 text-[10px] bg-red-500/10 text-red-400/70 rounded hover:bg-red-500/20 transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Trust Tier Styles
// =====================================================

function getTrustTierStyle(tier: TrustTier) {
  const styles: Record<TrustTier, { bg: string; text: string }> = {
    elite: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
    power_user: { bg: "bg-purple-500/20", text: "text-purple-400" },
    verified: { bg: "bg-blue-500/20", text: "text-blue-400" },
    member: { bg: "bg-gray-500/20", text: "text-gray-400" },
  };
  return styles[tier];
}

// =====================================================
// Edit Modal
// =====================================================

function EditToolModal({
  tool,
  onClose,
  onSave,
}: {
  tool: AdminToolListItem;
  onClose: () => void;
  onSave: (updates: Partial<AdminToolListItem>) => void;
}) {
  const [name, setName] = useState(tool.name);
  const [tagline, setTagline] = useState(tool.tagline);
  const [description, setDescription] = useState(tool.description || "");
  const [category, setCategory] = useState<ToolCategory>(tool.category);
  const [pricingType, setPricingType] = useState<ToolPricingType>(tool.pricing_type);
  const [logoUrl, setLogoUrl] = useState(tool.logo_url || "");
  const [tags, setTags] = useState(tool.tags?.join(", ") || "");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          setIsUploading(true);
          setUploadError(null);

          try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("toolSlug", tool.slug || "");

            const response = await fetch("/api/admin/tools/logo", {
              method: "POST",
              body: formData,
            });

            const data = await response.json();

            if (data.success) {
              setLogoUrl(data.url);
            } else {
              setUploadError(data.error || "업로드 실패");
            }
          } catch {
            setUploadError("업로드 중 오류가 발생했습니다");
          } finally {
            setIsUploading(false);
          }
          break;
        }
      }
    },
    [tool.slug]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleSave = () => {
    onSave({
      name: name.trim(),
      tagline: tagline.trim(),
      description: description.trim() || undefined,
      category,
      pricing_type: pricingType,
      logo_url: logoUrl.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161616] rounded-lg w-full max-w-xl max-h-[85vh] overflow-y-auto border border-white/[0.06]">
        <div className="p-4 border-b border-white/[0.06]">
          <h3 className="text-[14px] font-semibold text-white">도구 수정</h3>
        </div>

        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20"
            />
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">한 줄 설명</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ToolCategory)}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
            >
              {TOOL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                </option>
              ))}
            </select>
          </div>

          {/* Pricing Type */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">가격 유형</label>
            <select
              value={pricingType}
              onChange={(e) => setPricingType(e.target.value as ToolPricingType)}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
            >
              {TOOL_PRICING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PRICING_META[type].label}
                </option>
              ))}
            </select>
          </div>

          {/* Logo */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">
              로고 <span className="text-white/30">(이미지를 복사 후 Ctrl+V)</span>
            </label>
            <div className="flex gap-3 items-start">
              {/* Logo Preview / Paste Area */}
              <div
                className={`
                  relative w-20 h-20 rounded-lg border-2 border-dashed overflow-hidden flex-shrink-0
                  ${isUploading ? "border-[var(--color-claude-coral)] bg-[var(--color-claude-coral)]/10" : "border-white/20 bg-white/5"}
                  ${!logoUrl && !isUploading ? "flex items-center justify-center" : ""}
                `}
              >
                {isUploading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-claude-coral)]" />
                  </div>
                ) : logoUrl ? (
                  <>
                    <Image
                      src={logoUrl}
                      alt="Logo"
                      fill
                      className="object-contain p-1"
                      unoptimized
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setLogoUrl("")}
                      className="absolute top-1 right-1 p-1 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </>
                ) : (
                  <div className="text-center p-2">
                    <Clipboard className="w-5 h-5 text-white/30 mx-auto mb-1" />
                    <span className="text-[9px] text-white/30">Ctrl+V</span>
                  </div>
                )}
              </div>

              {/* URL Input */}
              <div className="flex-1 space-y-2">
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 placeholder:text-white/20"
                />
                {uploadError && <p className="text-[11px] text-red-400">{uploadError}</p>}
                <p className="text-[10px] text-white/30">
                  이미지를 복사하고 이 창에서 Ctrl+V를 누르세요
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">상세 설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">
              태그 (쉼표로 구분)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="claude, ai, coding"
              className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 placeholder:text-white/20"
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

// =====================================================
// Add Modal
// =====================================================

function AddToolModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ToolCategory>("ai-coding");
  const [pricingType, setPricingType] = useState<ToolPricingType>("free");
  const [logoUrl, setLogoUrl] = useState("");
  const [status, setStatus] = useState<"approved" | "featured">("approved");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || !websiteUrl.trim() || !tagline.trim()) {
      setError("이름, URL, 한 줄 설명은 필수입니다");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          website_url: websiteUrl.trim(),
          tagline: tagline.trim(),
          description: description.trim() || undefined,
          category,
          pricing_type: pricingType,
          logo_url: logoUrl.trim() || undefined,
          status,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add tool");
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161616] rounded-lg w-full max-w-xl max-h-[85vh] overflow-y-auto border border-white/[0.06]">
        <div className="p-4 border-b border-white/[0.06]">
          <h3 className="text-[14px] font-semibold text-white">도구 추가</h3>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-[12px] text-red-400">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">
              이름 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: Cursor, Supabase"
              className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 placeholder:text-white/20"
            />
          </div>

          {/* Website URL */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">
              웹사이트 URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 placeholder:text-white/20"
            />
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">
              한 줄 설명 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="이 도구가 무엇인지 간단히 설명"
              className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 placeholder:text-white/20"
            />
          </div>

          {/* Category & Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ToolCategory)}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
              >
                {TOOL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                가격 유형
              </label>
              <select
                value={pricingType}
                onChange={(e) => setPricingType(e.target.value as ToolPricingType)}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
              >
                {TOOL_PRICING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PRICING_META[type].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">상태</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatus("approved")}
                className={`flex-1 px-3 py-2 rounded text-[12px] transition-colors ${
                  status === "approved"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/5 text-white/50 border border-white/[0.06]"
                }`}
              >
                승인
              </button>
              <button
                type="button"
                onClick={() => setStatus("featured")}
                className={`flex-1 px-3 py-2 rounded text-[12px] transition-colors ${
                  status === "featured"
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    : "bg-white/5 text-white/50 border border-white/[0.06]"
                }`}
              >
                특집
              </button>
            </div>
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">로고 URL</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 placeholder:text-white/20"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">상세 설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="도구에 대한 상세 설명 (선택)"
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
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-[var(--color-claude-coral)] text-white rounded text-[12px] hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && (
              <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
            )}
            추가
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Crawl Modal
// =====================================================

interface CrawlResult {
  success: boolean;
  saved: number;
  duplicates: number;
  failed: number;
  tools: Array<{ id: string; name: string; tagline: string }>;
  duplicateDetails: Array<{ name: string; existing: string }>;
  errors: Array<{ name: string; error: string }>;
  crawlStats: {
    totalFound: number;
    successfullyParsed: number;
    failed: number;
    tokensUsed: number;
    costUsd: number;
  };
}

function CrawlToolModal({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"listing" | "single">("listing");
  const [crawling, setCrawling] = useState(false);
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCrawl = async () => {
    if (!url.trim()) {
      setError("URL을 입력해주세요");
      return;
    }

    // Validate URL
    try {
      new URL(url.trim());
    } catch {
      setError("올바른 URL 형식이 아닙니다");
      return;
    }

    setCrawling(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/tools/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), mode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "크롤링에 실패했습니다");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setCrawling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161616] rounded-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-white/[0.06]">
        <div className="p-4 border-b border-white/[0.06]">
          <h3 className="text-[14px] font-semibold text-white">🔍 URL 크롤링</h3>
          <p className="text-[11px] text-white/40 mt-1">
            도구 리스트 페이지 또는 개별 도구 웹사이트에서 정보를 자동으로 추출합니다
          </p>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-[12px] text-red-400">
              {error}
            </div>
          )}

          {/* Mode Selection */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">
              크롤링 모드
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("listing")}
                disabled={crawling}
                className={`flex-1 px-3 py-2 rounded text-[12px] transition-colors ${
                  mode === "listing"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-white/5 text-white/50 border border-white/[0.06]"
                }`}
              >
                <div className="font-medium">📋 리스트 페이지</div>
                <div className="text-[10px] mt-0.5 opacity-70">
                  여러 도구가 있는 디렉토리 페이지
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("single")}
                disabled={crawling}
                className={`flex-1 px-3 py-2 rounded text-[12px] transition-colors ${
                  mode === "single"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-white/5 text-white/50 border border-white/[0.06]"
                }`}
              >
                <div className="font-medium">🔗 단일 도구</div>
                <div className="text-[10px] mt-0.5 opacity-70">도구 공식 웹사이트 직접 분석</div>
              </button>
            </div>
          </div>

          {/* URL Input */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">
              {mode === "listing" ? "도구 리스트 페이지 URL" : "도구 웹사이트 URL"}
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                mode === "listing"
                  ? "예: https://futurepedia.io, https://aitools.fyi"
                  : "예: https://cursor.sh, https://supabase.com"
              }
              disabled={crawling}
              className="w-full px-3 py-2 bg-white/5 border border-white/[0.06] rounded text-[13px] text-white focus:outline-none focus:border-white/20 placeholder:text-white/20 disabled:opacity-50"
            />
            <p className="text-[10px] text-white/30 mt-1.5">
              {mode === "listing"
                ? "페이지에서 도구 링크를 추출하고 각 도구 웹사이트를 방문해 정보를 분석합니다"
                : "해당 웹사이트를 직접 분석하여 도구 정보를 추출합니다"}
            </p>
          </div>

          {/* Crawl Button */}
          {!result && (
            <button
              onClick={handleCrawl}
              disabled={crawling || !url.trim()}
              className="w-full px-4 py-2.5 bg-blue-500 text-white rounded text-[13px] font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {crawling ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>크롤링 중... (시간이 걸릴 수 있습니다)</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>크롤링 시작</span>
                </>
              )}
            </button>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white/5 rounded p-2 text-center">
                  <div className="text-lg font-semibold text-white">
                    {result.crawlStats.totalFound}
                  </div>
                  <div className="text-[10px] text-white/50">발견</div>
                </div>
                <div className="bg-emerald-500/10 rounded p-2 text-center">
                  <div className="text-lg font-semibold text-emerald-400">{result.saved}</div>
                  <div className="text-[10px] text-white/50">저장됨</div>
                </div>
                <div className="bg-yellow-500/10 rounded p-2 text-center">
                  <div className="text-lg font-semibold text-yellow-400">{result.duplicates}</div>
                  <div className="text-[10px] text-white/50">중복</div>
                </div>
                <div className="bg-red-500/10 rounded p-2 text-center">
                  <div className="text-lg font-semibold text-red-400">{result.failed}</div>
                  <div className="text-[10px] text-white/50">실패</div>
                </div>
              </div>

              {/* Cost */}
              <div className="text-[11px] text-white/40 text-center">
                Gemini API 사용량: {result.crawlStats.tokensUsed.toLocaleString()} 토큰 (≈ $
                {result.crawlStats.costUsd.toFixed(4)})
              </div>

              {/* Saved Tools */}
              {result.tools.length > 0 && (
                <div className="bg-emerald-500/5 rounded p-3 border border-emerald-500/10">
                  <div className="text-[11px] font-medium text-emerald-400 mb-2">
                    ✅ 저장된 도구 ({result.tools.length})
                  </div>
                  <div className="space-y-1">
                    {result.tools.map((tool) => (
                      <div key={tool.id} className="text-[12px] text-white/70">
                        <span className="font-medium text-white">{tool.name}</span>
                        <span className="text-white/40"> - {tool.tagline}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Duplicates */}
              {result.duplicateDetails.length > 0 && (
                <div className="bg-yellow-500/5 rounded p-3 border border-yellow-500/10">
                  <div className="text-[11px] font-medium text-yellow-400 mb-2">
                    ⚠️ 중복된 도구 ({result.duplicateDetails.length})
                  </div>
                  <div className="space-y-1">
                    {result.duplicateDetails.map((dup, i) => (
                      <div key={i} className="text-[12px] text-white/50">
                        {dup.name} (기존: {dup.existing})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="bg-red-500/5 rounded p-3 border border-red-500/10">
                  <div className="text-[11px] font-medium text-red-400 mb-2">
                    ❌ 실패 ({result.errors.length})
                  </div>
                  <div className="space-y-1">
                    {result.errors.map((err, i) => (
                      <div key={i} className="text-[12px] text-white/50">
                        {err.name}: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/[0.06] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 text-white/70 rounded text-[12px] hover:bg-white/10 transition-colors"
          >
            {result ? "닫기" : "취소"}
          </button>
          {result && result.saved > 0 && (
            <button
              onClick={onComplete}
              className="px-4 py-2 bg-[var(--color-claude-coral)] text-white rounded text-[12px] hover:opacity-90 transition-colors"
            >
              목록 새로고침
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
