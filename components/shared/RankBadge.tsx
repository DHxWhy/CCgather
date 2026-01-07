'use client';

import clsx from 'clsx';

interface RankBadgeProps {
  rank: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

function getRankConfig(rank: number): {
  emoji: string;
  label: string;
  bg: string;
  glow?: string;
} {
  if (rank === 1) {
    return {
      emoji: '👑',
      label: 'Champion',
      bg: 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30',
      glow: 'shadow-lg shadow-yellow-500/20',
    };
  }
  if (rank === 2) {
    return {
      emoji: '🥈',
      label: '2nd Place',
      bg: 'bg-gradient-to-r from-gray-300/20 to-gray-400/20 border-gray-400/30',
    };
  }
  if (rank === 3) {
    return {
      emoji: '🥉',
      label: '3rd Place',
      bg: 'bg-gradient-to-r from-orange-600/20 to-orange-700/20 border-orange-600/30',
    };
  }
  if (rank <= 10) {
    return {
      emoji: '🏅',
      label: 'Top 10',
      bg: 'bg-accent-purple/10 border-accent-purple/20',
    };
  }
  if (rank <= 100) {
    return {
      emoji: '🎖️',
      label: 'Top 100',
      bg: 'bg-accent-blue/10 border-accent-blue/20',
    };
  }
  return {
    emoji: '',
    label: '',
    bg: 'bg-white/5 border-white/10',
  };
}

const sizeStyles = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-3 py-1',
  lg: 'text-base px-4 py-1.5',
};

const emojiSizeStyles = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-xl',
};

export function RankBadge({
  rank,
  size = 'md',
  showLabel = false,
  className,
}: RankBadgeProps) {
  const config = getRankConfig(rank);

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        sizeStyles[size],
        config.bg,
        config.glow,
        className
      )}
    >
      {config.emoji && (
        <span className={emojiSizeStyles[size]}>{config.emoji}</span>
      )}
      <span className="text-text-primary">#{rank}</span>
      {showLabel && config.label && (
        <span className="text-text-muted">· {config.label}</span>
      )}
    </div>
  );
}

export default RankBadge;
