"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Trash2, Loader2, RefreshCw, ImageOff, CheckSquare, Square } from "lucide-react";

interface UnusedThumbnail {
  id: string;
  name: string;
  url: string;
  created_at: string;
  size?: number;
  contentId?: string;
}

export default function UnusedThumbnailManager() {
  const [thumbnails, setThumbnails] = useState<UnusedThumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<{ usedCount: number; total: number }>({
    usedCount: 0,
    total: 0,
  });

  const fetchUnusedThumbnails = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/thumbnail/history?unused=true");
      const data = await response.json();

      if (data.success) {
        setThumbnails(data.unusedThumbnails || []);
        setStats({
          usedCount: data.usedCount || 0,
          total: (data.unusedThumbnails?.length || 0) + (data.usedCount || 0),
        });
      }
    } catch (error) {
      console.error("Failed to fetch unused thumbnails:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnusedThumbnails();
  }, [fetchUnusedThumbnails]);

  async function deleteThumbnail(item: UnusedThumbnail) {
    if (
      !confirm(
        `이 썸네일을 삭제하시겠습니까?\n\n파일명: ${item.name}\n\n삭제된 이미지는 복구할 수 없습니다.`
      )
    ) {
      return;
    }

    setDeleting((prev) => new Set(prev).add(item.id));
    try {
      const response = await fetch("/api/admin/thumbnail/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: item.name }),
      });

      if (response.ok) {
        setThumbnails((prev) => prev.filter((t) => t.id !== item.id));
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    } catch (error) {
      console.error("Failed to delete thumbnail:", error);
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;

    if (
      !confirm(
        `선택한 ${selected.size}개의 썸네일을 삭제하시겠습니까?\n\n삭제된 이미지는 복구할 수 없습니다.`
      )
    ) {
      return;
    }

    const filesToDelete = thumbnails.filter((t) => selected.has(t.id)).map((t) => t.name);

    setDeleting(selected);
    try {
      const response = await fetch("/api/admin/thumbnail/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_names: filesToDelete }),
      });

      if (response.ok) {
        setThumbnails((prev) => prev.filter((t) => !selected.has(t.id)));
        setSelected(new Set());
      }
    } catch (error) {
      console.error("Failed to delete thumbnails:", error);
    } finally {
      setDeleting(new Set());
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    if (selected.size === thumbnails.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(thumbnails.map((t) => t.id)));
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">미사용 썸네일 관리</h3>
          <p className="text-sm text-white/50">
            스토리지에 저장되어 있지만 현재 사용되지 않는 썸네일입니다.
          </p>
        </div>
        <button
          onClick={fetchUnusedThumbnails}
          disabled={loading}
          className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-sm text-white/50">전체 썸네일</div>
        </div>
        <div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/20">
          <div className="text-2xl font-bold text-emerald-400">{stats.usedCount}</div>
          <div className="text-sm text-emerald-400/70">사용 중</div>
        </div>
        <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/20">
          <div className="text-2xl font-bold text-amber-400">{thumbnails.length}</div>
          <div className="text-sm text-amber-400/70">미사용 (삭제 가능)</div>
        </div>
      </div>

      {/* Actions Bar */}
      {thumbnails.length > 0 && (
        <div className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/10">
          <button
            onClick={selectAll}
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            {selected.size === thumbnails.length ? (
              <CheckSquare className="w-4 h-4 text-emerald-400" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {selected.size === thumbnails.length ? "전체 선택 해제" : "전체 선택"}
          </button>
          {selected.size > 0 && (
            <button
              onClick={deleteSelected}
              disabled={deleting.size > 0}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              선택 삭제 ({selected.size}개)
            </button>
          )}
        </div>
      )}

      {/* Thumbnail Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-white/40" />
        </div>
      ) : thumbnails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-white/40">
          <ImageOff className="w-12 h-12 mb-3" />
          <p className="text-lg font-medium">미사용 썸네일이 없습니다</p>
          <p className="text-sm">모든 썸네일이 사용 중이거나 이미 정리되었습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {thumbnails.map((item) => {
            const isSelected = selected.has(item.id);
            const isDeleting = deleting.has(item.id);

            return (
              <div
                key={item.id}
                className={`
                  relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer
                  ${isSelected ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-white/10 hover:border-white/20"}
                  ${isDeleting ? "opacity-50" : ""}
                `}
                onClick={() => !isDeleting && toggleSelect(item.id)}
              >
                {/* Selection Checkbox */}
                <div className="absolute top-2 left-2 z-10">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-emerald-400 drop-shadow-lg" />
                  ) : (
                    <Square className="w-5 h-5 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  )}
                </div>

                {/* Thumbnail Image */}
                <div className="relative aspect-video bg-black/40">
                  <Image src={item.url} alt={item.name} fill className="object-cover" unoptimized />

                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteThumbnail(item);
                      }}
                      disabled={isDeleting}
                      className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                      title="삭제"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-2 bg-black/60">
                  <div className="text-[10px] text-white/50 truncate" title={item.name}>
                    {item.contentId?.slice(0, 8)}...
                  </div>
                  <div className="text-[9px] text-white/30">
                    {new Date(item.created_at).toLocaleString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
