import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminCardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export function AdminCard({ children, className, padding = "md", hover = false }: AdminCardProps) {
  const paddingClasses = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      className={cn(
        // Glass background with blur
        "bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]",
        // Border
        "border border-[var(--glass-border)]",
        // Border radius
        "rounded-xl",
        // Padding
        paddingClasses[padding],
        // Hover effect
        hover &&
          "transition-all duration-300 hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--border-hover)]",
        className
      )}
    >
      {children}
    </div>
  );
}
