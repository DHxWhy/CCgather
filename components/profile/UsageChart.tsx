'use client';

import { useMemo } from 'react';

interface UsageDataPoint {
  date: string;
  tokens: number;
}

interface UsageChartProps {
  data: UsageDataPoint[];
  height?: number;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function UsageChart({ data, height = 200 }: UsageChartProps) {
  const chartData = useMemo(() => {
    if (data.length === 0) return { bars: [], maxValue: 0, labels: [] };

    const maxValue = Math.max(...data.map((d) => d.tokens), 1);
    const bars = data.map((d) => ({
      date: d.date,
      tokens: d.tokens,
      height: (d.tokens / maxValue) * 100,
    }));

    // Get evenly spaced labels
    const labelCount = Math.min(7, data.length);
    const step = Math.floor(data.length / labelCount);
    const labels = data
      .filter((_, i) => i % step === 0 || i === data.length - 1)
      .map((d) => formatDate(d.date));

    return { bars, maxValue, labels };
  }, [data]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-muted"
        style={{ height }}
      >
        No usage data available
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-text-primary">Token Usage</h3>
        <span className="text-xs text-text-muted">Last 30 days</span>
      </div>

      <div className="relative" style={{ height }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-6 w-12 flex flex-col justify-between text-[10px] text-text-muted">
          <span>{formatNumber(chartData.maxValue)}</span>
          <span>{formatNumber(chartData.maxValue / 2)}</span>
          <span>0</span>
        </div>

        {/* Chart area */}
        <div className="ml-14 h-full pb-6 relative">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div className="border-b border-white/5 h-0" />
            <div className="border-b border-white/5 h-0" />
            <div className="border-b border-white/5 h-0" />
          </div>

          {/* Bars */}
          <div className="relative h-full flex items-end gap-[2px]">
            {chartData.bars.map((bar) => (
              <div
                key={bar.date}
                className="flex-1 group relative"
                style={{ height: '100%' }}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 bg-primary/60 hover:bg-primary transition-colors rounded-t cursor-pointer"
                  style={{ height: `${bar.height}%`, minHeight: bar.tokens > 0 ? 2 : 0 }}
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-bg-elevated rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="font-medium text-text-primary">
                      {formatNumber(bar.tokens)}
                    </div>
                    <div className="text-text-muted">{formatDate(bar.date)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* X-axis labels */}
          <div className="absolute left-0 right-0 bottom-0 flex justify-between text-[10px] text-text-muted">
            {chartData.labels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UsageChart;
