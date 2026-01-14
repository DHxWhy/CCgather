"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

// =====================================================
// Types
// =====================================================

export interface AvatarData {
  src: string;
  alt?: string;
  label?: string;
  fallback?: string; // 이니셜 또는 대체 텍스트
}

export interface AvatarGroupProps {
  avatars: AvatarData[];
  maxVisible?: number;
  size?: "sm" | "md" | "lg";
  overlap?: "tight" | "normal" | "loose";
  showTooltip?: boolean;
  className?: string;
}

// =====================================================
// Size & Overlap Configurations
// =====================================================

const sizeConfig = {
  sm: { pixel: 28, fontSize: 10, borderWidth: 2 },
  md: { pixel: 36, fontSize: 12, borderWidth: 3 },
  lg: { pixel: 44, fontSize: 14, borderWidth: 4 },
};

const overlapConfig = {
  tight: 0.4, // 40% overlap
  normal: 0.35, // 35% overlap
  loose: 0.25, // 25% overlap
};

// =====================================================
// Component
// =====================================================

function AvatarGroup({
  avatars,
  maxVisible = 5,
  size = "md",
  overlap = "normal",
  showTooltip = true,
  className,
}: AvatarGroupProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { pixel, fontSize, borderWidth } = sizeConfig[size];
  const overlapAmount = pixel * overlapConfig[overlap];

  const visibleAvatars = avatars.slice(0, maxVisible);
  const extraCount = avatars.length - maxVisible;

  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex">
        {visibleAvatars.map((avatar, idx) => {
          const isHovered = hoveredIdx === idx;
          const isFirst = idx === 0;

          return (
            <div
              key={idx}
              className={cn(
                "relative rounded-full bg-[var(--color-bg-primary)]",
                "transition-all duration-300 ease-out",
                "hover:scale-110"
              )}
              style={{
                width: pixel,
                height: pixel,
                zIndex: isHovered ? 100 : visibleAvatars.length - idx,
                marginLeft: isFirst ? 0 : -overlapAmount,
                borderWidth: borderWidth,
                borderColor: "var(--color-bg-primary)",
                borderStyle: "solid",
                transform: isHovered ? "translateY(-4px)" : "translateY(0)",
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {avatar.src ? (
                <Image
                  src={avatar.src}
                  alt={avatar.alt || `Avatar ${idx + 1}`}
                  width={pixel}
                  height={pixel}
                  className="rounded-full object-cover"
                  draggable={false}
                  unoptimized={avatar.src.startsWith("http")}
                />
              ) : (
                <div
                  className={cn(
                    "w-full h-full rounded-full",
                    "flex items-center justify-center",
                    "bg-[var(--color-bg-elevated)]",
                    "text-[var(--color-text-secondary)]",
                    "font-medium"
                  )}
                  style={{ fontSize }}
                >
                  {avatar.fallback || avatar.alt?.charAt(0)?.toUpperCase() || "?"}
                </div>
              )}

              {/* Tooltip */}
              <AnimatePresence>
                {showTooltip && isHovered && avatar.label && (
                  <motion.div
                    key="tooltip"
                    initial={{
                      x: "-50%",
                      y: 8,
                      opacity: 0,
                      scale: 0.85,
                    }}
                    animate={{
                      x: "-50%",
                      y: 0,
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      x: "-50%",
                      y: 8,
                      opacity: 0,
                      scale: 0.85,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 24,
                    }}
                    className={cn(
                      "absolute z-50",
                      "px-2 py-1",
                      "bg-[var(--color-bg-elevated)]",
                      "text-[var(--color-text-primary)]",
                      "text-xs font-medium",
                      "rounded-md shadow-lg",
                      "whitespace-nowrap pointer-events-none",
                      "border border-[var(--border-default)]"
                    )}
                    style={{
                      bottom: pixel + 4,
                      left: "50%",
                    }}
                  >
                    {avatar.label}
                    {/* Arrow */}
                    <div
                      className={cn(
                        "absolute w-2 h-2",
                        "bg-[var(--color-bg-elevated)]",
                        "border-r border-b border-[var(--border-default)]",
                        "transform rotate-45",
                        "-bottom-1 left-1/2 -translate-x-1/2"
                      )}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Extra count badge */}
        {extraCount > 0 && (
          <div
            className={cn(
              "flex items-center justify-center",
              "rounded-full",
              "bg-[var(--color-bg-elevated)]",
              "text-[var(--color-text-secondary)]",
              "font-semibold",
              "border-[var(--color-bg-primary)]"
            )}
            style={{
              width: pixel,
              height: pixel,
              marginLeft: -overlapAmount,
              zIndex: 0,
              fontSize: fontSize,
              borderWidth: borderWidth,
              borderStyle: "solid",
            }}
          >
            +{extraCount}
          </div>
        )}
      </div>
    </div>
  );
}

export { AvatarGroup };
