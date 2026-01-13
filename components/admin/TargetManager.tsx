"use client";

import { useState, useEffect } from "react";
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
    if (!confirm("정말 삭제하시겠습니까?")) return;

    // Optimistic update
    const previousTargets = [...targets];
    setTargets((prev) => prev.filter((t) => t.id !== id));

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

  async function toggleActive(id: string, currentActive: boolean) {
    await updateTarget(id, { is_active: !currentActive });
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

  const filteredTargets = targets.filter((t) => filterType === "all" || t.type === filterType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">수집 대상 관리</h3>
          <p className="text-sm text-white/60">
            뉴스 수집에 사용될 URL, 키워드, 채널을 관리합니다.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-[var(--color-claude-coral)] text-white rounded-lg hover:opacity-90 transition-colors"
        >
          + 추가
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterType("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterType === "all"
              ? "bg-white/20 text-white"
              : "bg-white/5 text-white/40 hover:text-white"
          }`}
        >
          전체 ({targets.length})
        </button>
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilterType(opt.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterType === opt.value
                ? "bg-white/20 text-white"
                : "bg-white/5 text-white/40 hover:text-white"
            }`}
          >
            {opt.icon} {opt.label} ({targets.filter((t) => t.type === opt.value).length})
          </button>
        ))}
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-md p-6">
            <h4 className="text-xl font-bold text-white mb-4">새 대상 추가</h4>

            <div className="space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">유형</label>
                <div className="flex gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFormData({ ...formData, type: opt.value })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                <label className="block text-sm font-medium text-white/60 mb-2">
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
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
                />
              </div>

              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
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
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">카테고리</label>
                <select
                  id="target-category"
                  name="target-category"
                  value={formData.category || "news"}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as TargetCategory })
                  }
                  className="w-full px-4 py-3 bg-[#2a2a2a] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#2a2a2a] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  우선순위 (높을수록 먼저 수집)
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
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
                className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
              >
                취소
              </button>
              <button
                onClick={createTarget}
                disabled={!formData.value.trim()}
                className="flex-1 px-4 py-3 bg-[var(--color-claude-coral)] text-white rounded-xl hover:opacity-90 transition-colors disabled:opacity-50"
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
          <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-md p-6">
            <h4 className="text-xl font-bold text-white mb-4">대상 수정</h4>

            <div className="space-y-4">
              {/* Type Display (read-only) */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">유형</label>
                <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/60">
                  {TYPE_OPTIONS.find((o) => o.value === editingTarget.type)?.icon}{" "}
                  {TYPE_OPTIONS.find((o) => o.value === editingTarget.type)?.label}
                </div>
              </div>

              {/* Value Input */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
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
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
                />
              </div>

              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
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
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">카테고리</label>
                <select
                  id="edit-target-category"
                  name="edit-target-category"
                  value={formData.category || "press"}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as TargetCategory })
                  }
                  className="w-full px-4 py-3 bg-[#2a2a2a] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#2a2a2a] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  우선순위 (높을수록 먼저 수집)
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
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-claude-coral)]"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditForm(false);
                  setEditingTarget(null);
                  resetForm();
                }}
                className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveEdit}
                disabled={!formData.value.trim()}
                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl hover:opacity-90 transition-colors disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Target List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-white/40">로딩 중...</div>
        ) : filteredTargets.length === 0 ? (
          <div className="text-center py-8 text-white/40">등록된 대상이 없습니다.</div>
        ) : (
          filteredTargets.map((target) => (
            <div
              key={target.id}
              className={`bg-white/5 rounded-xl p-4 border transition-colors ${
                target.is_active
                  ? "border-white/10 hover:border-white/20"
                  : "border-white/5 opacity-50"
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Type Icon */}
                <div className="text-2xl">
                  {TYPE_OPTIONS.find((o) => o.value === target.type)?.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white truncate">
                      {target.label || target.value}
                    </span>
                    {target.category && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          CATEGORY_OPTIONS.find((c) => c.value === target.category)?.color ||
                          "bg-white/10 text-white/60"
                        }`}
                      >
                        {CATEGORY_OPTIONS.find((c) => c.value === target.category)?.label}
                      </span>
                    )}
                    <span className="text-xs text-white/40">우선순위: {target.priority}</span>
                  </div>
                  <div className="text-sm text-white/40 truncate">{target.value}</div>
                  <div className="text-xs text-white/30 mt-1">
                    수집 {target.crawl_count ?? 0}회 | 성공률{" "}
                    {(target.success_rate ?? 0).toFixed(0)}%
                    {target.last_crawled_at && (
                      <> | 마지막: {new Date(target.last_crawled_at).toLocaleDateString("ko-KR")}</>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(target)}
                    className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/30 transition-colors"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => toggleActive(target.id, target.is_active)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      target.is_active
                        ? "bg-green-500/20 text-green-400"
                        : "bg-white/10 text-white/40"
                    }`}
                  >
                    {target.is_active ? "활성" : "비활성"}
                  </button>
                  <button
                    onClick={() => deleteTarget(target.id)}
                    className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
