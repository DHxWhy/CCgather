"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandSpinnerProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { container: 48, logo: 24, ring: 48, border: 2 },
  md: { container: 64, logo: 32, ring: 64, border: 3 },
  lg: { container: 80, logo: 40, ring: 80, border: 3 },
};

export function BrandSpinner({ size = "md", showText = false, className }: BrandSpinnerProps) {
  const s = sizes[size];

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Spinner Container */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: s.container, height: s.container }}
      >
        {/* Rotating gradient ring */}
        <div
          className="absolute inset-0 rounded-full animate-spin-slow"
          style={{
            background: `conic-gradient(
              from 0deg,
              transparent 0%,
              var(--color-claude-coral) 25%,
              var(--color-claude-rust) 50%,
              transparent 75%,
              transparent 100%
            )`,
            WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${s.border}px), black calc(100% - ${s.border}px))`,
            mask: `radial-gradient(farthest-side, transparent calc(100% - ${s.border}px), black calc(100% - ${s.border}px))`,
          }}
        />

        {/* Glow effect */}
        <div
          className="absolute rounded-full opacity-40 blur-md animate-pulse-glow"
          style={{
            width: s.ring,
            height: s.ring,
            background: "var(--color-claude-coral)",
          }}
        />

        {/* Center logo */}
        <div className="relative z-10 rounded-lg overflow-hidden animate-subtle-pulse">
          <Image
            src="/logo.png"
            alt="Loading"
            width={s.logo}
            height={s.logo}
            priority
            className="drop-shadow-lg"
          />
        </div>
      </div>

      {/* Optional loading text */}
      {showText && (
        <p className="text-sm text-[var(--color-text-muted)] animate-pulse">Loading...</p>
      )}
    </div>
  );
}
