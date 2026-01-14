"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import type { TrustTier } from "@/types/tools";
import { TRUST_TIER_META } from "@/types/tools";

// =====================================================
// Types
// =====================================================

interface TrustBadgeProps {
  tier: TrustTier;
  size?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

// =====================================================
// Size Configurations
// =====================================================

const sizeConfig = {
  xs: {
    container: "text-[9px]",
    icon: "text-[10px]",
    padding: "px-1 py-0.5",
    gap: "gap-0.5",
  },
  sm: {
    container: "text-[10px]",
    icon: "text-xs",
    padding: "px-1.5 py-0.5",
    gap: "gap-1",
  },
  md: {
    container: "text-xs",
    icon: "text-sm",
    padding: "px-2 py-1",
    gap: "gap-1",
  },
  lg: {
    container: "text-sm",
    icon: "text-base",
    padding: "px-2.5 py-1",
    gap: "gap-1.5",
  },
};

// =====================================================
// Trust Tier Styles
// =====================================================

const tierStyles: Record<TrustTier, string> = {
  elite: cn(
    "bg-gradient-to-r from-yellow-500/20 to-amber-500/20",
    "text-yellow-500",
    "border border-yellow-500/30",
    "shadow-[0_0_8px_rgba(255,215,0,0.3)]"
  ),
  power_user: cn(
    "bg-gradient-to-r from-slate-400/20 to-gray-300/20",
    "text-slate-300",
    "border border-slate-400/30"
  ),
  verified: cn("bg-emerald-500/15", "text-emerald-400", "border border-emerald-500/20"),
  member: cn("bg-zinc-500/10", "text-zinc-400"),
};

// =====================================================
// Component
// =====================================================

function TrustBadgeComponent({ tier, size = "sm", showLabel = false, className }: TrustBadgeProps) {
  const meta = TRUST_TIER_META[tier];
  const config = sizeConfig[size];

  // Member tier shows nothing unless explicitly requested
  if (tier === "member" && !showLabel) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        config.container,
        config.padding,
        config.gap,
        tierStyles[tier],
        className
      )}
      title={`${meta.label} - 투표 가중치 x${meta.weight}`}
    >
      <span className={config.icon}>{meta.emoji}</span>
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
}

export default memo(TrustBadgeComponent);
