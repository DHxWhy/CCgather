"use client";

import { CCPLAN_CONFIG, type CCPlanFilter } from "@/lib/types/leaderboard";

interface CCplanTabsProps {
  value: CCPlanFilter;
  onChange: (value: CCPlanFilter) => void;
}

// Team tab hidden until we confirm Team/Enterprise subscription detection
const CCPLAN_ORDER: CCPlanFilter[] = ["all", "max", "pro", "free"];

export function CCplanTabs({ value, onChange }: CCplanTabsProps) {
  return (
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
  );
}

export default CCplanTabs;
