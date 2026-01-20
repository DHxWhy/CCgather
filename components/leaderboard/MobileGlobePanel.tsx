"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { TopCountriesSection } from "./TopCountriesSection";
import type { CountryStat } from "./TopCountriesSection";

// Lazy load Globe
const Globe = dynamic(
  () => import("@/components/globe/Globe").then((mod) => ({ default: mod.Globe })),
  { ssr: false }
);

// Lazy load GlobeParticles
const GlobeParticles = dynamic(
  () => import("@/components/ui/globe-particles").then((mod) => ({ default: mod.GlobeParticles })),
  { ssr: false }
);

interface MobileGlobePanelProps {
  isOpen: boolean;
  onClose: () => void;
  countryStats: CountryStat[];
  totalTokens: number;
  totalCost: number;
  sortBy: "tokens" | "cost";
  onSortByChange?: (sortBy: "tokens" | "cost") => void;
  userCountryCode?: string;
  scopeFilter: "global" | "country";
}

export function MobileGlobePanel({
  isOpen,
  onClose,
  countryStats,
  totalTokens,
  totalCost,
  sortBy,
  onSortByChange,
  userCountryCode,
  scopeFilter,
}: MobileGlobePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchCurrentX, setTouchCurrentX] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Dynamic sizing based on screen dimensions (matching ProfileSidePanel behavior)
  const [globeSize, setGlobeSize] = useState(240);

  const SWIPE_THRESHOLD = 80; // px to trigger close

  // Update globe size based on screen dimensions
  useEffect(() => {
    const updateGlobeSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isLandscape = width > height;
      const panelAvailableWidth = width - 56; // Match ProfileSidePanel's calc(100% - 56px)

      if (isLandscape) {
        // Landscape: constrain by height
        setGlobeSize(Math.min(280, Math.floor(height * 0.4), panelAvailableWidth - 48));
      } else {
        // Portrait: constrain by panel width
        setGlobeSize(Math.min(260, panelAvailableWidth - 48));
      }
    };

    updateGlobeSize();

    window.addEventListener("resize", updateGlobeSize);
    window.addEventListener("orientationchange", updateGlobeSize);
    return () => {
      window.removeEventListener("resize", updateGlobeSize);
      window.removeEventListener("orientationchange", updateGlobeSize);
    };
  }, [isOpen]);

  // Calculate drag offset
  const dragOffset =
    isDragging && touchStartX !== null && touchCurrentX !== null
      ? Math.min(0, touchCurrentX - touchStartX)
      : 0;

  // Touch handlers for swipe-to-close
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      setTouchStartX(touch.clientX);
      setTouchCurrentX(touch.clientX);
      setIsDragging(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      if (touch) {
        setTouchCurrentX(touch.clientX);
      }
    },
    [isDragging]
  );

  const handleTouchEnd = useCallback(() => {
    if (isDragging && touchStartX !== null && touchCurrentX !== null) {
      const delta = touchCurrentX - touchStartX;
      if (delta < -SWIPE_THRESHOLD) {
        onClose();
      }
    }
    setTouchStartX(null);
    setTouchCurrentX(null);
    setIsDragging(false);
  }, [isDragging, touchStartX, touchCurrentX, onClose]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel - matches ProfileSidePanel width behavior, starts below GNB */}
      <div
        ref={panelRef}
        className={`fixed top-14 left-0 z-50 bg-[var(--color-bg-primary)] border-r border-[var(--border-default)] shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: "calc(100% - 56px)",
          maxWidth: "calc(100% - 56px)",
          height: "calc(100% - 56px)",
          transform: isOpen ? `translateX(${dragOffset}px)` : "translateX(-100%)",
          transition: isDragging ? "none" : "transform 0.3s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Content */}
        <div className="h-full overflow-y-auto p-4 space-y-4">
          {/* Title Section */}
          <div className="text-center pt-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center justify-center gap-2">
              <span>🌍</span>
              Global Usage
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Unite at the country level!
            </p>
          </div>

          {/* Globe with Filter Buttons */}
          <div className="relative flex justify-center">
            {/* Filter Buttons - Top Right of Globe */}
            {onSortByChange && (
              <div className="absolute top-0 right-0 z-10 flex h-7 glass rounded-lg overflow-hidden">
                <button
                  onClick={() => onSortByChange("cost")}
                  className={`h-7 w-7 text-xs font-medium transition-colors flex items-center justify-center ${
                    sortBy === "cost"
                      ? "bg-[var(--color-cost)]/30 text-[var(--color-cost)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                  }`}
                  title="Sort by Cost"
                >
                  💰
                </button>
                <button
                  onClick={() => onSortByChange("tokens")}
                  className={`h-7 w-7 text-xs font-medium transition-colors flex items-center justify-center ${
                    sortBy === "tokens"
                      ? "bg-[var(--color-claude-coral)]/30 text-[var(--color-claude-coral)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
                  }`}
                  title="Sort by Tokens"
                >
                  ⚡
                </button>
              </div>
            )}
            <div className="relative" style={{ width: globeSize, height: globeSize }}>
              <GlobeParticles size={globeSize} />
              <Globe size={globeSize} userCountryCode={userCountryCode} scopeFilter={scopeFilter} />
            </div>
          </div>

          {/* Global Stats - Total Cost & Tokens */}
          <div className="flex items-center justify-center gap-3 py-2">
            <span className="text-base">🌍</span>
            <span className="text-[var(--color-text-muted)]">·</span>
            <div className="flex items-center gap-1.5">
              <span className="text-base">💰</span>
              <span className="text-sm font-semibold text-[var(--color-cost)]">
                ${totalCost >= 1000 ? `${(totalCost / 1000).toFixed(1)}K` : totalCost.toFixed(0)}
              </span>
            </div>
            <span className="text-[var(--color-text-muted)]">·</span>
            <div className="flex items-center gap-1.5">
              <span className="text-base">⚡</span>
              <span className="text-sm font-semibold text-[var(--color-claude-coral)]">
                {totalTokens >= 1_000_000_000
                  ? `${(totalTokens / 1_000_000_000).toFixed(2)}B`
                  : totalTokens >= 1_000_000
                    ? `${(totalTokens / 1_000_000).toFixed(1)}M`
                    : totalTokens.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Top Countries */}
          {countryStats.length > 0 && (
            <div className="glass rounded-xl border border-[var(--border-default)] p-3">
              <TopCountriesSection
                stats={countryStats}
                totalTokens={totalTokens}
                totalCost={totalCost}
                sortBy={sortBy}
                userCountryCode={userCountryCode}
                maxItems={10}
                compact={true}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
