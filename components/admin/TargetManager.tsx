"use client";

import { useState, useEffect } from "react";
import { Trash2, Power, PowerOff } from "lucide-react";
import type {
  AutomationTarget,
  CreateTargetInput,
  TargetType,
  TargetCategory,
} from "@/types/automation";

interface TargetManagerProps {
  onRefresh?: () => void;
}

const TYPE_OPTIONS: { value: TargetType; label: string; icon: string }[] = [
  { value: "url", label: "URL", icon: "🔗" },
  { value: "keyword", label: "키워드", icon: "🔍" },
  { value: "channel", label: "채널", icon: "📺" },
];

// Categories matching content_type for news page filtering
const CATEGORY_OPTIONS: {
  value: TargetCategory;
  label: string;
  color: string;
  description: string;
}[] = [
  {
    value: "official",
    label: "공식",
    color: "bg-blue-500/20 text-blue-400",
    description: "Anthropic 공식 발표",
  },
  {
    value: "claude_code",
    label: "Claude Code",
    color: "bg-orange-500/20 text-orange-400",
    description: "Claude Code 관련 콘텐츠",
  },
  {
    value: "press",
    label: "AI 뉴스",
    color: "bg-green-500/20 text-green-400",
    description: "AI 업계 뉴스/언론",
  },
  {
    value: "youtube",
    label: "YouTube",
    color: "bg-red-500/20 text-red-400",
    description: "YouTube 영상",
  },
];

export default function TargetManager({ onRefresh }: TargetManagerProps) {
  const [targets, setTargets] = useState<AutomationTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<AutomationTarget | null>(null);
  const [filterType, setFilterType] = useState<TargetType | "all">("all");

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form state
  const [formData, setFormData] = useState<CreateTargetInput>({
    type: "url",
    value: "",
    label: "",
    category: "press",
    priority: 0,
  });

  useEffect(() => {
    fetchTargets();
  }, []);

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterType]);

  async function fetchTargets() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/targets");
      if (response.ok) {
        const data = await response.json();
        setTargets(data.targets || []);
      }
    } catch (error) {
      console.error("Failed to fetch targets:", error);
    } finally {
      setLoading(false);
    }
  }

  async function createTarget() {
    if (!formData.value.trim()) return;

    try {
      const response = await fetch("/api/admin/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowAddForm(false);
        resetForm();
        fetchTargets();
        onRefresh?.();
      } else {
        const data = await response.json();
        alert(data.error || "생성 실패");
      }
    } catch (error) {
      console.error("Failed to create target:", error);
    }
  }

  async function updateTarget(id: string, updates: Partial<AutomationTarget>) {
    // Optimistic update
    const previousTargets = [...targets];
    setTargets((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));

    try {
      const response = await fetch(`/api/admin/targets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        // Rollback on error
        setTargets(previousTargets);
      }
    } catch (error) {
      console.error("Failed to update target:", error);
      // Rollback on error
      setTargets(previousTargets);
    }
  }

  async function deleteTarget(id: string) {
    // Optimistic update
    const previousTargets = [...targets];
    setTargets((prev) => prev.filter((t) => t.id !== id));
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });

    try {
      const response = await fetch(`/api/admin/targets/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // Rollback on error
        setTargets(previousTargets);
      }
    } catch (error) {
      console.error("Failed to delete target:", error);
      // Rollback on error
      setTargets(previousTargets);
    }
  }

  // Bulk operations
  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택된 ${selectedIds.size}개 항목을 삭제하시겠습니까?`)) return;

    const idsToDelete = Array.from(selectedIds);
    const previousTargets = [...targets];

    // Optimistic update
    setTargets((prev) => prev.filter((t) => !selectedIds.has(t.id)));
    setSelectedIds(new Set());

    try {
      await Promise.all(
        idsToDelete.map((id) => fetch(`/api/admin/targets/${id}`, { method: "DELETE" }))
      );
    } catch (error) {
      console.error("Failed to bulk delete:", error);
      setTargets(previousTargets);
    }
  }

  async function bulkSetActive(active: boolean) {
    if (selectedIds.size === 0) return;

    const idsToUpdate = Array.from(selectedIds);
    const previousTargets = [...targets];

    // Optimistic update
    setTargets((prev) =>
      prev.map((t) => (selectedIds.has(t.id) ? { ...t, is_active: active } : t))
    );

    try {
      await Promise.all(
        idsToUpdate.map((id) =>
          fetch(`/api/admin/targets/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_active: active }),
          })
        )
      );
    } catch (error) {
      console.error("Failed to bulk update:", error);
      setTargets(previousTargets);
    }
  }

  function toggleActive(id: string, currentActive: boolean) {
    updateTarget(id, { is_active: !currentActive });
  }

  function resetForm() {
    setFormData({
      type: "url",
      value: "",
      label: "",
      category: "press",
      priority: 0,
    });
  }

  function startEdit(target: AutomationTarget) {
    setEditingTarget(target);
    setFormData({
      type: target.type,
      value: target.value,
      label: target.label || "",
      category: target.category || "press",
      priority: target.priority,
    });
    setShowEditForm(true);
  }

  async function saveEdit() {
    if (!editingTarget || !formData.value.trim()) return;

    const updates = {
      value: formData.value,
      label: formData.label,
      category: formData.category,
      priority: formData.priority ?? editingTarget.priority,
    };

    // Optimistic update
    const previousTargets = [...targets];
    setTargets((prev) =>
      prev.map((t) =>
        t.id === editingTarget.id ? { ...t, ...updates, priority: updates.priority } : t
      )
    );
    setShowEditForm(false);
    setEditingTarget(null);
    resetForm();

    try {
      const response = await fetch(`/api/admin/targets/${editingTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        // Rollback on error
        setTargets(previousTargets);
        const data = await response.json();
        alert(data.error || "수정 실패");
      }
    } catch (error) {
      console.error("Failed to update target:", error);
      // Rollback on error
      setTargets(previousTargets);
    }
  }

  // Selection helpers
  const filteredTargets = targets.filter((t) => filterType === "all" || t.type === filterType);
  const allSelected =
    filteredTargets.length > 0 && filteredTargets.every((t) => selectedIds.has(t.id));
  const someSelected = selectedIds.size > 0;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTargets.map((t) => t.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-white">수집 대상 관리</h3>
          <p className="text-[11px] text-white/50 mt-0.5">
            뉴스 수집에 사용될 URL, 키워드, 채널을 관리합니다.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-3 py-1.5 bg-[var(--color-claude-coral)] text-white rounded-lg text-[12px] font-medium hover:opacity-90 transition-colors"
        >
          + 추가
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setFilterType("all")}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
            filterType === "all"
              ? "bg-white/15 text-white"
              : "bg-white/5 text-white/40 hover:text-white/60"
          }`}
        >
          전체 ({targets.length})
        </button>
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilterType(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
              filterType === opt.value
                ? "bg-white/15 text-white"
                : "bg-white/5 text-white/40 hover:text-white/60"
            }`}
          >
            {opt.icon} {opt.label} ({targets.filter((t) => t.type === opt.value).length})
          </button>
        ))}
      </div>

      {/* Bulk Action Bar */}
      <div className="flex items-center gap-3 py-2 px-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
        {/* Select All Checkbox */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-[var(--color-claude-coral)] focus:ring-[var(--color-claude-coral)] focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-[11px] text-white/60">전체 선택</span>
        </label>

        {/* Bulk Actions - Show when items selected */}
        {someSelected && (
          <>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-[11px] text-white/50">{selectedIds.size}개 선택됨</span>
            <div className="flex gap-1.5 ml-auto">
              <button
                onClick={() => bulkSetActive(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
              >
                <Power className="w-3 h-3" />
                활성화
              </button>
              <button
                onClick={() => bulkSetActive(false)}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium bg-white/10 text-white/60 hover:bg-white/15 transition-colors"
              >
                <PowerOff className="w-3 h-3" />
                비활성화
              </button>
              <button
                onClick={bulkDelete}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                삭제
              </button>
            </div>
          </>
        )}
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-xl w-full max-w-md p-5 border border-white/10">
            <h4 className="text-[15px] font-bold text-white mb-4">새 대상 추가</h4>

            <div className="space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-[11px] font-medium text-white/50 mb-2">유형</label>
                <div className="flex gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFormData({ ...formData, type: opt.value })}
                      className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                        formData.type === opt.value
                          ? "bg-[var(--color-claude-coral)] text-white"
                          : "bg-white/10 text-white/60 hover:text-white"
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Value Input */}
              <div>
                <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                  {formData.type === "url"
                    ? "URL"
                    : formData.type === "keyword"
                      ? "키워드"
                      : "채널 ID"}
                </label>
                <input
                  id="target-value"
                  name="target-value"
                  type={formData.type === "url" ? "url" : "text"}
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={
                    formData.type === "url"
                      ? "https://example.com/news"
                      : formData.type === "keyword"
                        ? "Claude Code tutorial"
                        : "@ChannelName"
                  }
                  autoComplete="off"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-claude-coral)]"
                />
              </div>

              {/* Label */}
              <div>
                <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                  표시 이름 (선택)
                </label>
                <input
                  id="target-label"
                  name="target-label"
                  type="text"
                  value={formData.label || ""}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Anthropic 공식 블로그"
                  autoComplete="off"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-claude-coral)]"
                />
              </div>

              {/* Category & Priority Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                    카테고리
                  </label>
                  <select
                    id="target-category"
                    name="target-category"
                    value={formData.category || "press"}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as TargetCategory })
                    }
                    className="w-full px-3 py-2.5 bg-[#252525] border border-white/10 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[var(--color-claude-coral)]"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-[#252525] text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                    우선순위
                  </label>
                  <input
                    id="target-priority"
                    name="target-priority"
                    type="number"
                    value={formData.priority || 0}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                    }
                    autoComplete="off"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[var(--color-claude-coral)]"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
                className="flex-1 px-4 py-2.5 bg-white/10 text-white rounded-lg text-[12px] hover:bg-white/15 transition-colors"
              >
                취소
              </button>
              <button
                onClick={createTarget}
                disabled={!formData.value.trim()}
                className="flex-1 px-4 py-2.5 bg-[var(--color-claude-coral)] text-white rounded-lg text-[12px] hover:opacity-90 transition-colors disabled:opacity-50"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Form Modal */}
      {showEditForm && editingTarget && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-xl w-full max-w-md p-5 border border-white/10">
            <h4 className="text-[15px] font-bold text-white mb-4">대상 수정</h4>

            <div className="space-y-4">
              {/* Type Display (read-only) */}
              <div>
                <label className="block text-[11px] font-medium text-white/50 mb-1.5">유형</label>
                <div className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[13px] text-white/60">
                  {TYPE_OPTIONS.find((o) => o.value === editingTarget.type)?.icon}{" "}
                  {TYPE_OPTIONS.find((o) => o.value === editingTarget.type)?.label}
                </div>
              </div>

              {/* Value Input */}
              <div>
                <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                  {formData.type === "url"
                    ? "URL"
                    : formData.type === "keyword"
                      ? "키워드"
                      : "채널 ID"}
                </label>
                <input
                  id="edit-target-value"
                  name="edit-target-value"
                  type={formData.type === "url" ? "url" : "text"}
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  autoComplete="off"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-claude-coral)]"
                />
              </div>

              {/* Label */}
              <div>
                <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                  표시 이름 (선택)
                </label>
                <input
                  id="edit-target-label"
                  name="edit-target-label"
                  type="text"
                  value={formData.label || ""}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Anthropic 공식 블로그"
                  autoComplete="off"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-claude-coral)]"
                />
              </div>

              {/* Category & Priority Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                    카테고리
                  </label>
                  <select
                    id="edit-target-category"
                    name="edit-target-category"
                    value={formData.category || "press"}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as TargetCategory })
                    }
                    className="w-full px-3 py-2.5 bg-[#252525] border border-white/10 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[var(--color-claude-coral)]"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-[#252525] text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                    우선순위
                  </label>
                  <input
                    id="edit-target-priority"
                    name="edit-target-priority"
                    type="number"
                    value={formData.priority || 0}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                    }
                    autoComplete="off"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[var(--color-claude-coral)]"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setShowEditForm(false);
                  setEditingTarget(null);
                  resetForm();
                }}
                className="flex-1 px-4 py-2.5 bg-white/10 text-white rounded-lg text-[12px] hover:bg-white/15 transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveEdit}
                disabled={!formData.value.trim()}
                className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg text-[12px] hover:opacity-90 transition-colors disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Target List */}
      <div className="space-y-1.5">
        {loading ? (
          <div className="text-center py-8 text-white/40 text-[12px]">로딩 중...</div>
        ) : filteredTargets.length === 0 ? (
          <div className="text-center py-8 text-white/40 text-[12px]">등록된 대상이 없습니다.</div>
        ) : (
          filteredTargets.map((target) => (
            <div
              key={target.id}
              className={`group flex items-center gap-3 bg-white/[0.03] rounded-lg p-3 border transition-all cursor-pointer ${
                selectedIds.has(target.id)
                  ? "border-[var(--color-claude-coral)]/50 bg-[var(--color-claude-coral)]/5"
                  : target.is_active
                    ? "border-white/[0.06] hover:border-white/10"
                    : "border-white/[0.03] opacity-50"
              }`}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selectedIds.has(target.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleSelect(target.id);
                }}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-[var(--color-claude-coral)] focus:ring-[var(--color-claude-coral)] focus:ring-offset-0 cursor-pointer flex-shrink-0"
              />

              {/* Type Icon */}
              <div className="text-lg flex-shrink-0">
                {TYPE_OPTIONS.find((o) => o.value === target.type)?.icon}
              </div>

              {/* Info - Clickable for Edit */}
              <div className="flex-1 min-w-0" onClick={() => startEdit(target)}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-[13px] text-white truncate">
                    {target.label || target.value}
                  </span>
                  {target.category && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] ${
                        CATEGORY_OPTIONS.find((c) => c.value === target.category)?.color ||
                        "bg-white/10 text-white/60"
                      }`}
                    >
                      {CATEGORY_OPTIONS.find((c) => c.value === target.category)?.label}
                    </span>
                  )}
                  <span className="text-[10px] text-white/30">P:{target.priority}</span>
                </div>
                <div className="text-[11px] text-white/40 truncate">{target.value}</div>
                <div className="text-[10px] text-white/25 mt-0.5">
                  수집 {target.crawl_count || 0}회 | 성공률{" "}
                  {Number(target.success_rate || 0).toFixed(0)}%
                  {target.last_crawled_at && (
                    <> | {new Date(target.last_crawled_at).toLocaleDateString("ko-KR")}</>
                  )}
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleActive(target.id, target.is_active);
                }}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                  target.is_active ? "bg-emerald-500" : "bg-white/20"
                }`}
                title={target.is_active ? "비활성화" : "활성화"}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                    target.is_active ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>

              {/* More Menu */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!confirm("이 대상을 삭제하시겠습니까?")) return;
                    deleteTarget(target.id);
                  }}
                  className="p-1.5 rounded hover:bg-white/10 text-white/30 hover:text-red-400 transition-colors"
                  title="삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
