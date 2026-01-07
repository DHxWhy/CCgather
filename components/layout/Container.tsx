'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
  noPadding?: boolean;
  centered?: boolean;
  children: ReactNode;
}

// ============================================
// Styles
// ============================================

const sizeStyles: Record<ContainerSize, string> = {
  sm: 'max-w-2xl',      // 672px
  md: 'max-w-4xl',      // 896px
  lg: 'max-w-6xl',      // 1152px
  xl: 'max-w-7xl',      // 1280px
  full: 'max-w-full',
};

// ============================================
// Component
// ============================================

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  (
    {
      className,
      size = 'xl',
      noPadding = false,
      centered = true,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'w-full',
          sizeStyles[size],
          centered && 'mx-auto',
          !noPadding && 'px-4 sm:px-6 lg:px-8',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Container.displayName = 'Container';

export default Container;
