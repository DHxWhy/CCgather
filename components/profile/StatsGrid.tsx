'use client';

import { TrendingUp, DollarSign, Trophy, Zap } from 'lucide-react';

interface StatsGridProps {
  rank: number;
  totalTokens: number;
  totalSpent: number;
  modelBreakdown?: Record<string, number>;
  percentile?: number;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toString();
}

function getMainModel(breakdown: Record<string, number>): string {
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return 'N/A';

  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const firstEntry = sorted[0];
  if (!firstEntry) return 'N/A';
  const model = firstEntry[0];

  // Shorten model name
  return model
    .replace('claude-', '')
    .replace(/-\d{8}$/, '')
    .replace('3-5-', '3.5-')
    .replace('3-', '');
}

export function StatsGrid({
  rank,
  totalTokens,
  totalSpent,
  modelBreakdown = {},
  percentile,
}: StatsGridProps) {
  const stats = [
    {
      label: 'Global Rank',
      value: `#${rank}`,
      subtext: percentile ? `Top ${percentile.toFixed(1)}%` : undefined,
      icon: Trophy,
      color: 'text-accent-yellow',
    },
    {
      label: 'Total Tokens',
      value: formatNumber(totalTokens),
      subtext: 'All time usage',
      icon: Zap,
      color: 'text-accent-blue',
    },
    {
      label: 'Total Spent',
      value: `$${totalSpent.toFixed(2)}`,
      subtext: 'API costs',
      icon: DollarSign,
      color: 'text-accent-green',
    },
    {
      label: 'Favorite Model',
      value: getMainModel(modelBreakdown),
      subtext: 'Most used',
      icon: TrendingUp,
      color: 'text-accent-purple',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="p-4 rounded-xl bg-bg-card border border-white/5 hover:border-white/10 transition-colors"
        >
          <div className="flex items-center gap-2 mb-2">
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
            <span className="text-xs text-text-muted">{stat.label}</span>
          </div>
          <div className="text-xl font-semibold text-text-primary">
            {stat.value}
          </div>
          {stat.subtext && (
            <div className="text-[10px] text-text-muted mt-1">{stat.subtext}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default StatsGrid;
