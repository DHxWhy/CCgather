"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowBigUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// =====================================================
// Types
// =====================================================

interface VoteButtonProps {
  count: number;
  voted: boolean;
  loading?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  size?: "xs" | "sm" | "md" | "lg";
  showCount?: boolean;
  className?: string;
}

// =====================================================
// Size Configurations
// =====================================================

const sizeConfig = {
  xs: {
    button: "h-6 px-1.5 gap-0.5 text-[10px]",
    icon: "w-3 h-3",
    loader: "w-2.5 h-2.5",
  },
  sm: {
    button: "h-7 px-2 gap-1 text-xs",
    icon: "w-3.5 h-3.5",
    loader: "w-3 h-3",
  },
  md: {
    button: "h-9 px-3 gap-1.5 text-sm",
    icon: "w-4 h-4",
    loader: "w-3.5 h-3.5",
  },
  lg: {
    button: "h-11 px-4 gap-2 text-base",
    icon: "w-5 h-5",
    loader: "w-4 h-4",
  },
};

// =====================================================
// Component
// =====================================================

function VoteButtonComponent({
  count,
  voted,
  loading = false,
  onClick,
  size = "md",
  showCount = true,
  className,
}: VoteButtonProps) {
  const config = sizeConfig[size];

  return (
    <motion.button
      onClick={onClick}
      disabled={loading}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-claude-coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]",
        config.button,
        voted
          ? "bg-orange-500 text-white hover:bg-orange-600"
          : "bg-transparent border border-[var(--border-default)] text-[var(--color-text-secondary)] hover:border-orange-500/50 hover:text-orange-500 hover:bg-orange-500/10",
        loading && "opacity-70 cursor-not-allowed",
        className
      )}
      aria-label={voted ? `투표 취소 (현재 ${count}표)` : `투표하기 (현재 ${count}표)`}
      aria-pressed={voted}
    >
      {loading ? (
        <Loader2 className={cn(config.loader, "animate-spin")} />
      ) : (
        <motion.div
          initial={false}
          animate={voted ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <ArrowBigUp
            className={cn(config.icon, voted && "fill-current")}
            strokeWidth={voted ? 0 : 2}
          />
        </motion.div>
      )}

      {showCount && (
        <AnimatePresence mode="popLayout">
          <motion.span
            key={count}
            initial={{ y: voted ? -10 : 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: voted ? 10 : -10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="tabular-nums"
          >
            {formatCount(count)}
          </motion.span>
        </AnimatePresence>
      )}
    </motion.button>
  );
}

// =====================================================
// Helpers
// =====================================================

function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

export default memo(VoteButtonComponent);
