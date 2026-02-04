/**
 * Translation Utilities
 * Common functions for language detection and translation support
 */

// =====================================================
// Supported Languages
// =====================================================

export const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: "English",
  ko: "Korean",
  ja: "Japanese",
  zh: "Chinese (Simplified)",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
};

// =====================================================
// Country to Language Mapping
// =====================================================

const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  // Korean
  KR: "ko",
  // Japanese
  JP: "ja",
  // Chinese
  CN: "zh",
  TW: "zh",
  HK: "zh",
  // Spanish
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  CL: "es",
  PE: "es",
  VE: "es",
  EC: "es",
  GT: "es",
  CU: "es",
  BO: "es",
  DO: "es",
  HN: "es",
  PY: "es",
  SV: "es",
  NI: "es",
  CR: "es",
  PA: "es",
  UY: "es",
  // French
  FR: "fr",
  BE: "fr",
  CH: "fr",
  CA: "fr", // French Canada
  LU: "fr",
  MC: "fr",
  SN: "fr",
  CI: "fr",
  ML: "fr",
  // German
  DE: "de",
  AT: "de",
  LI: "de",
  // Portuguese
  BR: "pt",
  PT: "pt",
  AO: "pt",
  MZ: "pt",
  // English (no translation needed)
  US: "en",
  GB: "en",
  AU: "en",
  NZ: "en",
  IE: "en",
  ZA: "en",
  IN: "en",
  SG: "en",
  PH: "en",
  MY: "en",
  NG: "en",
  KE: "en",
  GH: "en",
  JM: "en",
  TT: "en",
};

/**
 * Convert country code to language code
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., "KR", "US")
 * @returns ISO 639-1 language code (e.g., "ko", "en")
 */
export function countryToLanguage(countryCode: string | null | undefined): string {
  if (!countryCode) return "en";
  return COUNTRY_LANGUAGE_MAP[countryCode.toUpperCase()] || "en";
}

/**
 * Check if a language code is supported for translation
 */
export function isSupportedLanguage(languageCode: string): boolean {
  return languageCode in SUPPORTED_LANGUAGES;
}

/**
 * Check if a country uses English (no translation needed)
 */
export function isEnglishCountry(countryCode: string | null | undefined): boolean {
  if (!countryCode) return true;
  return countryToLanguage(countryCode) === "en";
}

/**
 * Get display name for a language code
 */
export function getLanguageDisplayName(languageCode: string): string {
  return SUPPORTED_LANGUAGES[languageCode] || "English";
}

// =====================================================
// Language Detection
// =====================================================

/**
 * Detect language from text content
 * @param text - Text to analyze
 * @returns ISO 639-1 language code
 */
export function detectLanguage(text: string): string {
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return "ja";
  if (/[\u4E00-\u9FFF]/.test(text) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "zh";
  if (/[äöüßÄÖÜ]/.test(text)) return "de";
  if (/[éèêëàâùûôîïç]/i.test(text)) return "fr";
  if (/[áéíóúüñ¿¡]/i.test(text)) return "es";
  if (/[ãõáéíóúâêôç]/i.test(text)) return "pt";
  return "en";
}
