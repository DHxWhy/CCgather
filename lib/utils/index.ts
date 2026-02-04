import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with conflict resolution
 * @example cn("px-2 py-1", "px-4") // "py-1 px-4"
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Re-export all format utilities
export {
  formatNumber,
  formatCost,
  formatTokens,
  formatCurrency,
  formatCompactCurrency,
  formatPercentage,
  formatRelativeTime,
} from "./format";

// Re-export translation utilities
export {
  SUPPORTED_LANGUAGES,
  countryToLanguage,
  isSupportedLanguage,
  isEnglishCountry,
  getLanguageDisplayName,
  detectLanguage,
} from "./translation";
