"use client";

import { memo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ToolCategory } from "@/types/tools";
import { CATEGORY_META } from "@/types/tools";

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

const categoryColorClasses: Record<ToolCategory | "all", { active: string; inactive: string }> = {
  all: {
    active: "bg-white/15 text-white",
    inactive: "text-[var(--color-text-secondary)] hover:bg-white/5",
  },
  "ai-coding": {
    active: "bg-purple-500/20 text-purple-400",
    inactive: "text-[var(--color-text-secondary)] hover:bg-purple-500/10 hover:text-purple-400",
  },
  devops: {
    active: "bg-orange-500/20 text-orange-400",
    inactive: "text-[var(--color-text-secondary)] hover:bg-orange-500/10 hover:text-orange-400",
  },
  productivity: {
    active: "bg-yellow-500/20 text-yellow-400",
    inactive: "text-[var(--color-text-secondary)] hover:bg-yellow-500/10 hover:text-yellow-400",
  },
  design: {
    active: "bg-pink-500/20 text-pink-400",
    inactive: "text-[var(--color-text-secondary)] hover:bg-pink-500/10 hover:text-pink-400",
  },
  "api-data": {
    active: "bg-cyan-500/20 text-cyan-400",
    inactive: "text-[var(--color-text-secondary)] hover:bg-cyan-500/10 hover:text-cyan-400",
  },
  "open-source": {
    active: "bg-green-500/20 text-green-400",
    inactive: "text-[var(--color-text-secondary)] hover:bg-green-500/10 hover:text-green-400",
  },
  learning: {
    active: "bg-blue-500/20 text-blue-400",
    inactive: "text-[var(--color-text-secondary)] hover:bg-blue-500/10 hover:text-blue-400",
  },
  social: {
    active: "bg-indigo-500/20 text-indigo-400",
    inactive: "text-[var(--color-text-secondary)] hover:bg-indigo-500/10 hover:text-indigo-400",
  },
  marketing: {
    active: "bg-red-500/20 text-red-400",
    inactive: "text-[var(--color-text-secondary)] hover:bg-red-500/10 hover:text-red-400",
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
        "flex items-center gap-1.5 overflow-x-auto scrollbar-hide",
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
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
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
