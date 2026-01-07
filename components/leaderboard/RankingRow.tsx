'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { RankChangeBadge } from '@/components/ui/Badge';

// ============================================
// Types
// ============================================

export interface RankingRowProps extends HTMLAttributes<HTMLTableRowElement> {
  rank: number;
  username: string;
  avatarUrl?: string;
  country?: string;
  countryFlag?: string;
  level?: number;
  tokens: string;
  cost: string;
  rankChange?: number;
  userId?: string;
}

// ============================================
// Component
// ============================================

export const RankingRow = forwardRef<HTMLTableRowElement, RankingRowProps>(
  (
    {
      className,
      rank,
      username,
      avatarUrl,
      country,
      countryFlag,
      level,
      tokens,
      cost,
      rankChange = 0,
      userId,
      ...props
    },
    ref
  ) => {
    const content = (
      <>
        {/* Rank */}
        <td className="py-4 px-6">
          <span className="text-[var(--color-text-primary)] font-mono font-medium">
            #{rank}
          </span>
        </td>

        {/* User */}
        <td className="py-4 px-6">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={username}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-claude-coral)] to-[var(--color-claude-rust)] flex items-center justify-center text-white font-bold">
                {username.charAt(0).toUpperCase()}
              </div>
            )}

            {/* User info */}
            <div>
              <div className="font-medium text-[var(--color-text-primary)]">
                {username}
              </div>
              {(country || countryFlag) && (
                <div className="text-sm text-[var(--color-text-muted)]">
                  {countryFlag} {country && `@${username.toLowerCase()}`}
                </div>
              )}
            </div>
          </div>
        </td>

        {/* Level */}
        <td className="py-4 px-6">
          {level && (
            <span className="text-[var(--color-text-primary)]">
              Lv.{level}
            </span>
          )}
        </td>

        {/* Tokens */}
        <td className="py-4 px-6 text-right">
          <span className="text-[var(--color-text-primary)] font-mono">
            {tokens}
          </span>
        </td>

        {/* Cost */}
        <td className="py-4 px-6 text-right">
          <span className="text-[var(--color-text-primary)] font-mono">
            {cost}
          </span>
        </td>

        {/* Rank Change */}
        <td className="py-4 px-6 text-right">
          <RankChangeBadge change={rankChange} size="sm" />
        </td>
      </>
    );

    return (
      <tr
        ref={ref}
        className={cn(
          'group relative',
          'border-b border-[var(--border-default)]',
          'transition-all duration-200',
          'hover:bg-[var(--color-bg-card-hover)]',
          userId && 'cursor-pointer',
          className
        )}
        {...props}
      >
        {/* Left highlight bar on hover */}
        <td className="absolute left-0 top-0 bottom-0 w-0.5 p-0">
          <div
            className={cn(
              'h-full',
              'bg-gradient-to-b from-[var(--color-claude-coral)] to-[var(--color-claude-rust)]',
              'opacity-0 group-hover:opacity-100',
              'transition-opacity duration-300'
            )}
          />
        </td>

        {userId ? (
          <Link
            href={`/u/${username}`}
            className="contents"
          >
            {content}
          </Link>
        ) : (
          content
        )}
      </tr>
    );
  }
);

RankingRow.displayName = 'RankingRow';

export default RankingRow;
