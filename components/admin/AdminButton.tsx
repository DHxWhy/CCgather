"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: ReactNode;
}

export function AdminButton({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: AdminButtonProps) {
  const baseClasses =
    "font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses = {
    primary: cn(
      "bg-gradient-to-r from-[var(--color-claude-coral)] via-[var(--color-claude-terracotta)] to-[var(--color-claude-rust)]",
      "text-white shadow-[var(--shadow-md)]",
      "hover:shadow-[var(--glow-primary)] hover:scale-105",
      "active:scale-100"
    ),
    secondary: cn(
      "bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]",
      "border border-[var(--glass-border)]",
      "text-[var(--color-text-primary)]",
      "hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--border-hover)]"
    ),
    danger: cn(
      "bg-[var(--color-error)]",
      "text-white shadow-[var(--shadow-md)]",
      "hover:bg-[var(--color-error)]/90 hover:shadow-lg",
      "active:scale-95"
    ),
    ghost: cn(
      "bg-transparent",
      "text-[var(--color-text-primary)]",
      "hover:bg-[var(--glass-bg)]",
      "active:bg-[var(--color-bg-card)]"
    ),
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
}
