'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Crown, Medal } from 'lucide-react';

// ============================================
// Types
// ============================================

export type RankPosition = 1 | 2 | 3;

export interface TopThreeCardProps extends HTMLAttributes<HTMLDivElement> {
  rank: RankPosition;
  username: string;
  avatarUrl?: string;
  country?: string;
  countryFlag?: string;
  tokens: string;
  cost: string;
  level?: number;
}

// ============================================
// Rank Styles
// ============================================

const rankStyles: Record<RankPosition, {
  gradient: string;
  glow: string;
  border: string;
  icon: string;
  badge: string;
}> = {
  1: {
    gradient: 'from-yellow-500/20 via-amber-500/10 to-yellow-600/20',
    glow: 'shadow-[0_0_40px_rgba(255,215,0,0.25)]',
    border: 'border-yellow-500/30',
    icon: 'text-yellow-500',
    badge: 'bg-gradient-to-r from-yellow-500 to-amber-500',
  },
  2: {
    gradient: 'from-gray-300/15 via-gray-400/10 to-gray-300/15',
    glow: 'shadow-[0_0_30px_rgba(192,192,192,0.2)]',
    border: 'border-gray-400/30',
    icon: 'text-gray-400',
    badge: 'bg-gradient-to-r from-gray-400 to-gray-500',
  },
  3: {
    gradient: 'from-orange-600/15 via-amber-700/10 to-orange-600/15',
    glow: 'shadow-[0_0_30px_rgba(205,127,50,0.2)]',
    border: 'border-orange-600/30',
    icon: 'text-orange-600',
    badge: 'bg-gradient-to-r from-orange-600 to-amber-700',
  },
};

// ============================================
// Component
// ============================================

export const TopThreeCard = forwardRef<HTMLDivElement, TopThreeCardProps>(
  (
    {
      className,
      rank,
      username,
      avatarUrl,
      country,
      countryFlag,
      tokens,
      cost,
      level,
      ...props
    },
    ref
  ) => {
    const styles = rankStyles[rank];
    const isFirst = rank === 1;

    return (
      <div
        ref={ref}
        className={cn(
          'relative group',
          // Size - 1st place is larger
          isFirst ? 'w-full md:w-[280px]' : 'w-full md:w-[240px]',
          className
        )}
        {...props}
      >
        {/* Glow background */}
        <div
          className={cn(
            'absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500',
            `bg-gradient-to-br ${styles.gradient}`,
            styles.glow
          )}
        />

        {/* Card */}
        <div
          className={cn(
            'relative p-6 rounded-2xl',
            'bg-[var(--color-bg-card)]',
            'border-2',
            styles.border,
            'transition-all duration-300',
            'group-hover:translate-y-[-4px]'
          )}
        >
          {/* Crown/Medal for 1st place */}
          {isFirst && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  styles.badge
                )}
              >
                <Crown size={18} className="text-white" />
              </div>
            </div>
          )}

          {/* Rank Badge */}
          <div
            className={cn(
              'absolute -top-3 -right-3 w-10 h-10 rounded-full',
              'flex items-center justify-center',
              'text-white font-bold text-lg',
              styles.badge,
              styles.glow
            )}
          >
            {rank}
          </div>

          {/* Avatar */}
          <div className="flex justify-center mb-4">
            <div
              className={cn(
                'relative',
                isFirst ? 'w-20 h-20' : 'w-16 h-16'
              )}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username}
                  className={cn(
                    'w-full h-full rounded-full object-cover',
                    'border-2',
                    styles.border
                  )}
                />
              ) : (
                <div
                  className={cn(
                    'w-full h-full rounded-full',
                    'bg-gradient-to-br from-[var(--color-claude-coral)] to-[var(--color-claude-rust)]',
                    'flex items-center justify-center',
                    'text-white font-bold',
                    isFirst ? 'text-2xl' : 'text-xl'
                  )}
                >
                  {username.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Medal indicator */}
              <div
                className={cn(
                  'absolute -bottom-1 -right-1 w-6 h-6 rounded-full',
                  'flex items-center justify-center',
                  'bg-[var(--color-bg-card)]',
                  'border-2',
                  styles.border
                )}
              >
                <Medal size={14} className={styles.icon} />
              </div>
            </div>
          </div>

          {/* Username */}
          <h3
            className={cn(
              'text-center font-bold text-[var(--color-text-primary)]',
              isFirst ? 'text-lg' : 'text-base'
            )}
          >
            {username}
          </h3>

          {/* Country */}
          {(country || countryFlag) && (
            <p className="text-center text-sm text-[var(--color-text-muted)] mt-1">
              {countryFlag} {country}
            </p>
          )}

          {/* Level */}
          {level && (
            <div className="flex justify-center mt-2">
              <span className="text-sm text-[var(--color-text-secondary)]">
                Lv.{level}
              </span>
            </div>
          )}

          {/* Stats */}
          <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[var(--color-text-muted)]">Tokens</span>
              <span className="font-mono font-bold text-[var(--color-text-primary)]">
                {tokens}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--color-text-muted)]">Cost</span>
              <span className="font-mono text-[var(--color-text-secondary)]">
                {cost}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

TopThreeCard.displayName = 'TopThreeCard';

export default TopThreeCard;
