/**
 * Format large numbers with K, M, B, T suffixes
 * @example formatNumber(1234567) // "1.2M"
 * @example formatNumber(1234567890000) // "1.2T"
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000_000) {
    return `${(num / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Format cost/currency with K, M suffixes (compact display)
 * @example formatCost(1234) // "$1K"
 * @example formatCost(1234567) // "$1.2M"
 */
export function formatCost(cost: number): string {
  if (cost >= 1_000_000) {
    return `$${(cost / 1_000_000).toFixed(1)}M`;
  }
  if (cost >= 1_000) {
    return `$${(cost / 1_000).toFixed(0)}K`;
  }
  return `$${cost.toFixed(0)}`;
}

/**
 * Format tokens with appropriate suffix
 * @example formatTokens(1234567890) // "1.23B"
 */
export function formatTokens(tokens: number): string {
  return formatNumber(tokens);
}

/**
 * Format USD currency
 * @example formatCurrency(1234.56) // "$1,234.56"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format compact currency with K, M suffixes
 * @example formatCompactCurrency(1234567) // "$1.23M"
 */
export function formatCompactCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(2)}`;
}

/**
 * Format percentage
 * @example formatPercentage(0.1234) // "12.34%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format relative time
 * @example formatRelativeTime(new Date(Date.now() - 3600000)) // "1 hour ago"
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - target.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 30) {
    return target.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
  if (diffDay > 0) {
    return `${diffDay}d ago`;
  }
  if (diffHour > 0) {
    return `${diffHour}h ago`;
  }
  if (diffMin > 0) {
    return `${diffMin}m ago`;
  }
  return "Just now";
}
