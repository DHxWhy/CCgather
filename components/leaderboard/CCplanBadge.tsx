"use client";

import { useState } from "react";
import { CCPLAN_CONFIG, type CCPlanFilter } from "@/lib/types/leaderboard";

interface CCplanBadgeProps {
  ccplan: Exclude<CCPlanFilter, "all"> | null | undefined;
  size?: "sm" | "md" | "lg";
}

export function CCplanBadge({ ccplan, size = "md" }: CCplanBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (!ccplan) return null;

  const config = CCPLAN_CONFIG[ccplan];
  if (!config) return null;

  const sizeClasses = {
    sm: "text-[9px] px-1.5 py-0.5",
    md: "text-[10px] px-2 py-0.5",
    lg: "text-xs px-2.5 py-1",
  };

  const iconSizes = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className={`inline-flex items-center gap-1 rounded font-medium cursor-default ${sizeClasses[size]}`}
        style={{
          backgroundColor: `${config.color}20`,
          color: config.color,
        }}
      >
        <span className={iconSizes[size]}>{config.icon}</span>
        <span className="uppercase">{ccplan}</span>
      </span>

      {/* Tooltip popover */}
      {isHovered && (
        <div className="absolute left-0 top-full mt-1 z-50 px-2 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-xl whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{config.icon}</span>
            <span className="text-xs font-medium text-[var(--color-text-primary)]">
              {config.name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CCplanBadge;
