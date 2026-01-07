'use client';

import Link from 'next/link';
import Image from 'next/image';
import { LeaderboardUser } from './LeaderboardTable';

interface UserRowProps {
  user: LeaderboardUser;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

function getRankDisplay(rank: number): { text: string; className: string } {
  if (rank === 1) return { text: '🥇', className: 'text-2xl' };
  if (rank === 2) return { text: '🥈', className: 'text-xl' };
  if (rank === 3) return { text: '🥉', className: 'text-xl' };
  return { text: `#${rank}`, className: 'text-sm text-text-secondary' };
}

function getTierBadge(tier: string): { bg: string; text: string } {
  const defaultTier = { bg: 'bg-white/5', text: 'Free' };
  const tiers: Record<string, { bg: string; text: string }> = {
    free: defaultTier,
    pro: { bg: 'bg-accent-blue/20 text-accent-blue', text: 'Pro' },
    team: { bg: 'bg-accent-purple/20 text-accent-purple', text: 'Team' },
    enterprise: { bg: 'bg-primary/20 text-primary', text: 'Enterprise' },
  };
  const tierKey = tier.toLowerCase();
  const tierValue = tiers[tierKey];
  return tierValue !== undefined ? tierValue : defaultTier;
}

function getCountryFlag(country: string | null): string {
  if (!country) return '';

  // Map country codes to flag emojis
  const countryCode = country.toUpperCase();
  if (countryCode.length !== 2) return '';

  const codePoints = countryCode
    .split('')
    .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

export function UserRow({ user }: UserRowProps) {
  const rankDisplay = getRankDisplay(user.rank);
  const tierBadge = getTierBadge(user.tier);
  const flag = getCountryFlag(user.country);

  return (
    <Link
      href={`/u/${user.username}`}
      className={`grid grid-cols-12 gap-2 px-4 py-3 hover:bg-bg-card-hover transition-colors ${
        user.isCurrentUser ? 'bg-primary/5 border-l-2 border-primary' : ''
      }`}
    >
      {/* Rank */}
      <div className="col-span-1 flex items-center justify-center">
        <span className={rankDisplay.className}>{rankDisplay.text}</span>
      </div>

      {/* User */}
      <div className="col-span-4 flex items-center gap-3">
        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-bg-secondary flex-shrink-0">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.username}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary truncate">
              {user.username}
            </span>
            {flag && <span className="text-sm">{flag}</span>}
          </div>
          {user.isCurrentUser && (
            <span className="text-[10px] text-primary">You</span>
          )}
        </div>
      </div>

      {/* Tokens */}
      <div className="col-span-2 flex items-center justify-end">
        <span className="text-sm font-medium text-text-primary">
          {formatNumber(user.totalTokens)}
        </span>
      </div>

      {/* Spent */}
      <div className="col-span-2 flex items-center justify-end">
        <span className="text-sm text-accent-green">
          ${user.totalSpent.toFixed(2)}
        </span>
      </div>

      {/* Tier */}
      <div className="col-span-2 flex items-center justify-center">
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${tierBadge.bg}`}
        >
          {tierBadge.text}
        </span>
      </div>

      {/* Badges */}
      <div className="col-span-1 flex items-center justify-center">
        {user.badges.length > 0 ? (
          <div className="flex items-center gap-0.5">
            {user.badges.slice(0, 3).map((badge, i) => (
              <span key={i} className="text-sm" title={badge}>
                {getBadgeEmoji(badge)}
              </span>
            ))}
            {user.badges.length > 3 && (
              <span className="text-[10px] text-text-muted">
                +{user.badges.length - 3}
              </span>
            )}
          </div>
        ) : (
          <span className="text-text-disabled">-</span>
        )}
      </div>
    </Link>
  );
}

function getBadgeEmoji(badge: string): string {
  const badgeEmojis: Record<string, string> = {
    'first-sync': '🚀',
    'token-1k': '🌱',
    'token-10k': '⚡',
    'token-100k': '💪',
    'token-1m': '💎',
    'token-10m': '🏆',
    'top-100': '🏅',
    'top-10': '🥇',
    'number-one': '👑',
    'opus-user': '🎭',
    'sonnet-user': '🎵',
    'early-adopter': '🌟',
    'big-spender': '💰',
  };
  return badgeEmojis[badge] || '🏅';
}

export default UserRow;
