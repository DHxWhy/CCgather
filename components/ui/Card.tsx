'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

export type CardVariant = 'default' | 'glass' | 'glow' | 'ranking' | 'elevated';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hoverable?: boolean;
  clickable?: boolean;
  noPadding?: boolean;
  children: ReactNode;
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

// ============================================
// Styles
// ============================================

const baseStyles = cn('relative rounded-2xl', 'transition-all duration-300');

const variantStyles: Record<CardVariant, string> = {
  default: cn(
    'bg-[var(--color-bg-card)]',
    'border border-[var(--border-default)]'
  ),
  glass: cn(
    'bg-[var(--glass-bg)]',
    'backdrop-blur-xl',
    'border border-[var(--glass-border)]'
  ),
  glow: cn(
    'bg-[var(--color-bg-card)]',
    'border border-[var(--color-claude-coral)]/20',
    'shadow-[var(--glow-primary)]'
  ),
  ranking: cn(
    'bg-[var(--color-bg-secondary)]',
    'border border-[var(--border-default)]',
    'rounded-xl'
  ),
  elevated: cn(
    'bg-[var(--color-bg-elevated)]',
    'border border-[var(--border-default)]',
    'shadow-[var(--shadow-md)]'
  ),
};

const hoverStyles: Record<CardVariant, string> = {
  default: cn(
    'hover:border-[var(--border-hover)]',
    'hover:bg-[var(--color-bg-card-hover)]'
  ),
  glass: cn(
    'hover:border-[var(--color-claude-coral)]/30',
    'hover:shadow-[0_0_40px_rgba(218,119,86,0.1)]'
  ),
  glow: cn(
    'hover:border-[var(--color-claude-coral)]/40',
    'hover:shadow-[var(--glow-primary-lg)]'
  ),
  ranking: cn(
    'hover:bg-[var(--color-bg-card)]',
    'hover:border-[var(--color-claude-coral)]/20'
  ),
  elevated: cn(
    'hover:shadow-[var(--shadow-lg)]',
    'hover:border-[var(--border-hover)]'
  ),
};

// ============================================
// Components
// ============================================

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = 'default',
      hoverable = false,
      clickable = false,
      noPadding = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          (hoverable || clickable) && hoverStyles[variant],
          clickable && 'cursor-pointer',
          !noPadding && 'p-6',
          className
        )}
        {...props}
      >
        {/* Ranking left highlight bar */}
        {variant === 'ranking' && (hoverable || clickable) && (
          <div
            className={cn(
              'absolute left-0 top-0 bottom-0 w-1 rounded-l-xl',
              'bg-gradient-to-b from-[var(--color-claude-coral)] to-[var(--color-claude-rust)]',
              'opacity-0 group-hover:opacity-100 transition-opacity duration-300'
            )}
          />
        )}
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card Header
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col gap-1.5', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// Card Content
export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('pt-4', className)} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

// Card Footer
export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center pt-4',
          'border-t border-[var(--border-default)]',
          'mt-4',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

export default Card;
