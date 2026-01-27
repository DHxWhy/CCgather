"use client";

import { memo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ToolCategory } from "@/lib/types/tools";
import { CATEGORY_META } from "@/lib/types/tools";

// =====================================================
// Types
// =====================================================

interface CategoryTabsProps {
  selected: ToolCategory | "all";
  onChange: (category: ToolCategory | "all") => void;
  counts?: Record<ToolCategory | "all", number>;
  className?: string;
}

// =====================================================
// All Categories with 'All' option
// =====================================================

const ALL_CATEGORIES: Array<{
  key: ToolCategory | "all";
  label: string;
  emoji: string;
  color: string;
}> = [
  { key: "all", label: "All", emoji: "✨", color: "white" },
  { key: "ai-coding", ...CATEGORY_META["ai-coding"] },
  { key: "devops", ...CATEGORY_META["devops"] },
  { key: "productivity", ...CATEGORY_META["productivity"] },
  { key: "design", ...CATEGORY_META["design"] },
  { key: "api-data", ...CATEGORY_META["api-data"] },
  { key: "open-source", ...CATEGORY_META["open-source"] },
  { key: "learning", ...CATEGORY_META["learning"] },
  { key: "social", ...CATEGORY_META["social"] },
  { key: "marketing", ...CATEGORY_META["marketing"] },
];

// =====================================================
// Color Classes for each category (type-safe)
// =====================================================

// Claude Coral 브랜드 컬러로 선택 상태 통일 (눈에 잘 띄도록)
const SELECTED_STYLE =
  "bg-[var(--color-claude-coral)]/20 text-[var(--color-claude-coral)] ring-1 ring-[var(--color-claude-coral)]/30";

// 비활성 상태 기본 스타일 (연한 배경 추가)
const INACTIVE_BASE = "bg-[var(--color-section-bg)] text-[var(--color-text-secondary)]";

const categoryColorClasses: Record<ToolCategory | "all", { active: string; inactive: string }> = {
  all: {
    active: SELECTED_STYLE,
    inactive: `${INACTIVE_BASE} hover:bg-[var(--color-section-bg-hover)]`,
  },
  "ai-coding": {
    active: SELECTED_STYLE,
    inactive: `${INACTIVE_BASE} hover:bg-purple-500/10 hover:text-purple-400`,
  },
  devops: {
    active: SELECTED_STYLE,
    inactive: `${INACTIVE_BASE} hover:bg-orange-500/10 hover:text-orange-400`,
  },
  productivity: {
    active: SELECTED_STYLE,
    inactive: `${INACTIVE_BASE} hover:bg-yellow-500/10 hover:text-yellow-400`,
  },
  design: {
    active: SELECTED_STYLE,
    inactive: `${INACTIVE_BASE} hover:bg-pink-500/10 hover:text-pink-400`,
  },
  "api-data": {
    active: SELECTED_STYLE,
    inactive: `${INACTIVE_BASE} hover:bg-cyan-500/10 hover:text-cyan-400`,
  },
  "open-source": {
    active: SELECTED_STYLE,
    inactive: `${INACTIVE_BASE} hover:bg-green-500/10 hover:text-green-400`,
  },
  learning: {
    active: SELECTED_STYLE,
    inactive: `${INACTIVE_BASE} hover:bg-blue-500/10 hover:text-blue-400`,
  },
  social: {
    active: SELECTED_STYLE,
    inactive: `${INACTIVE_BASE} hover:bg-indigo-500/10 hover:text-indigo-400`,
  },
  marketing: {
    active: SELECTED_STYLE,
    inactive: `${INACTIVE_BASE} hover:bg-red-500/10 hover:text-red-400`,
  },
};

// =====================================================
// Component
// =====================================================

function CategoryTabsComponent({ selected, onChange, counts, className }: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Scroll selected tab into view
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const element = selectedRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      if (elementRect.left < containerRect.left || elementRect.right > containerRect.right) {
        element.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [selected]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex items-center gap-1 lg:gap-1.5 overflow-x-auto scrollbar-hide",
        "pb-1", // Space for focus ring
        className
      )}
      role="tablist"
      aria-label="도구 카테고리"
    >
      {ALL_CATEGORIES.map((category) => {
        const isSelected = selected === category.key;
        const colorClass = categoryColorClasses[category.key];
        const count = counts?.[category.key];

        return (
          <motion.button
            key={category.key}
            ref={isSelected ? selectedRef : undefined}
            onClick={() => onChange(category.key)}
            whileTap={{ scale: 0.97 }}
            role="tab"
            aria-selected={isSelected}
            className={cn(
              "flex items-center gap-1 px-2 py-1.5 lg:px-2.5 rounded-full",
              "text-xs font-medium whitespace-nowrap",
              "transition-colors duration-200",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-claude-coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]",
              isSelected ? colorClass.active : colorClass.inactive
            )}
          >
            <span>{category.emoji}</span>
            <span>{category.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px]",
                  isSelected ? "bg-white/20" : "bg-[var(--color-bg-elevated)]"
                )}
              >
                {count}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

export default memo(CategoryTabsComponent);
