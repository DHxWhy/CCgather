"use client";

import { memo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { TrustTier } from "@/types/tools";

// =====================================================
// Types
// =====================================================

interface Voter {
  user_id: string;
  username: string;
  avatar_url: string | null;
  trust_tier: TrustTier;
  weight: number;
  comment?: string | null;
}

interface VoterPreviewProps {
  voters: Voter[];
  totalVotes: number;
  showCount?: number;
  size?: "sm" | "md";
  className?: string;
}

// =====================================================
// Trust Tier Border Colors
// =====================================================

const tierBorderColors: Record<TrustTier, string> = {
  elite: "ring-2 ring-yellow-500/70",
  power_user: "ring-2 ring-slate-400/50",
  verified: "ring-1 ring-emerald-500/50",
  member: "",
};

// =====================================================
// Component
// =====================================================

function VoterPreviewComponent({
  voters,
  totalVotes,
  showCount = 5,
  size = "sm",
  className,
}: VoterPreviewProps) {
  const displayVoters = voters.slice(0, showCount);
  const remainingCount = Math.max(0, totalVotes - showCount);

  const avatarSize = size === "sm" ? 20 : 24;
  const avatarClass = size === "sm" ? "w-5 h-5" : "w-6 h-6";
  const fontSize = size === "sm" ? "text-[8px]" : "text-[10px]";
  const spacing = size === "sm" ? "-ml-1.5" : "-ml-2";

  if (displayVoters.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center", className)}>
      {/* Avatar Stack */}
      <div className="flex items-center">
        {displayVoters.map((voter, index) => (
          <div
            key={voter.user_id}
            className={cn(
              avatarClass,
              "rounded-full overflow-hidden",
              "border-2 border-[var(--color-bg-card)]",
              tierBorderColors[voter.trust_tier],
              index > 0 && spacing
            )}
            style={{ zIndex: showCount - index }}
            title={`@${voter.username} (${voter.trust_tier})`}
          >
            {voter.avatar_url ? (
              <Image
                src={voter.avatar_url}
                alt={voter.username}
                width={avatarSize}
                height={avatarSize}
                className="object-cover"
                unoptimized
              />
            ) : (
              <div
                className={cn(
                  "w-full h-full flex items-center justify-center",
                  "bg-[var(--color-bg-elevated)]",
                  fontSize,
                  "font-medium text-[var(--color-text-muted)]"
                )}
              >
                {voter.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ))}

        {/* Remaining Count */}
        {remainingCount > 0 && (
          <div
            className={cn(
              avatarClass,
              "rounded-full flex items-center justify-center",
              "bg-[var(--color-bg-elevated)]",
              "border-2 border-[var(--color-bg-card)]",
              fontSize,
              "font-medium text-[var(--color-text-muted)]",
              spacing
            )}
            style={{ zIndex: 0 }}
          >
            +{remainingCount > 99 ? "99+" : remainingCount}
          </div>
        )}
      </div>

      {/* Label */}
      <span className={cn("ml-2 text-[var(--color-text-muted)]", fontSize)}>
        {totalVotes === 1 ? "1명 추천" : `${totalVotes}명 추천`}
      </span>
    </div>
  );
}

export default memo(VoterPreviewComponent);
