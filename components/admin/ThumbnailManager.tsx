"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Sparkles,
  Image as ImageIcon,
  Trash2,
  Loader2,
  Wand2,
  History,
  Check,
  ChevronUp,
  X,
  Zap,
} from "lucide-react";
import type { ThumbnailSource } from "@/types/automation";

interface ThumbnailManagerProps {
  contentId: string;
  currentThumbnail?: string;
  thumbnailSource?: ThumbnailSource;
  title: string;
  summary?: string;
  onThumbnailUpdate: (thumbnailUrl: string, source: ThumbnailSource) => void;
}

interface ThumbnailHistoryItem {
  id: string;
  name: string;
  url: string;
  created_at: string;
  size?: number;
  isCurrentContent?: boolean;
}

const SOURCE_LABELS: Record<ThumbnailSource, { label: string; color: string }> = {
  gemini: { label: "Gemini Pro", color: "bg-purple-500/20 text-purple-400" },
  imagen: { label: "Imagen 3", color: "bg-pink-500/20 text-pink-400" },
  gemini_flash: { label: "Gemini Flash", color: "bg-amber-500/20 text-amber-400" },
  og_image: { label: "OG 이미지", color: "bg-blue-500/20 text-blue-400" },
  manual: { label: "수동 입력", color: "bg-green-500/20 text-green-400" },
  default: { label: "기본", color: "bg-gray-500/20 text-gray-400" },
};

export default function ThumbnailManager({
  contentId,
  currentThumbnail,
  thumbnailSource,
  title,
  summary,
  onThumbnailUpdate,
}: ThumbnailManagerProps) {
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<"gemini" | "og" | "fusion" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Model selection state
  const [useImagen, setUseImagen] = useState(true);
  const [useGeminiFlash, setUseGeminiFlash] = useState(false);
  const [showModelSettings, setShowModelSettings] = useState(false);

  // Dual generation results
  const [dualResults, setDualResults] = useState<{
    imagen?: { url: string; success: boolean; error?: string };
    gemini_flash?: { url: string; success: boolean; error?: string };
  } | null>(null);

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ThumbnailHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch thumbnail history - shows ALL unused images across all contents
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      // Fetch all unused thumbnails
      const response = await fetch(`/api/admin/thumbnail/history?unused=true`);
      const data = await response.json();

      if (data.success) {
        // Map to include isCurrentContent flag for visual distinction
        const allUnused = (data.unusedThumbnails || []).map(
          (item: ThumbnailHistoryItem & { contentId?: string }) => ({
            ...item,
            isCurrentContent: item.contentId === contentId,
          })
        );
        setHistory(allUnused);
      }
    } catch (err) {
      console.error("Failed to fetch thumbnail history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [contentId]);

  // Load history when expanded
  useEffect(() => {
    if (showHistory) {
      fetchHistory();
    }
  }, [showHistory, fetchHistory]);

  // Delete a thumbnail from history
  async function deleteFromHistory(item: ThumbnailHistoryItem) {
    if (!confirm(`이 썸네일을 삭제하시겠습니까?\n\n삭제된 이미지는 복구할 수 없습니다.`)) {
      return;
    }

    setDeletingId(item.id);
    try {
      const response = await fetch("/api/admin/thumbnail/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: item.name,
          // Don't pass content_id to allow deletion of any unused image
        }),
      });

      if (response.ok) {
        // Remove from local state
        setHistory((prev) => prev.filter((h) => h.id !== item.id));

        // If this was the current thumbnail, clear it
        if (currentThumbnail === item.url) {
          onThumbnailUpdate("", "default");
        }
      } else {
        setError("삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error("Failed to delete thumbnail:", err);
      setError("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  // Select a thumbnail from history
  function selectFromHistory(item: ThumbnailHistoryItem) {
    onThumbnailUpdate(item.url, "gemini");
  }

  async function generateWithGemini() {
    if (!useImagen && !useGeminiFlash) {
      setError("최소 하나의 모델을 선택해주세요.");
      return;
    }

    setLoading(true);
    setLoadingType("gemini");
    setError(null);
    setDualResults(null);

    try {
      // Determine generation mode
      const isDual = useImagen && useGeminiFlash;
      const model = isDual ? "dual" : useImagen ? "imagen" : "gemini_flash";

      const response = await fetch("/api/admin/thumbnail/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_id: contentId,
          title,
          summary,
          force_regenerate: true,
          model, // "imagen" | "gemini_flash" | "dual"
        }),
      });

      const data = await response.json();

      if (isDual && data.dual_results) {
        // Show dual results for selection
        setDualResults({
          imagen: data.dual_results.imagen,
          gemini_flash: data.dual_results.gemini_flash,
        });
      } else if (response.ok && data.thumbnail_url) {
        onThumbnailUpdate(data.thumbnail_url, data.source || "gemini");
        // Refresh history after generation
        if (showHistory) fetchHistory();
      } else {
        setError(data.error || "썸네일 생성에 실패했습니다.");
      }
    } catch (err) {
      setError("네트워크 오류가 발생했습니다.");
      console.error("Thumbnail generation error:", err);
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  }

  function selectDualResult(type: "imagen" | "gemini_flash") {
    const result = dualResults?.[type];
    if (result?.url) {
      onThumbnailUpdate(result.url, type === "imagen" ? "gemini" : "gemini");
      setDualResults(null);
      if (showHistory) fetchHistory();
    }
  }

  async function fetchOgImage() {
    setLoading(true);
    setLoadingType("og");
    setError(null);

    try {
      const response = await fetch("/api/admin/thumbnail/og-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_id: contentId }),
      });

      const data = await response.json();

      if (response.ok && data.thumbnail_url) {
        onThumbnailUpdate(data.thumbnail_url, "og_image");
      } else {
        setError(data.error || "OG 이미지를 찾을 수 없습니다.");
      }
    } catch (err) {
      setError("네트워크 오류가 발생했습니다.");
      console.error("OG image fetch error:", err);
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  }

  async function generateWithOgFusion() {
    setLoading(true);
    setLoadingType("fusion");
    setError(null);

    try {
      const ogResponse = await fetch("/api/admin/thumbnail/og-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_id: contentId }),
      });

      const ogData = await ogResponse.json();

      if (!ogResponse.ok || !ogData.thumbnail_url) {
        setError("OG 이미지를 찾을 수 없습니다. AI 생성을 대신 사용해주세요.");
        setLoading(false);
        setLoadingType(null);
        return;
      }

      const response = await fetch("/api/admin/thumbnail/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_id: contentId,
          title,
          summary,
          force_regenerate: true,
          og_image_url: ogData.thumbnail_url,
        }),
      });

      const data = await response.json();

      if (response.ok && data.thumbnail_url) {
        onThumbnailUpdate(data.thumbnail_url, "gemini");
        // Refresh history after generation
        if (showHistory) fetchHistory();
      } else {
        setError(data.error || "OG+AI 융합 썸네일 생성에 실패했습니다.");
      }
    } catch (err) {
      setError("네트워크 오류가 발생했습니다.");
      console.error("OG+AI fusion error:", err);
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  }

  function removeThumbnail() {
    onThumbnailUpdate("", "default");
  }

  const IconButton = ({
    onClick,
    disabled,
    isLoading,
    icon: Icon,
    label,
    variant = "default",
    recommended,
    active,
  }: {
    onClick: () => void;
    disabled?: boolean;
    isLoading?: boolean;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    variant?: "default" | "primary" | "danger" | "success" | "history";
    recommended?: boolean;
    active?: boolean;
  }) => {
    const variants = {
      default: "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border-white/10",
      primary:
        "bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 hover:from-purple-500/30 hover:to-blue-500/30 border-purple-500/30",
      danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20",
      success: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20",
      history: active
        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
        : "bg-white/5 text-white/70 hover:bg-amber-500/10 hover:text-amber-400 border-white/10",
    };

    return (
      <button
        onClick={onClick}
        disabled={disabled || isLoading}
        className={`
          relative px-3 py-2 rounded-md text-[11px] font-medium
          border transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center gap-1.5
          ${variants[variant]}
        `}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Icon className="w-3.5 h-3.5" />
        )}
        <span>{label}</span>
        {recommended && (
          <span className="ml-1 px-1 py-0.5 text-[8px] bg-amber-500/20 text-amber-400 rounded">
            권장
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {/* Thumbnail Preview & Actions */}
      <div className="flex gap-4">
        {/* Preview */}
        <div className="relative w-40 h-24 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex-shrink-0">
          {currentThumbnail ? (
            <Image src={currentThumbnail} alt="썸네일" fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20">
              <ImageIcon className="w-8 h-8" />
            </div>
          )}
          {thumbnailSource && (
            <div className="absolute top-1.5 left-1.5">
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${SOURCE_LABELS[thumbnailSource].color}`}
              >
                {SOURCE_LABELS[thumbnailSource].label}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex-1 space-y-2">
          {/* Primary Actions */}
          <div className="flex flex-wrap gap-1.5">
            <IconButton
              onClick={generateWithGemini}
              disabled={loading}
              isLoading={loadingType === "gemini"}
              icon={Sparkles}
              label="AI 생성"
            />
            <IconButton
              onClick={generateWithOgFusion}
              disabled={loading}
              isLoading={loadingType === "fusion"}
              icon={Wand2}
              label="OG+AI"
              variant="primary"
              recommended
            />
            <IconButton
              onClick={fetchOgImage}
              disabled={loading}
              isLoading={loadingType === "og"}
              icon={ImageIcon}
              label="OG 이미지"
            />
            <IconButton
              onClick={() => setShowHistory(!showHistory)}
              icon={History}
              label="히스토리"
              variant="history"
              active={showHistory}
            />
            {currentThumbnail && (
              <IconButton onClick={removeThumbnail} icon={Trash2} label="삭제" variant="danger" />
            )}
          </div>

          {/* Model Selection & Help */}
          <div className="flex items-center gap-3">
            {/* Model Selection Toggle */}
            <button
              onClick={() => setShowModelSettings(!showModelSettings)}
              className={`
                flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors
                ${
                  showModelSettings
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    : "text-white/40 hover:text-white/60"
                }
              `}
            >
              <Zap className="w-3 h-3" />
              모델 설정
              {useImagen && useGeminiFlash && (
                <span className="ml-1 px-1 py-0.5 bg-amber-500/20 text-amber-400 text-[8px] rounded">
                  듀얼
                </span>
              )}
            </button>
            {/* Help Text */}
            <div className="text-[10px] text-white/40">
              <span className="text-purple-400">AI</span>: 제목 기반 •{" "}
              <span className="text-cyan-400">OG+AI</span>: 분석 후 생성
            </div>
          </div>

          {/* Model Selection Panel */}
          {showModelSettings && (
            <div className="flex items-center gap-4 p-2 bg-black/30 rounded-lg border border-white/10">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useImagen}
                  onChange={(e) => setUseImagen(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
                />
                <span className="text-[11px] text-white/70">Imagen 4</span>
                <span className="text-[9px] text-white/40">($0.04)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useGeminiFlash}
                  onChange={(e) => setUseGeminiFlash(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
                />
                <span className="text-[11px] text-white/70">Gemini Flash</span>
                <span className="text-[9px] text-white/40">($0.039)</span>
              </label>
              {useImagen && useGeminiFlash && (
                <span className="text-[10px] text-amber-400">→ 두 모델로 동시 생성 후 선택</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-md text-[11px] text-red-400">
          {error}
        </div>
      )}

      {/* Dual Generation Results */}
      {dualResults && (
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-[11px] font-medium text-white/70">
              <Sparkles className="w-3.5 h-3.5 inline mr-1" />
              생성된 이미지 선택
            </span>
            <button
              onClick={() => setDualResults(null)}
              className="p-1 text-white/40 hover:text-white/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 grid grid-cols-2 gap-3">
            {/* Imagen Result */}
            <div
              className={`rounded-lg overflow-hidden border-2 transition-all ${
                dualResults.imagen?.success
                  ? "border-purple-500/30 hover:border-purple-500/60"
                  : "border-red-500/30"
              }`}
            >
              <div className="px-2 py-1 bg-purple-500/10 text-[10px] font-medium text-purple-400 flex items-center justify-between">
                <span>Imagen 4</span>
                {dualResults.imagen?.success ? (
                  <span className="text-emerald-400">✓ 성공</span>
                ) : (
                  <span className="text-red-400">✗ 실패</span>
                )}
              </div>
              {dualResults.imagen?.success && dualResults.imagen.url ? (
                <button
                  onClick={() => selectDualResult("imagen")}
                  className="relative w-full aspect-video bg-black/40 group"
                >
                  <Image
                    src={dualResults.imagen.url}
                    alt="Imagen 생성"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="px-2 py-1 bg-purple-500 text-white text-[10px] rounded font-medium">
                      선택
                    </span>
                  </div>
                </button>
              ) : (
                <div className="aspect-video bg-black/40 flex items-center justify-center">
                  <span className="text-[10px] text-red-400 text-center px-2">
                    {dualResults.imagen?.error || "생성 실패"}
                  </span>
                </div>
              )}
            </div>

            {/* Gemini Flash Result */}
            <div
              className={`rounded-lg overflow-hidden border-2 transition-all ${
                dualResults.gemini_flash?.success
                  ? "border-blue-500/30 hover:border-blue-500/60"
                  : "border-red-500/30"
              }`}
            >
              <div className="px-2 py-1 bg-blue-500/10 text-[10px] font-medium text-blue-400 flex items-center justify-between">
                <span>Gemini Flash</span>
                {dualResults.gemini_flash?.success ? (
                  <span className="text-emerald-400">✓ 성공</span>
                ) : (
                  <span className="text-red-400">✗ 실패</span>
                )}
              </div>
              {dualResults.gemini_flash?.success && dualResults.gemini_flash.url ? (
                <button
                  onClick={() => selectDualResult("gemini_flash")}
                  className="relative w-full aspect-video bg-black/40 group"
                >
                  <Image
                    src={dualResults.gemini_flash.url}
                    alt="Gemini Flash 생성"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="px-2 py-1 bg-blue-500 text-white text-[10px] rounded font-medium">
                      선택
                    </span>
                  </div>
                </button>
              ) : (
                <div className="aspect-video bg-black/40 flex items-center justify-center">
                  <span className="text-[10px] text-red-400 text-center px-2">
                    {dualResults.gemini_flash?.error || "생성 실패"}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="px-3 py-2 border-t border-white/10 text-[10px] text-white/40 text-center">
            이미지를 클릭하여 선택하세요 • 선택하지 않은 이미지는 히스토리에 저장됩니다
          </div>
        </div>
      )}

      {/* Thumbnail History Panel */}
      {showHistory && (
        <div className="bg-black/30 border border-white/10 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-[11px] font-medium text-white/70">
              미사용 이미지 ({history.length}개)
            </span>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 text-white/40 hover:text-white/70 transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          {loadingHistory ? (
            <div className="p-4 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-white/40" />
            </div>
          ) : history.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-white/40">
              미사용 썸네일이 없습니다.
            </div>
          ) : (
            <div className="p-2 grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
              {history.map((item) => {
                const isSelected = currentThumbnail === item.url;
                const isDeleting = deletingId === item.id;
                const isFromCurrentContent = item.isCurrentContent;

                return (
                  <div
                    key={item.id}
                    className={`
                      relative group rounded-md overflow-hidden border-2 transition-all
                      ${
                        isSelected
                          ? "border-emerald-500"
                          : isFromCurrentContent
                            ? "border-purple-500/50 hover:border-purple-500"
                            : "border-transparent hover:border-white/20"
                      }
                    `}
                  >
                    {/* Thumbnail Image */}
                    <div className="relative aspect-video bg-black/40">
                      <Image
                        src={item.url}
                        alt="썸네일"
                        fill
                        className="object-cover"
                        unoptimized
                      />

                      {/* Badges */}
                      <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                        {isSelected && (
                          <span className="flex items-center gap-0.5 px-1 py-0.5 bg-emerald-500 text-white text-[8px] rounded">
                            <Check className="w-2.5 h-2.5" /> 사용중
                          </span>
                        )}
                        {isFromCurrentContent && !isSelected && (
                          <span className="px-1 py-0.5 bg-purple-500/80 text-white text-[7px] rounded">
                            현재글
                          </span>
                        )}
                      </div>

                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        {!isSelected && (
                          <button
                            onClick={() => selectFromHistory(item)}
                            className="p-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors"
                            title="이 썸네일 사용"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteFromHistory(item)}
                          disabled={isDeleting}
                          className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                          title="삭제"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="px-1 py-0.5 bg-black/60 text-[8px] text-white/50 text-center">
                      {new Date(item.created_at).toLocaleString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
