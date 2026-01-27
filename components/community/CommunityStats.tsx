"use client";

import { memo, type ReactNode } from "react";
import { Users, MessageSquare, Languages } from "lucide-react";
import { cn } from "@/lib/utils";

// ===========================================
// Types
// ===========================================

interface CommunityStatsProps {
  membersCount: number;
  onlineCount: number;
  postsToday: number;
  languagesCount: number;
  compact?: boolean;
  className?: string;
}

interface StatItem {
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
}

// ===========================================
// CommunityStats Component
// For left sidebar in community mode
// ===========================================

function CommunityStatsComponent({
  membersCount,
  onlineCount,
  postsToday,
  languagesCount,
  compact = false,
  className,
}: CommunityStatsProps) {
  const stats: StatItem[] = [
    {
      icon: <Users className="w-3 h-3" />,
      label: "Members",
      value: membersCount.toLocaleString(),
      color: "text-[var(--color-text-primary)]",
    },
    {
      icon: <span className="text-[10px]">🟢</span>,
      label: "Online",
      value: onlineCount.toLocaleString(),
      color: "text-emerald-400",
    },
    {
      icon: <MessageSquare className="w-3 h-3" />,
      label: "Posts today",
      value: postsToday.toLocaleString(),
      color: "text-[var(--color-claude-coral)]",
    },
    {
      icon: <Languages className="w-3 h-3" />,
      label: "Languages",
      value: languagesCount.toLocaleString(),
      color: "text-[var(--color-accent-cyan)]",
    },
  ];

  return (
    <div className={cn("space-y-3", className)}>
      {/* Stats Grid */}
      <div className={cn("space-y-2", compact && "space-y-1.5")}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn("flex items-center justify-between", compact ? "text-[10px]" : "text-xs")}
          >
            <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
              {stat.icon}
              {stat.label}
            </span>
            <span className={cn("font-semibold tabular-nums", stat.color)}>{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Export memoized component
const CommunityStats = memo(CommunityStatsComponent);
export default CommunityStats;
