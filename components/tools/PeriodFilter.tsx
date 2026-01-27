"use client";

import { memo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolPeriod } from "@/lib/types/tools";

// =====================================================
// Types
// =====================================================

interface PeriodFilterProps {
  selected: ToolPeriod;
  onChange: (period: ToolPeriod) => void;
  className?: string;
}

// =====================================================
// Period Options
// =====================================================

const PERIODS: Array<{ key: ToolPeriod; label: string; description: string }> = [
  { key: "week", label: "This Week", description: "지난 7일간 인기" },
  { key: "month", label: "This Month", description: "지난 30일간 인기" },
  { key: "all", label: "All Time", description: "전체 기간 인기" },
];

// =====================================================
// Component
// =====================================================

function PeriodFilterComponent({ selected, onChange, className }: PeriodFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedPeriod = PERIODS.find((p) => p.key === selected) ?? PERIODS[0]!;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger Button - height matches view mode toggle (h-8) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 h-8 rounded-lg",
          "bg-[var(--color-filter-bg)]",
          "border border-[var(--border-default)]",
          "text-sm text-[var(--color-text-primary)]",
          "hover:bg-[var(--color-filter-hover)]",
          "transition-colors duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-claude-coral)]"
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selectedPeriod.label}</span>
        <ChevronDown
          className={cn("w-4 h-4 transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute top-full left-0 mt-1 z-50",
              "min-w-[160px] py-1 rounded-lg overflow-hidden",
              "bg-[#2a2a30] dark:bg-[#2a2a30]",
              "border border-[var(--border-default)]",
              "shadow-xl shadow-black/20"
            )}
            role="listbox"
          >
            {PERIODS.map((period) => {
              const isSelected = selected === period.key;

              return (
                <button
                  key={period.key}
                  onClick={() => {
                    onChange(period.key);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2",
                    "text-left text-sm",
                    "hover:bg-white/5",
                    "transition-colors duration-150",
                    isSelected
                      ? "text-[var(--color-claude-coral)] bg-white/5"
                      : "text-[var(--color-text-primary)]"
                  )}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div>
                    <div className={cn("font-medium", !isSelected && "text-white")}>
                      {period.label}
                    </div>
                    <div className="text-[10px] text-gray-400">{period.description}</div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[var(--color-claude-coral)]" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(PeriodFilterComponent);
