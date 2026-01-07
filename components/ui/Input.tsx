'use client';

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

// ============================================
// Types
// ============================================

export type InputSize = 'sm' | 'md' | 'lg';
export type InputState = 'default' | 'error' | 'success';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  state?: InputState;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  helperText?: string;
  errorMessage?: string;
  successMessage?: string;
  label?: string;
  fullWidth?: boolean;
}

// ============================================
// Styles
// ============================================

const baseStyles = cn(
  'w-full rounded-xl',
  'bg-[var(--color-bg-card)]',
  'border border-[var(--border-default)]',
  'text-[var(--color-text-primary)]',
  'placeholder:text-[var(--color-text-disabled)]',
  'transition-all duration-200',
  'focus:outline-none',
  'focus:border-[var(--border-focus)]',
  'focus:ring-2 focus:ring-[var(--color-claude-coral)]/20',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'disabled:bg-[var(--color-bg-elevated)]'
);

const sizeStyles: Record<InputSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-4 text-base',
};

const stateStyles: Record<InputState, string> = {
  default: '',
  error: cn(
    'border-[var(--color-error)]',
    'focus:border-[var(--color-error)]',
    'focus:ring-[var(--color-error)]/20'
  ),
  success: cn(
    'border-[var(--color-success)]',
    'focus:border-[var(--color-success)]',
    'focus:ring-[var(--color-success)]/20'
  ),
};

const iconSizes: Record<InputSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

// ============================================
// Component
// ============================================

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      size = 'md',
      state = 'default',
      leftIcon,
      rightIcon,
      helperText,
      errorMessage,
      successMessage,
      label,
      fullWidth = true,
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';

    // Determine current state message
    const message = state === 'error' ? errorMessage : state === 'success' ? successMessage : helperText;

    // Icon padding adjustments
    const hasLeftIcon = !!leftIcon;
    const hasRightIcon = !!rightIcon || isPassword || state !== 'default';

    const leftPadding = hasLeftIcon
      ? size === 'sm'
        ? 'pl-8'
        : size === 'md'
        ? 'pl-10'
        : 'pl-12'
      : '';

    const rightPadding = hasRightIcon
      ? size === 'sm'
        ? 'pr-8'
        : size === 'md'
        ? 'pr-10'
        : 'pr-12'
      : '';

    return (
      <div className={cn('relative', fullWidth && 'w-full')}>
        {/* Label */}
        {label && (
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {label}
          </label>
        )}

        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <span
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2',
                'text-[var(--color-text-muted)]',
                'pointer-events-none'
              )}
            >
              {leftIcon}
            </span>
          )}

          {/* Input */}
          <input
            ref={ref}
            type={isPassword && showPassword ? 'text' : type}
            disabled={disabled}
            className={cn(
              baseStyles,
              sizeStyles[size],
              stateStyles[state],
              leftPadding,
              rightPadding,
              className
            )}
            {...props}
          />

          {/* Right Icons Container */}
          <div
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2',
              'flex items-center gap-2'
            )}
          >
            {/* State Icons */}
            {state === 'error' && (
              <AlertCircle
                size={iconSizes[size]}
                className="text-[var(--color-error)]"
              />
            )}
            {state === 'success' && (
              <CheckCircle
                size={iconSizes[size]}
                className="text-[var(--color-success)]"
              />
            )}

            {/* Password Toggle */}
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={cn(
                  'text-[var(--color-text-muted)]',
                  'hover:text-[var(--color-text-secondary)]',
                  'transition-colors duration-200',
                  'focus:outline-none'
                )}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff size={iconSizes[size]} />
                ) : (
                  <Eye size={iconSizes[size]} />
                )}
              </button>
            )}

            {/* Custom Right Icon */}
            {rightIcon && !isPassword && state === 'default' && (
              <span className="text-[var(--color-text-muted)]">{rightIcon}</span>
            )}
          </div>
        </div>

        {/* Helper/Error/Success Message */}
        {message && (
          <p
            className={cn(
              'mt-1.5 text-xs',
              state === 'error' && 'text-[var(--color-error)]',
              state === 'success' && 'text-[var(--color-success)]',
              state === 'default' && 'text-[var(--color-text-muted)]'
            )}
          >
            {message}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
