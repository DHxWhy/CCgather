'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// ============================================
// Types
// ============================================

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'link'
  | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
}

// ============================================
// Styles
// ============================================

const baseStyles = cn(
  'inline-flex items-center justify-center gap-2',
  'font-medium rounded-full',
  'transition-all duration-200',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  'focus-visible:ring-[var(--color-claude-coral)]',
  'disabled:opacity-50 disabled:pointer-events-none',
  'active:scale-[0.97]'
);

const variantStyles: Record<ButtonVariant, string> = {
  primary: cn(
    'bg-gradient-to-r from-[var(--color-claude-coral)] to-[var(--color-claude-rust)]',
    'text-white',
    'hover:shadow-[var(--glow-primary)]',
    'hover:brightness-110'
  ),
  secondary: cn(
    'bg-[var(--glass-bg)]',
    'border border-[var(--border-default)]',
    'text-[var(--color-text-primary)]',
    'hover:bg-[var(--color-bg-card-hover)]',
    'hover:border-[var(--border-hover)]'
  ),
  outline: cn(
    'bg-transparent',
    'border border-[var(--color-claude-coral)]/50',
    'text-[var(--color-claude-coral)]',
    'hover:bg-[var(--color-claude-coral)]/10',
    'hover:border-[var(--color-claude-coral)]'
  ),
  ghost: cn(
    'bg-transparent',
    'text-[var(--color-text-secondary)]',
    'hover:bg-[var(--glass-bg)]',
    'hover:text-[var(--color-text-primary)]'
  ),
  link: cn(
    'bg-transparent',
    'text-[var(--color-claude-coral)]',
    'hover:underline underline-offset-4',
    'p-0 h-auto'
  ),
  danger: cn(
    'bg-[var(--color-error)]',
    'text-white',
    'hover:bg-[var(--color-error)]/90',
    'hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]'
  ),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  xl: 'h-14 px-8 text-lg',
};

// ============================================
// Component
// ============================================

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      leftIcon,
      rightIcon,
      isLoading = false,
      loadingText,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {/* Loading spinner or left icon */}
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}

        {/* Button text */}
        {isLoading && loadingText ? loadingText : children}

        {/* Right icon (hidden when loading) */}
        {!isLoading && rightIcon && (
          <span className="shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
