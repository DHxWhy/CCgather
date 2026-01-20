/**
 * Fact Hard Check - Date/Number Extraction and Comparison
 *
 * This module provides hard verification of dates and numbers
 * between original and rewritten content to catch AI hallucinations.
 *
 * Unlike AI self-verification, this uses deterministic regex extraction
 * to ensure factual accuracy of critical data points.
 */

// ===========================================
// Types
// ===========================================

export interface ExtractedDate {
  original: string; // Original text matched
  normalized: string; // Normalized format (YYYY-MM-DD or YYYY)
  year: number;
  month?: number;
  day?: number;
  context: string; // Surrounding text for context
}

export interface ExtractedNumber {
  original: string; // Original text matched
  value: number;
  unit?: string; // e.g., "$", "%", "million", "FLOPS"
  context: string; // Surrounding text for context
}

export interface HardCheckResult {
  passed: boolean;
  score: number; // 0-100
  dateCheck: {
    passed: boolean;
    originalDates: ExtractedDate[];
    rewrittenDates: ExtractedDate[];
    mismatches: DateMismatch[];
  };
  numberCheck: {
    passed: boolean;
    originalNumbers: ExtractedNumber[];
    rewrittenNumbers: ExtractedNumber[];
    mismatches: NumberMismatch[];
  };
  criticalIssues: string[];
  warnings: string[];
}

export interface DateMismatch {
  original: ExtractedDate;
  rewritten: ExtractedDate | null;
  issue: string;
  severity: "critical" | "warning";
}

export interface NumberMismatch {
  original: ExtractedNumber;
  rewritten: ExtractedNumber | null;
  issue: string;
  severity: "critical" | "warning";
}

// ===========================================
// Date Extraction Patterns
// ===========================================

// Various date formats to match
const DATE_PATTERNS = [
  // ISO format: 2026-01-01, 2026/01/01
  /\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/g,

  // US format: January 1, 2026 / Jan 1, 2026 / January 1st, 2026
  /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi,

  // European format: 1 January 2026 / 1st January 2026
  /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?,?\s+(\d{4})\b/gi,

  // Year only with context: "in 2026", "by 2025", "starting 2026"
  /\b(?:in|by|starting|beginning|from|until|through|during)\s+(\d{4})\b/gi,

  // "first day of 2025", "beginning of 2026"
  /\b(?:first\s+day\s+of|beginning\s+of|start\s+of|end\s+of)\s+(\d{4})\b/gi,

  // Quarter references: Q1 2026, Q4 2025
  /\bQ([1-4])\s+(\d{4})\b/gi,

  // Month Year: January 2026, Jan 2026
  /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{4})\b/gi,
];

// Month name to number mapping
const MONTH_MAP: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

// ===========================================
// Number Extraction Patterns
// ===========================================
// Note: Number patterns are implemented inline in extractNumbers()
// for more granular control over extraction logic.
// Supported patterns:
// - Currency: $5, $100 million, $1.5 billion
// - Percentages: 50%, 99.9%
// - Scientific notation: 10^26 FLOPS
// - Day counts: 15-day, 30 days

// ===========================================
// Extraction Functions
// ===========================================

/**
 * Extract all dates from text content
 */
export function extractDates(text: string): ExtractedDate[] {
  const dates: ExtractedDate[] = [];
  const seen = new Set<string>();

  // Clean HTML tags for extraction
  const cleanText = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  for (const pattern of DATE_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(cleanText)) !== null) {
      const original = match[0];

      // Skip if already seen this exact match
      if (seen.has(original.toLowerCase())) continue;
      seen.add(original.toLowerCase());

      // Parse the date
      const parsed = parseDateMatch(match, pattern);
      if (parsed) {
        // Get surrounding context (50 chars before and after)
        const startIdx = Math.max(0, match.index - 50);
        const endIdx = Math.min(cleanText.length, match.index + original.length + 50);
        const context = cleanText.substring(startIdx, endIdx).trim();

        dates.push({
          ...parsed,
          original,
          context,
        });
      }
    }
  }

  return dates;
}

/**
 * Parse a regex match into an ExtractedDate
 */
function parseDateMatch(
  match: RegExpExecArray,
  pattern: RegExp
): Omit<ExtractedDate, "original" | "context"> | null {
  const patternStr = pattern.source;

  // ISO format: 2026-01-01
  if (patternStr.includes("\\d{4})[-\\/](\\d{1,2})[-\\/](\\d{1,2})")) {
    const year = parseInt(match[1]!, 10);
    const month = parseInt(match[2]!, 10);
    const day = parseInt(match[3]!, 10);
    return {
      normalized: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      year,
      month,
      day,
    };
  }

  // US format: January 1, 2026
  if (patternStr.includes("January|February")) {
    const monthName = match[1]?.toLowerCase();
    const day = match[2] ? parseInt(match[2], 10) : undefined;
    const year = parseInt(match[3] || match[2]!, 10);
    const month = monthName ? MONTH_MAP[monthName.replace(".", "")] : undefined;

    if (year > 1900 && year < 2100) {
      return {
        normalized:
          month && day
            ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            : month
              ? `${year}-${String(month).padStart(2, "0")}`
              : `${year}`,
        year,
        month,
        day,
      };
    }
  }

  // Year with context: "in 2026", "by 2025", "starting 2026"
  if (patternStr.includes("in|by|starting")) {
    const year = parseInt(match[1]!, 10);
    if (year > 1900 && year < 2100) {
      return {
        normalized: `${year}`,
        year,
      };
    }
  }

  // "first day of YYYY", "beginning of YYYY" - implies January 1st
  if (patternStr.includes("first\\s+day")) {
    const year = parseInt(match[1]!, 10);
    if (year > 1900 && year < 2100) {
      return {
        normalized: `${year}-01-01`,
        year,
        month: 1, // First day = January
        day: 1,
      };
    }
  }

  // Quarter: Q1 2026
  if (patternStr.includes("Q([1-4])")) {
    const quarter = parseInt(match[1]!, 10);
    const year = parseInt(match[2]!, 10);
    const month = (quarter - 1) * 3 + 1;
    return {
      normalized: `${year}-Q${quarter}`,
      year,
      month,
    };
  }

  // Month Year: January 2026
  if (match[1] && match[2] && !match[3]) {
    const monthName = match[1].toLowerCase().replace(".", "");
    const year = parseInt(match[2], 10);
    const month = MONTH_MAP[monthName];
    if (year > 1900 && year < 2100 && month) {
      return {
        normalized: `${year}-${String(month).padStart(2, "0")}`,
        year,
        month,
      };
    }
  }

  return null;
}

/**
 * Extract all significant numbers from text content
 */
export function extractNumbers(text: string): ExtractedNumber[] {
  const numbers: ExtractedNumber[] = [];
  const seen = new Set<string>();

  // Clean HTML tags
  const cleanText = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // Currency extraction
  const currencyPattern = /\$\s*([\d,]+(?:\.\d+)?)\s*(million|billion|trillion|M|B|K)?/gi;
  let match;
  while ((match = currencyPattern.exec(cleanText)) !== null) {
    const original = match[0];
    if (seen.has(original)) continue;
    seen.add(original);

    let value = parseFloat(match[1]!.replace(/,/g, ""));
    const multiplier = match[2]?.toLowerCase();

    if (multiplier === "million" || multiplier === "m") value *= 1_000_000;
    else if (multiplier === "billion" || multiplier === "b") value *= 1_000_000_000;
    else if (multiplier === "trillion") value *= 1_000_000_000_000;
    else if (multiplier === "k") value *= 1_000;

    const startIdx = Math.max(0, match.index - 30);
    const endIdx = Math.min(cleanText.length, match.index + original.length + 30);

    numbers.push({
      original,
      value,
      unit: "$",
      context: cleanText.substring(startIdx, endIdx).trim(),
    });
  }

  // Percentage extraction
  const percentPattern = /([\d,]+(?:\.\d+)?)\s*%/g;
  while ((match = percentPattern.exec(cleanText)) !== null) {
    const original = match[0];
    if (seen.has(original)) continue;
    seen.add(original);

    const value = parseFloat(match[1]!.replace(/,/g, ""));
    const startIdx = Math.max(0, match.index - 30);
    const endIdx = Math.min(cleanText.length, match.index + original.length + 30);

    numbers.push({
      original,
      value,
      unit: "%",
      context: cleanText.substring(startIdx, endIdx).trim(),
    });
  }

  // Scientific notation (10^26 FLOPS)
  const sciPattern = /10\^(\d+)\s*(FLOPS)?/gi;
  while ((match = sciPattern.exec(cleanText)) !== null) {
    const original = match[0];
    if (seen.has(original)) continue;
    seen.add(original);

    const exponent = parseInt(match[1]!, 10);
    const startIdx = Math.max(0, match.index - 30);
    const endIdx = Math.min(cleanText.length, match.index + original.length + 30);

    numbers.push({
      original,
      value: exponent, // Store exponent as value for comparison
      unit: match[2] ? "FLOPS_EXP" : "EXP",
      context: cleanText.substring(startIdx, endIdx).trim(),
    });
  }

  // Day counts (15-day, 30 days)
  const dayPattern = /(\d+)\s*[-]?\s*(day|days)/gi;
  while ((match = dayPattern.exec(cleanText)) !== null) {
    const original = match[0];
    if (seen.has(original)) continue;
    seen.add(original);

    const value = parseInt(match[1]!, 10);
    const startIdx = Math.max(0, match.index - 30);
    const endIdx = Math.min(cleanText.length, match.index + original.length + 30);

    numbers.push({
      original,
      value,
      unit: "days",
      context: cleanText.substring(startIdx, endIdx).trim(),
    });
  }

  return numbers;
}

// ===========================================
// Comparison Functions
// ===========================================

/**
 * Find the most likely article publication date from extracted dates
 * Looks for common patterns like "Published Date", "Posted on", etc.
 */
function findArticlePublicationDate(dates: ExtractedDate[]): ExtractedDate | null {
  // Look for dates with publication-related context
  const pubPatterns =
    /published|posted|date|article|news|announcement|dec|nov|oct|sep|aug|jul|jun|may|apr|mar|feb|jan/i;

  // Find dates that look like publication dates (usually the earliest or has pub context)
  const candidates = dates.filter((d) => pubPatterns.test(d.context) && d.year >= 2023);

  if (candidates.length > 0) {
    // Return the most recent one as likely publication date
    return candidates.reduce((latest, current) =>
      current.year > latest.year ||
      (current.year === latest.year && (current.month || 0) > (latest.month || 0))
        ? current
        : latest
    );
  }

  // Fallback: return any recent date
  const recentDates = dates.filter((d) => d.year >= 2024);
  return recentDates[0] ?? null;
}

/**
 * Compare dates between original and rewritten content
 */
function compareDates(
  originalDates: ExtractedDate[],
  rewrittenDates: ExtractedDate[]
): { passed: boolean; mismatches: DateMismatch[] } {
  const mismatches: DateMismatch[] = [];

  for (const origDate of originalDates) {
    // Find matching date in rewritten content by year
    const matchingRewritten = rewrittenDates.find((rd) => {
      // Same year and (same month or no month specified)
      if (rd.year === origDate.year) {
        if (origDate.month && rd.month) {
          return origDate.month === rd.month;
        }
        return true;
      }
      return false;
    });

    // Check for year mismatch (critical!)
    const wrongYearMatch = rewrittenDates.find((rd) => {
      // Similar context but different year
      const contextOverlap =
        rd.context.toLowerCase().includes(origDate.context.toLowerCase().slice(0, 20)) ||
        origDate.context.toLowerCase().includes(rd.context.toLowerCase().slice(0, 20));

      return rd.year !== origDate.year && contextOverlap;
    });

    if (wrongYearMatch) {
      mismatches.push({
        original: origDate,
        rewritten: wrongYearMatch,
        issue: `Year mismatch: Original says "${origDate.year}" but rewritten says "${wrongYearMatch.year}"`,
        severity: "critical",
      });
    } else if (!matchingRewritten && origDate.year >= 2024) {
      // Missing recent date (might be important)
      mismatches.push({
        original: origDate,
        rewritten: null,
        issue: `Date "${origDate.original}" from original not found in rewritten content`,
        severity: "warning",
      });
    }
  }

  // Also check for dates in rewritten that don't exist in original (hallucinated dates)
  for (const reDate of rewrittenDates) {
    const existsInOriginal = originalDates.some((od) => od.year === reDate.year);

    if (!existsInOriginal && reDate.year >= 2024) {
      mismatches.push({
        original: { ...reDate, original: "(not in original)", context: "" },
        rewritten: reDate,
        issue: `Hallucinated date: "${reDate.original}" appears in rewritten but not in original`,
        severity: "critical",
      });
    }
  }

  // Contextual check: Detect year-boundary hallucinations
  // When article published in late year mentions a date in early next year with future tense,
  // AI might incorrectly write the current year instead of next year
  // Example: Article from Dec 2025 says "January 1" (meaning 2026) but AI writes "January 2025"
  const articleDate = findArticlePublicationDate(originalDates);
  if (articleDate && articleDate.month && articleDate.month >= 10) {
    // Article from Oct/Nov/Dec
    for (const reDate of rewrittenDates) {
      // If rewritten date is in early months (Jan-Mar) of the SAME year as article
      // but original doesn't explicitly have that year, it's suspicious
      if (reDate.month && reDate.month <= 3 && reDate.year === articleDate.year) {
        // Check if original has this same explicit year+month combo
        const hasExplicitMatch = originalDates.some(
          (od) => od.year === reDate.year && od.month === reDate.month
        );

        if (!hasExplicitMatch) {
          // Check if original content mentions future tense around this date
          const futureTensePatterns = /will|going to|upcoming|takes effect|effective|beginning/i;
          const contextHasFutureTense = futureTensePatterns.test(reDate.context);

          if (contextHasFutureTense) {
            mismatches.push({
              original: {
                ...reDate,
                original: "(contextual inference)",
                context: `Article from ${articleDate.month}/${articleDate.year}`,
              },
              rewritten: reDate,
              issue: `Suspicious year: Article from late ${articleDate.year} mentions "${reDate.original}" with future tense - should likely be ${articleDate.year + 1}`,
              severity: "critical",
            });
          }
        }
      }
    }
  }

  const hasCritical = mismatches.some((m) => m.severity === "critical");

  return {
    passed: !hasCritical,
    mismatches,
  };
}

/**
 * Compare numbers between original and rewritten content
 */
function compareNumbers(
  originalNumbers: ExtractedNumber[],
  rewrittenNumbers: ExtractedNumber[]
): { passed: boolean; mismatches: NumberMismatch[] } {
  const mismatches: NumberMismatch[] = [];

  for (const origNum of originalNumbers) {
    // Find matching number in rewritten content (correct match)
    const matchingRewritten = rewrittenNumbers.find((rn) => {
      // Same unit and similar value
      if (rn.unit === origNum.unit) {
        // Allow 1% tolerance for rounding
        const tolerance = Math.abs(origNum.value * 0.01);
        return Math.abs(rn.value - origNum.value) <= tolerance;
      }
      return false;
    });

    // If correct match exists, no issue with this number
    if (matchingRewritten) {
      continue;
    }

    // Check for value mismatch with same unit (wrong value but similar context)
    const wrongValueMatch = rewrittenNumbers.find((rn) => {
      if (rn.unit === origNum.unit && rn.value !== origNum.value) {
        // Check context similarity
        const contextWords = origNum.context.toLowerCase().split(/\s+/).slice(0, 5);
        return contextWords.some((w) => rn.context.toLowerCase().includes(w));
      }
      return false;
    });

    if (wrongValueMatch) {
      mismatches.push({
        original: origNum,
        rewritten: wrongValueMatch,
        issue: `Number mismatch: Original says "${origNum.original}" but rewritten says "${wrongValueMatch.original}"`,
        severity: origNum.unit === "$" || origNum.unit === "%" ? "critical" : "warning",
      });
    }
  }

  const hasCritical = mismatches.some((m) => m.severity === "critical");

  return {
    passed: !hasCritical,
    mismatches,
  };
}

// ===========================================
// Main Hard Check Function
// ===========================================

/**
 * Perform hard fact check on original vs rewritten content
 *
 * This function extracts dates and numbers from both texts
 * and compares them to detect AI hallucinations.
 */
export function performHardCheck(
  originalContent: string,
  rewrittenContent: string
): HardCheckResult {
  // Extract dates from both
  const originalDates = extractDates(originalContent);
  const rewrittenDates = extractDates(rewrittenContent);

  // Extract numbers from both
  const originalNumbers = extractNumbers(originalContent);
  const rewrittenNumbers = extractNumbers(rewrittenContent);

  // Compare dates
  const dateComparison = compareDates(originalDates, rewrittenDates);

  // Compare numbers
  const numberComparison = compareNumbers(originalNumbers, rewrittenNumbers);

  // Collect issues
  const criticalIssues: string[] = [];
  const warnings: string[] = [];

  for (const mismatch of dateComparison.mismatches) {
    if (mismatch.severity === "critical") {
      criticalIssues.push(mismatch.issue);
    } else {
      warnings.push(mismatch.issue);
    }
  }

  for (const mismatch of numberComparison.mismatches) {
    if (mismatch.severity === "critical") {
      criticalIssues.push(mismatch.issue);
    } else {
      warnings.push(mismatch.issue);
    }
  }

  // Calculate score
  // Start at 100, deduct 30 for each critical issue, 10 for each warning
  let score = 100;
  score -= criticalIssues.length * 30;
  score -= warnings.length * 10;
  score = Math.max(0, score);

  const passed = criticalIssues.length === 0;

  return {
    passed,
    score,
    dateCheck: {
      passed: dateComparison.passed,
      originalDates,
      rewrittenDates,
      mismatches: dateComparison.mismatches,
    },
    numberCheck: {
      passed: numberComparison.passed,
      originalNumbers,
      rewrittenNumbers,
      mismatches: numberComparison.mismatches,
    },
    criticalIssues,
    warnings,
  };
}
