"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandSpinnerProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { container: 56, logo: 28, ring: 56, border: 3 },
  md: { container: 72, logo: 36, ring: 72, border: 3 },
  lg: { container: 96, logo: 48, ring: 96, border: 4 },
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
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(
              from 0deg,
              transparent 0%,
              #DA7756 25%,
              #C4593D 50%,
              transparent 75%,
              transparent 100%
            )`,
            WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${s.border}px), black calc(100% - ${s.border}px))`,
            mask: `radial-gradient(farthest-side, transparent calc(100% - ${s.border}px), black calc(100% - ${s.border}px))`,
            animation: "brand-spin 1.2s linear infinite",
          }}
        />

        {/* Static background ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `${s.border}px solid rgba(255, 255, 255, 0.08)`,
          }}
        />

        {/* Glow effect */}
        <div
          className="absolute rounded-full opacity-30"
          style={{
            width: s.ring * 0.7,
            height: s.ring * 0.7,
            background: "radial-gradient(circle, #DA7756 0%, transparent 70%)",
            filter: "blur(8px)",
            animation: "brand-pulse 2s ease-in-out infinite",
          }}
        />

        {/* Center logo */}
        <div
          className="relative z-10 rounded-lg overflow-hidden"
          style={{
            animation: "brand-subtle-pulse 2s ease-in-out infinite",
          }}
        >
          <Image
            src="/logos/logo.png"
            alt="CCgather"
            width={s.logo}
            height={s.logo}
            priority
            className="drop-shadow-lg"
          />
        </div>
      </div>

      {/* Optional loading text */}
      {showText && (
        <div className="flex flex-col items-center gap-1">
          <p
            className="text-sm font-medium"
            style={{
              color: "rgba(255, 255, 255, 0.7)",
              animation: "brand-text-pulse 1.5s ease-in-out infinite",
            }}
          >
            Loading
            <span className="inline-flex" style={{ width: "1.5em" }}>
              <span
                style={{
                  animation: "brand-dots 1.4s infinite",
                  animationDelay: "0s",
                }}
              >
                .
              </span>
              <span
                style={{
                  animation: "brand-dots 1.4s infinite",
                  animationDelay: "0.2s",
                }}
              >
                .
              </span>
              <span
                style={{
                  animation: "brand-dots 1.4s infinite",
                  animationDelay: "0.4s",
                }}
              >
                .
              </span>
            </span>
          </p>
        </div>
      )}

      {/* Global keyframes for reliability */}
      <style jsx global>{`
        @keyframes brand-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes brand-pulse {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.1);
          }
        }

        @keyframes brand-subtle-pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes brand-text-pulse {
          0%,
          100% {
            opacity: 0.7;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes brand-dots {
          0%,
          20% {
            opacity: 0;
          }
          40% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
