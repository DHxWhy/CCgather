"use client";

import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";
import { CCPLAN_CONFIG, type CCPlanFilter } from "@/lib/types/leaderboard";

interface CCplanTabsProps {
  value: CCPlanFilter;
  onChange: (value: CCPlanFilter) => void;
}

// Team tab hidden until we confirm Team/Enterprise subscription detection
const CCPLAN_ORDER: CCPlanFilter[] = ["all", "max", "pro", "free"];

export function CCplanTabs({ value, onChange }: CCplanTabsProps) {
  const [showInfo, setShowInfo] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowInfo(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div className="flex p-0.5 sm:p-1 bg-[var(--color-filter-bg)] border border-[var(--border-default)] rounded-lg gap-0.5 sm:gap-1">
        {/* ALL tab */}
        <button
          onClick={() => onChange("all")}
          className={`px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
            value === "all"
              ? "bg-[var(--color-filter-active)] text-[var(--color-text-primary)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
          }`}
        >
          <span>🛸</span>
          <span>All League</span>
        </button>

        {/* Tier tabs */}
        {CCPLAN_ORDER.filter((tier) => tier !== "all").map((tier) => {
          const config = CCPLAN_CONFIG[tier as Exclude<CCPlanFilter, "all">];
          const isActive = value === tier;
          const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);

          return (
            <button
              key={tier}
              onClick={() => onChange(tier)}
              className={`px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                isActive
                  ? "text-white"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)]"
              }`}
              style={{
                backgroundColor: isActive ? config.color : undefined,
              }}
            >
              <span>{config.icon}</span>
              <span>{tierName}</span>
            </button>
          );
        })}
      </div>

      {/* Info Button with Popover */}
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setShowInfo(!showInfo)}
          className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-filter-hover)] transition-colors"
          aria-label="League rules info"
        >
          <Info className="w-4 h-4" />
        </button>

        {showInfo && (
          <div
            ref={popoverRef}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 p-4 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-xl z-50"
          >
            {/* Header */}
            <div className="mb-3 pb-2 border-b border-[var(--border-default)]">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                League Placement Rules
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Fair competition by subscription tier
              </p>
            </div>

            {/* Rules */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">1.</span>
                <div>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    Opus Usage = Max
                  </span>
                  <p className="text-[var(--color-text-muted)] mt-0.5">
                    Opus 4.5 detected → automatically Max league
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 font-bold shrink-0">2.</span>
                <div>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    Recent Data (≤30 days)
                  </span>
                  <p className="text-[var(--color-text-muted)] mt-0.5">
                    Uses your current subscription plan
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400 font-bold shrink-0">3.</span>
                <div>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    Older Data (&gt;30 days)
                  </span>
                  <p className="text-[var(--color-text-muted)] mt-0.5">
                    You choose: Pro or Free (trust-based)
                  </p>
                </div>
              </div>
            </div>

            {/* Why 30 days */}
            <div className="mt-3 pt-2 border-t border-[var(--border-default)]">
              <p className="text-[10px] text-[var(--color-text-muted)]">
                <span className="font-medium">Why 30 days?</span> Claude Code sessions don&apos;t
                store plan history, so older data relies on self-reporting.
              </p>
            </div>

            {/* Tip */}
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
              <span>💡</span>
              <span>Submit regularly for accurate tracking!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CCplanTabs;
