'use client';

import { Zap } from 'lucide-react';
import clsx from 'clsx';

interface TokenDisplayProps {
  tokens: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

function formatTokens(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toLocaleString();
}

function getTokenTier(tokens: number): {
  color: string;
  label: string;
} {
  if (tokens >= 10_000_000) {
    return { color: 'text-yellow-400', label: 'Legendary' };
  }
  if (tokens >= 1_000_000) {
    return { color: 'text-accent-purple', label: 'Elite' };
  }
  if (tokens >= 100_000) {
    return { color: 'text-accent-blue', label: 'Power User' };
  }
  if (tokens >= 10_000) {
    return { color: 'text-accent-green', label: 'Active' };
  }
  return { color: 'text-text-secondary', label: 'Starter' };
}

const sizeStyles = {
  sm: {
    container: 'text-xs',
    icon: 'w-3 h-3',
    value: 'text-sm font-medium',
  },
  md: {
    container: 'text-sm',
    icon: 'w-4 h-4',
    value: 'text-lg font-semibold',
  },
  lg: {
    container: 'text-base',
    icon: 'w-5 h-5',
    value: 'text-2xl font-bold',
  },
};

export function TokenDisplay({
  tokens,
  size = 'md',
  showIcon = true,
  showLabel = false,
  animated = false,
  className,
}: TokenDisplayProps) {
  const tier = getTokenTier(tokens);
  const styles = sizeStyles[size];

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5',
        styles.container,
        className
      )}
    >
      {showIcon && (
        <Zap
          className={clsx(
            styles.icon,
            tier.color,
            animated && 'animate-pulse'
          )}
        />
      )}
      <span className={clsx(styles.value, tier.color)}>
        {formatTokens(tokens)}
      </span>
      {showLabel && (
        <span className="text-text-muted">tokens</span>
      )}
    </div>
  );
}

export function TokenComparison({
  current,
  previous,
  size = 'md',
}: {
  current: number;
  previous: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const diff = current - previous;
  const percentage = previous > 0 ? ((diff / previous) * 100).toFixed(1) : '0';
  const isPositive = diff >= 0;

  return (
    <div className="inline-flex items-center gap-2">
      <TokenDisplay tokens={current} size={size} />
      <span
        className={clsx(
          'text-xs',
          isPositive ? 'text-accent-green' : 'text-accent-red'
        )}
      >
        {isPositive ? '↑' : '↓'} {Math.abs(diff).toLocaleString()} ({percentage}%)
      </span>
    </div>
  );
}

export default TokenDisplay;
