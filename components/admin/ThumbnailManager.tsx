"use client";

import { useState } from "react";
import Image from "next/image";
import type { ThumbnailSource } from "@/types/automation";

interface ThumbnailManagerProps {
  contentId: string;
  currentThumbnail?: string;
  thumbnailSource?: ThumbnailSource;
  title: string;
  summary?: string;
  onThumbnailUpdate: (thumbnailUrl: string, source: ThumbnailSource) => void;
}

const SOURCE_LABELS: Record<ThumbnailSource, { label: string; color: string }> = {
  gemini: { label: "AI 생성", color: "bg-purple-500/20 text-purple-400" },
  og_image: { label: "OG 이미지", color: "bg-blue-500/20 text-blue-400" },
  manual: { label: "수동 업로드", color: "bg-green-500/20 text-green-400" },
  default: { label: "기본 이미지", color: "bg-gray-500/20 text-gray-400" },
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
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Gemini로 썸네일 생성
  async function generateWithGemini() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/thumbnail/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_id: contentId,
          title,
          summary,
          force_regenerate: true,
        }),
      });

      const data = await response.json();

      if (response.ok && data.thumbnail_url) {
        onThumbnailUpdate(data.thumbnail_url, "gemini");
      } else {
        setError(data.error || "썸네일 생성에 실패했습니다.");
      }
    } catch (err) {
      setError("네트워크 오류가 발생했습니다.");
      console.error("Thumbnail generation error:", err);
    } finally {
      setLoading(false);
    }
  }

  // OG Image 가져오기
  async function fetchOgImage() {
    setLoading(true);
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
    }
  }

  // 수동 URL 입력
  function applyManualUrl() {
    if (!manualUrl.trim()) return;

    // Basic URL validation
    try {
      new URL(manualUrl);
      onThumbnailUpdate(manualUrl.trim(), "manual");
      setManualUrl("");
      setShowUrlInput(false);
    } catch {
      setError("유효한 URL을 입력해주세요.");
    }
  }

  // 썸네일 삭제
  function removeThumbnail() {
    onThumbnailUpdate("", "default");
  }

  return (
    <div className="space-y-4">
      {/* Current Thumbnail Preview */}
      <div className="flex items-start gap-4">
        <div className="relative w-48 h-28 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
          {currentThumbnail ? (
            <Image
              src={currentThumbnail}
              alt="썸네일 미리보기"
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30">
              <span className="text-4xl">🖼️</span>
            </div>
          )}
        </div>

        <div className="flex-1">
          {/* Source Badge */}
          {thumbnailSource && (
            <div className="mb-2">
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${SOURCE_LABELS[thumbnailSource].color}`}
              >
                {SOURCE_LABELS[thumbnailSource].label}
              </span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={generateWithGemini}
              disabled={loading}
              className="px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <span className="animate-spin">⏳</span> : <span>✨</span>}
              AI 생성
            </button>

            <button
              onClick={fetchOgImage}
              disabled={loading}
              className="px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <span className="animate-spin">⏳</span> : <span>🔗</span>}
              OG 이미지
            </button>

            <button
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="px-3 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors flex items-center gap-2"
            >
              <span>📎</span>
              URL 입력
            </button>

            {currentThumbnail && (
              <button
                onClick={removeThumbnail}
                className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors flex items-center gap-2"
              >
                <span>🗑️</span>
                삭제
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Manual URL Input */}
      {showUrlInput && (
        <div className="flex gap-2">
          <input
            type="url"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={applyManualUrl}
            disabled={!manualUrl.trim()}
            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            적용
          </button>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-white/40 space-y-1">
        <p>
          💡 <strong>AI 생성</strong>: Gemini로 기사 내용 기반 썸네일을 자동 생성합니다.
        </p>
        <p>
          💡 <strong>OG 이미지</strong>: 원본 사이트에서 Open Graph 이미지를 가져옵니다.
        </p>
        <p>
          💡 <strong>URL 입력</strong>: 직접 이미지 URL을 입력합니다.
        </p>
      </div>
    </div>
  );
}
