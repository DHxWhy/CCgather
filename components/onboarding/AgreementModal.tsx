"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Sparkles, Languages } from "lucide-react";
import Link from "next/link";
import { TextShimmer } from "@/components/ui/TextShimmer";
import type { AgreementTexts } from "@/app/api/translate/agreement/route";

// =====================================================
// Types
// =====================================================

interface AgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * essentialConsent — required. Covers profile_visibility + community_updates.
   * marketingConsent — optional. Maps to marketing_consent (default false).
   * (integrity_agreed is now rolled into Terms; the caller marks it true on join.)
   */
  onAgree: (essentialConsent: boolean, marketingConsent: boolean) => void;
  isSubmitting?: boolean;
  /** Selected country code for translation */
  selectedCountry?: string | null;
}

interface TranslationState {
  isLoading: boolean;
  isOriginal: boolean;
  translations: AgreementTexts | null;
  targetLanguage: string;
  error: string | null;
}

// Abuse prevention constants
const WARNING_THRESHOLD = 5;
const BLOCK_THRESHOLD = 10;
// Minimum loading time for shimmer visibility (ms) - matches community translation shimmer
const MIN_LOADING_TIME = 1000;

// =====================================================
// Original English Texts (Fallback)
// =====================================================

const ORIGINAL_TEXTS: AgreementTexts = {
  joinTitle: "Join CCgather",
  essentialTitle: "What you're joining",
  essentialBullet1: "Your GitHub profile will appear on the public leaderboard",
  essentialBullet2: "You'll get essential service updates (security, account, outages)",
  essentialConsentLabel: "I agree to participate and receive essential updates",
  marketingTitle: "Stay in the loop",
  marketingOptionalBadge: "Optional",
  marketingDescription: "Occasional product news, new features, and community highlights.",
  marketingConsentLabel: "Send me product updates and tips",
  integrityNotice:
    "By joining, you agree not to manipulate your usage data. See our Terms for details.",
  termsAndPrivacy: "By joining, you agree to our Terms and Privacy Policy",
  joiningButton: "Joining...",
  joinCommunityButton: "Join the Community",
  essentialIncomplete: "Please agree to the essential terms above to continue",
};

// =====================================================
// Component
// =====================================================

export function AgreementModal({
  isOpen,
  onClose,
  onAgree,
  isSubmitting,
  selectedCountry,
}: AgreementModalProps) {
  const [essentialConsent, setEssentialConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  // Abuse prevention - use ref to avoid infinite loop in useCallback
  const requestCountRef = useRef(0);
  const [abuseState, setAbuseState] = useState({
    isBlocked: false,
    remainingChanges: BLOCK_THRESHOLD,
  });

  // Translation state
  const [translationState, setTranslationState] = useState<TranslationState>({
    isLoading: false,
    isOriginal: true,
    translations: null,
    targetLanguage: "en",
    error: null,
  });

  // Only the essential checkbox gates the Join button. Marketing is opt-in
  // and does NOT block progress (legally required separation per GDPR/KR/CCPA).
  const canProceed = essentialConsent;

  // Get current texts (translated or original)
  const texts =
    !showOriginal && translationState.translations ? translationState.translations : ORIGINAL_TEXTS;

  // Fetch translation when country changes
  const fetchTranslation = useCallback(async (countryCode: string) => {
    requestCountRef.current += 1;
    const currentCount = requestCountRef.current;

    const remaining = BLOCK_THRESHOLD - currentCount;
    const nowBlocked = currentCount >= BLOCK_THRESHOLD;

    setAbuseState({
      isBlocked: nowBlocked,
      remainingChanges: remaining,
    });

    if (nowBlocked) {
      setTranslationState({
        isLoading: false,
        isOriginal: true,
        translations: null,
        targetLanguage: "en",
        error: null,
      });
      return;
    }

    setTranslationState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    const loadingStartTime = Date.now();

    try {
      const response = await fetch("/api/translate/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode }),
      });

      if (!response.ok) {
        throw new Error("Translation request failed");
      }

      const data = await response.json();

      if (data.isOriginal && data.targetLanguage !== "en") {
        console.warn("[AgreementModal] Translation returned original for non-English:", {
          countryCode,
          targetLanguage: data.targetLanguage,
          error: data.error,
          fromCache: data.fromCache,
        });
      }

      const elapsed = Date.now() - loadingStartTime;
      if (elapsed < MIN_LOADING_TIME) {
        await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
      }

      setTranslationState({
        isLoading: false,
        isOriginal: data.isOriginal,
        translations: data.translations,
        targetLanguage: data.targetLanguage,
        error: data.error || null,
      });
    } catch (error) {
      console.error("[AgreementModal] Translation error:", error);

      const elapsed = Date.now() - loadingStartTime;
      if (elapsed < MIN_LOADING_TIME) {
        await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
      }

      setTranslationState({
        isLoading: false,
        isOriginal: true,
        translations: null,
        targetLanguage: "en",
        error: error instanceof Error ? error.message : "Translation failed",
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen && selectedCountry) {
      setTranslationState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));
      fetchTranslation(selectedCountry);
    } else if (!selectedCountry) {
      setTranslationState({
        isLoading: false,
        isOriginal: true,
        translations: null,
        targetLanguage: "en",
        error: null,
      });
    }
  }, [isOpen, selectedCountry, fetchTranslation]);

  useEffect(() => {
    setShowOriginal(false);
  }, [translationState.translations]);

  const handleSubmit = () => {
    if (canProceed) {
      onAgree(essentialConsent, marketingConsent);
    }
  };

  const handleToggleLanguage = () => {
    setShowOriginal((prev) => !prev);
  };

  const showLanguageToggle = !translationState.isOriginal && translationState.translations !== null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[var(--color-text-secondary)]" />
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {translationState.isLoading ? (
                      <TextShimmer lines={1} className="w-24" variant="compact" />
                    ) : (
                      texts.joinTitle
                    )}
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  {showLanguageToggle && (
                    <button
                      onClick={handleToggleLanguage}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[var(--color-text-muted)] hover:bg-white/10 hover:text-[var(--color-text-secondary)] transition-colors"
                      title={showOriginal ? "View Translation" : "View Original"}
                    >
                      <Languages className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {showOriginal ? "View Translation" : "View Original"}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-[var(--color-text-muted)]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Gentle reminder for frequent country changes */}
              {(abuseState.remainingChanges <= BLOCK_THRESHOLD - WARNING_THRESHOLD ||
                abuseState.isBlocked) && (
                <div
                  className={`px-4 py-2.5 text-xs text-center ${
                    abuseState.isBlocked
                      ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] border-b border-[var(--border-default)]"
                      : "bg-amber-500/10 text-amber-300 border-b border-amber-500/20"
                  }`}
                >
                  {abuseState.isBlocked ? (
                    <>
                      🌍 English only mode
                      <br />
                      <span className="text-[10px] opacity-80">
                        Pick your country and click Join!
                      </span>
                    </>
                  ) : (
                    <>💡 {abuseState.remainingChanges} country changes left</>
                  )}
                </div>
              )}

              {translationState.error && !translationState.isLoading && (
                <div className="px-4 py-2 text-[10px] text-center bg-red-500/10 text-red-300 border-b border-red-500/20">
                  ⚠️ Translation unavailable: {translationState.error}
                </div>
              )}

              {/* Content */}
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* Essential consent (REQUIRED) */}
                <section className="space-y-2">
                  <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                    {translationState.isLoading ? (
                      <TextShimmer lines={1} className="w-32" variant="compact" />
                    ) : (
                      texts.essentialTitle
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] rounded-lg p-3 space-y-1.5">
                    {translationState.isLoading ? (
                      <TextShimmer lines={2} variant="compact" />
                    ) : (
                      <>
                        <div>• {texts.essentialBullet1}</div>
                        <div>• {texts.essentialBullet2}</div>
                      </>
                    )}
                  </div>
                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${essentialConsent ? "border-green-500" : "border-[var(--border-default)] hover:border-primary/50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={essentialConsent}
                      onChange={(e) => setEssentialConsent(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center flex-shrink-0 ${essentialConsent ? "bg-green-500 border-green-500" : "border-[var(--border-default)] bg-[var(--color-bg-card)]"}`}
                    >
                      {essentialConsent && (
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs text-[var(--color-text-primary)]">
                      {translationState.isLoading ? (
                        <TextShimmer lines={1} className="w-48" variant="compact" />
                      ) : (
                        texts.essentialConsentLabel
                      )}
                    </span>
                  </label>
                </section>

                {/* Marketing opt-in (OPTIONAL — does not block submission) */}
                <section className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                      {translationState.isLoading ? (
                        <TextShimmer lines={1} className="w-32" variant="compact" />
                      ) : (
                        texts.marketingTitle
                      )}
                    </div>
                    <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wide rounded bg-white/[0.06] text-[var(--color-text-muted)] border border-[var(--border-default)]">
                      {translationState.isLoading ? "…" : texts.marketingOptionalBadge}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] px-1">
                    {translationState.isLoading ? (
                      <TextShimmer lines={1} variant="compact" />
                    ) : (
                      texts.marketingDescription
                    )}
                  </div>
                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${marketingConsent ? "border-primary/60" : "border-[var(--border-default)] hover:border-primary/40"}`}
                  >
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center flex-shrink-0 ${marketingConsent ? "bg-primary border-primary" : "border-[var(--border-default)] bg-[var(--color-bg-card)]"}`}
                    >
                      {marketingConsent && (
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs text-[var(--color-text-primary)]">
                      {translationState.isLoading ? (
                        <TextShimmer lines={1} className="w-48" variant="compact" />
                      ) : (
                        texts.marketingConsentLabel
                      )}
                    </span>
                  </label>
                </section>

                {/* Integrity notice — neutral one-liner, no scary box */}
                <div className="text-[11px] leading-relaxed text-[var(--color-text-muted)] px-1">
                  {translationState.isLoading ? (
                    <TextShimmer lines={1} variant="compact" />
                  ) : (
                    <>
                      {texts.integrityNotice.replace(/See our Terms.*$/, "")}
                      <Link href="/terms" target="_blank" className="underline hover:text-primary">
                        Terms
                      </Link>
                      .
                    </>
                  )}
                </div>

                {/* Terms & Privacy footer */}
                <div className="text-[10px] text-[var(--color-text-muted)] text-center pt-2 border-t border-[var(--border-default)]">
                  {translationState.isLoading ? (
                    <TextShimmer lines={1} className="mx-auto w-48" variant="compact" />
                  ) : (
                    <>
                      {texts.termsAndPrivacy.split("Terms")[0]}
                      <Link href="/terms" target="_blank" className="underline hover:text-primary">
                        Terms
                      </Link>
                      {" and "}
                      <Link
                        href="/privacy"
                        target="_blank"
                        className="underline hover:text-primary"
                      >
                        Privacy Policy
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[var(--border-default)] bg-[var(--color-bg-tertiary)] flex-shrink-0">
                <button
                  onClick={handleSubmit}
                  disabled={!canProceed || isSubmitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-[#B85C3D] text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <motion.div
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      <span>{texts.joiningButton}</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      <span>{texts.joinCommunityButton}</span>
                    </>
                  )}
                </button>

                {!canProceed && (
                  <div className="text-[10px] text-center text-[var(--color-text-muted)] mt-2">
                    {translationState.isLoading ? "…" : texts.essentialIncomplete}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
