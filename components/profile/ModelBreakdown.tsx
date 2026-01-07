'use client';

interface ModelBreakdownProps {
  breakdown: Record<string, number>;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toString();
}

function getModelColor(model: string): string {
  if (model.includes('opus')) return 'bg-accent-purple';
  if (model.includes('sonnet')) return 'bg-accent-blue';
  if (model.includes('haiku')) return 'bg-accent-green';
  return 'bg-primary';
}

function shortenModelName(model: string): string {
  return model
    .replace('claude-', '')
    .replace(/-\d{8}$/, '')
    .replace('3-5-', '3.5 ')
    .replace('3-', '3 ')
    .replace('-', ' ');
}

export function ModelBreakdown({ breakdown }: ModelBreakdownProps) {
  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  const sortedModels = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sortedModels.length === 0) {
    return (
      <div className="text-center text-text-muted py-4">
        No model usage data
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-text-primary">Model Breakdown</h3>

      <div className="space-y-2">
        {sortedModels.map(([model, tokens]) => {
          const percentage = total > 0 ? (tokens / total) * 100 : 0;
          const color = getModelColor(model);

          return (
            <div key={model} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary capitalize">
                  {shortenModelName(model)}
                </span>
                <span className="text-text-muted">
                  {formatNumber(tokens)} ({percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${color} rounded-full transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {Object.keys(breakdown).length > 5 && (
        <div className="text-xs text-text-muted text-center pt-2">
          +{Object.keys(breakdown).length - 5} more models
        </div>
      )}
    </div>
  );
}

export default ModelBreakdown;
