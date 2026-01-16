import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminCard } from "./AdminCard";

interface AdminStatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "default" | "primary" | "success" | "warning" | "error";
  className?: string;
}

export function AdminStatCard({
  title,
  value,
  icon,
  trend,
  trendValue,
  color = "default",
  className,
}: AdminStatCardProps) {
  const colorClasses = {
    default: "text-[var(--color-text-primary)]",
    primary: "text-[var(--color-claude-coral)]",
    success: "text-[var(--color-success)]",
    warning: "text-[var(--color-warning)]",
    error: "text-[var(--color-error)]",
  };

  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendColor =
    trend === "up"
      ? "text-[var(--color-success)]"
      : trend === "down"
        ? "text-[var(--color-error)]"
        : "text-[var(--color-text-muted)]";

  return (
    <AdminCard className={cn("relative overflow-hidden", className)} hover>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">{title}</p>
          <p className={cn("text-3xl font-bold font-mono", colorClasses[color])}>{value}</p>
          {(trend || trendValue) && (
            <div className={cn("flex items-center gap-1 mt-2 text-sm", trendColor)}>
              <span className="font-mono">{trendIcon}</span>
              {trendValue && <span>{trendValue}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-lg",
              "bg-[var(--color-bg-elevated)]",
              colorClasses[color]
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </AdminCard>
  );
}
