"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

// =====================================================
// Types
// =====================================================

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: AvatarSize;
  fallbackClassName?: string;
  className?: string;
}

// =====================================================
// Size Configuration
// =====================================================

const sizeConfig: Record<AvatarSize, { pixel: number; fontSize: string }> = {
  xs: { pixel: 16, fontSize: "text-[8px]" },
  sm: { pixel: 24, fontSize: "text-[10px]" },
  md: { pixel: 40, fontSize: "text-sm" },
  lg: { pixel: 48, fontSize: "text-base" },
  xl: { pixel: 80, fontSize: "text-2xl" },
};

// =====================================================
// Component
// =====================================================

export function Avatar({ src, alt, size = "md", fallbackClassName, className }: AvatarProps) {
  const { pixel, fontSize } = sizeConfig[size];
  const fallbackLetter = alt?.charAt(0)?.toUpperCase() || "?";

  if (!src) {
    return (
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0",
          "bg-gradient-to-br from-[var(--color-claude-coral)] to-[var(--color-claude-rust)]",
          fontSize,
          fallbackClassName,
          className
        )}
        style={{ width: pixel, height: pixel }}
      >
        {fallbackLetter}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={pixel}
      height={pixel}
      className={cn("rounded-full object-cover flex-shrink-0", className)}
    />
  );
}
