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
  userCountryCode,
  scopeFilter,
}: MobileGlobePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchCurrentX, setTouchCurrentX] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Dynamic sizing based on screen orientation
  const [panelWidth, setPanelWidth] = useState(300);
  const [globeSize, setGlobeSize] = useState(240);

  const SWIPE_THRESHOLD = 80; // px to trigger close

  // Update sizes based on screen dimensions and orientation
  useEffect(() => {
    const updateSizes = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isLandscape = width > height;

      if (isLandscape && width >= 600) {
        // Landscape mode: wider panel, larger globe
        setPanelWidth(Math.min(420, Math.floor(width * 0.55)));
        setGlobeSize(Math.min(300, Math.floor(height * 0.45)));
      } else {
        // Portrait mode: default sizes
        setPanelWidth(Math.min(300, Math.floor(width * 0.85)));
        setGlobeSize(240);
      }
    };

    updateSizes();
    window.addEventListener("resize", updateSizes);
    window.addEventListener("orientationchange", updateSizes);
    return () => {
      window.removeEventListener("resize", updateSizes);
      window.removeEventListener("orientationchange", updateSizes);
    };
  }, []);

  // Calculate drag offset
  const dragOffset = isDragging && touchStartX !== null && touchCurrentX !== null
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

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    if (touch) {
      setTouchCurrentX(touch.clientX);
    }
  }, [isDragging]);

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

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 left-0 h-full z-50 bg-[var(--color-bg-primary)] border-r border-[var(--border-default)] shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: panelWidth,
          transform: isOpen
            ? `translateX(${dragOffset}px)`
            : "translateX(-100%)",
          transition: isDragging ? "none" : "transform 0.3s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <span>🌍</span>
            Global Stats
          </h2>
          <span className="text-xs text-[var(--color-text-muted)]">
            ← 스와이프로 닫기
          </span>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-60px)] overflow-y-auto p-4 space-y-4">
          {/* Globe */}
          <div className="relative flex justify-center">
            <div className="relative" style={{ width: globeSize, height: globeSize }}>
              <GlobeParticles size={globeSize} />
              <Globe
                size={globeSize}
                userCountryCode={userCountryCode}
                scopeFilter={scopeFilter}
              />
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
