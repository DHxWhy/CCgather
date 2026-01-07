'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

const variantStyles = {
  default: 'bg-white/5 text-text-secondary border-white/10',
  success: 'bg-accent-green/10 text-accent-green border-accent-green/20',
  warning: 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/20',
  error: 'bg-accent-red/10 text-accent-red border-accent-red/20',
  info: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
  primary: 'bg-primary/10 text-primary border-primary/20',
};

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', children, className }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center font-medium rounded-full border',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
