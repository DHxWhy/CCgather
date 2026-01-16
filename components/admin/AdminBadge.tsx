import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminBadgeProps {
  variant?: "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md";
  children: ReactNode;
  className?: string;
}

export function AdminBadge({
  variant = "neutral",
  size = "md",
  children,
  className,
}: AdminBadgeProps) {
  const variantClasses = {
    success: cn(
      "bg-[var(--color-success-bg)] text-[var(--color-success)]",
      "border-[var(--color-success)]/20"
    ),
    warning: cn(
      "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
      "border-[var(--color-warning)]/20"
    ),
    error: cn(
      "bg-[var(--color-error-bg)] text-[var(--color-error)]",
      "border-[var(--color-error)]/20"
    ),
    info: cn("bg-[var(--color-info-bg)] text-[var(--color-info)]", "border-[var(--color-info)]/20"),
    neutral: cn(
      "bg-[var(--glass-bg)] text-[var(--color-text-secondary)]",
      "border-[var(--glass-border)]"
    ),
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}
