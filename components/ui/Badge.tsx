'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ============================================
// Types
// ============================================

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'gold'
  | 'silver'
  | 'bronze';

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  glow?: boolean;
}

// Rank change badge specific props
export interface RankChangeBadgeProps extends Omit<BadgeProps, 'variant'> {
  change: number;
}

// ============================================
// Styles
// ============================================

const baseStyles = cn(
  'inline-flex items-center justify-center gap-1',
  'font-medium rounded-full',
  'transition-all duration-200'
);

const variantStyles: Record<BadgeVariant, string> = {
  default: cn(
    'bg-[var(--glass-bg)]',
    'text-[var(--color-text-secondary)]',
    'border border-[var(--border-default)]'
  ),
  primary: cn(
    'bg-[var(--color-claude-coral)]/10',
    'text-[var(--color-claude-coral)]',
    'border border-[var(--color-claude-coral)]/20'
  ),
  success: cn(
    'bg-[var(--color-success-bg)]',
    'text-[var(--color-success)]',
    'border border-[var(--color-success)]/20'
  ),
  error: cn(
    'bg-[var(--color-error-bg)]',
    'text-[var(--color-error)]',
    'border border-[var(--color-error)]/20'
  ),
  warning: cn(
    'bg-[var(--color-warning-bg)]',
    'text-[var(--color-warning)]',
    'border border-[var(--color-warning)]/20'
  ),
  info: cn(
    'bg-[var(--color-info-bg)]',
    'text-[var(--color-info)]',
    'border border-[var(--color-info)]/20'
  ),
  gold: cn(
    'bg-[var(--color-rank-gold)]/10',
    'text-[var(--color-rank-gold)]',
    'border border-[var(--color-rank-gold)]/30'
  ),
  silver: cn(
    'bg-[var(--color-rank-silver)]/10',
    'text-[var(--color-rank-silver)]',
    'border border-[var(--color-rank-silver)]/30'
  ),
  bronze: cn(
    'bg-[var(--color-rank-bronze)]/10',
    'text-[var(--color-rank-bronze)]',
    'border border-[var(--color-rank-bronze)]/30'
  ),
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'h-5 px-2 text-[10px]',
  md: 'h-6 px-2.5 text-xs',
  lg: 'h-7 px-3 text-sm',
};

const glowStyles: Record<BadgeVariant, string> = {
  default: '',
  primary: 'shadow-[var(--glow-primary)]',
  success: 'shadow-[var(--glow-success)]',
  error: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
  warning: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]',
  info: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',
  gold: 'shadow-[var(--glow-gold)]',
  silver: 'shadow-[var(--glow-silver)]',
  bronze: 'shadow-[var(--glow-bronze)]',
};

// ============================================
// Components
// ============================================

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      icon,
      glow = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          glow && glowStyles[variant],
          className
        )}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// ============================================
// Rank Change Badge Component
// ============================================

export const RankChangeBadge = forwardRef<HTMLSpanElement, RankChangeBadgeProps>(
  ({ change, size = 'sm', className, ...props }, ref) => {
    const iconSize = size === 'sm' ? 12 : size === 'md' ? 14 : 16;

    if (change === 0) {
      return (
        <Badge
          ref={ref}
          variant="default"
          size={size}
          icon={<Minus size={iconSize} />}
          className={className}
          {...props}
        >
          -
        </Badge>
      );
    }

    if (change > 0) {
      return (
        <Badge
          ref={ref}
          variant="success"
          size={size}
          icon={<TrendingUp size={iconSize} />}
          className={className}
          {...props}
        >
          +{change}
        </Badge>
      );
    }

    return (
      <Badge
        ref={ref}
        variant="error"
        size={size}
        icon={<TrendingDown size={iconSize} />}
        className={className}
        {...props}
      >
        {change}
      </Badge>
    );
  }
);

RankChangeBadge.displayName = 'RankChangeBadge';

export default Badge;
