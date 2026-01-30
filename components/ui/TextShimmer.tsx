"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

interface TextShimmerProps {
  /** Number of lines to show (auto-calculated if not provided) */
  lines?: number;
  /** Original content length for auto line calculation */
  contentLength?: number;
  /** Custom class name */
  className?: string;
  /** Variant style */
  variant?: "default" | "compact";
}

// ============================================
// Constants
// ============================================

// Average characters per line (approx for 13px font)
const CHARS_PER_LINE = 45;

// Line width patterns for natural look (percentage)
const LINE_WIDTHS = [100, 92, 85, 78, 60];

// ============================================
// TextShimmer Component
// ============================================

function TextShimmerComponent({
  lines,
  contentLength,
  className,
  variant = "default",
}: TextShimmerProps) {
  // Calculate lines from content length if not provided
  const lineCount = useMemo(() => {
    if (lines) return Math.min(lines, 5);
    if (contentLength) {
      const calculated = Math.ceil(contentLength / CHARS_PER_LINE);
      return Math.min(Math.max(calculated, 1), 5);
    }
    return 2; // Default
  }, [lines, contentLength]);

  const lineHeightClass = variant === "compact" ? "h-3" : "h-4";
  const gapClass = variant === "compact" ? "gap-1.5" : "gap-2";

  return (
    <div
      className={cn("flex flex-col", gapClass, className)}
      role="status"
      aria-label="Loading translation..."
    >
      {Array.from({ length: lineCount }).map((_, index) => (
        <div
          key={index}
          className={cn(
            lineHeightClass,
            "rounded-md",
            "bg-gradient-to-r from-[var(--color-bg-card)] via-[var(--color-accent-cyan)]/10 to-[var(--color-bg-card)]",
            "bg-[length:200%_100%]",
            "animate-shimmer"
          )}
          style={{
            width: `${LINE_WIDTHS[index % LINE_WIDTHS.length]}%`,
            animationDelay: `${index * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// Export
// ============================================

export const TextShimmer = memo(TextShimmerComponent);
export default TextShimmer;
