"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, ShieldCheck, Globe, Languages } from "lucide-react";
import Link from "next/link";
import { TextShimmer } from "@/components/ui/TextShimmer";
import type { AgreementTexts } from "@/app/api/translate/agreement/route";

// =====================================================
// Types
// =====================================================

interface AgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: (profileConsent: boolean, integrityConsent: boolean) => void;
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
  communityParticipation: "Community Participation",
  byJoiningYouAgree: "By joining, you agree to:",
  displayGitHubProfile: "Display your GitHub profile on the public leaderboard",
  receiveAnnouncements: "Receive important service announcements",
  receiveUpdates: "Receive major feature updates & account notifications",
  agreeToParticipate: "I agree to participate in the community",
  dataIntegrity: "Data Integrity",
  manipulatingWarningTitle: "Manipulating usage data may result in:",
  manipulatingWarningContent: "Claude Code malfunction \u2022 Account suspension",
  promiseNotToManipulate: "I promise not to manipulate my usage data",
  typeAgreeToConfirm: 'Type "agree" to confirm',
  termsAndPrivacy: "By joining, you agree to our Terms and Privacy Policy",
  joiningButton: "Joining...",
  joinCommunityButton: "Join the Community",
  communityIncomplete: "Community",
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
  const [communityConsent, setCommunityConsent] = useState(false);
  const [integrityInput, setIntegrityInput] = useState("");
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

  const integrityAgreed = integrityInput.toLowerCase() === "agree";
  const canProceed = communityConsent && integrityAgreed;

  // Get current texts (translated or original)
  const texts =
    !showOriginal && translationState.translations ? translationState.translations : ORIGINAL_TEXTS;

  // Fetch translation when country changes
  const fetchTranslation = useCallback(async (countryCode: string) => {
    // Increment count using ref (won't recreate callback)
    requestCountRef.current += 1;
    const currentCount = requestCountRef.current;

    // Update abuse state for UI
    const remaining = BLOCK_THRESHOLD - currentCount;
    const nowBlocked = currentCount >= BLOCK_THRESHOLD;

    setAbuseState({
      isBlocked: nowBlocked,
      remainingChanges: remaining,
    });

    // If blocked, show English only
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

    // Show loading state
    setTranslationState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    // Track loading start time for minimum shimmer visibility
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

      // Debug log for translation response
      if (data.isOriginal && data.targetLanguage !== "en") {
        console.warn("[AgreementModal] Translation returned original for non-English:", {
          countryCode,
          targetLanguage: data.targetLanguage,
          error: data.error,
          fromCache: data.fromCache,
        });
      }

      // Ensure minimum loading time for shimmer visibility
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

      // Still wait minimum time on error for consistent UX
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
  }, []); // No dependencies - uses ref for count

  // Effect: Fetch translation on country change
  useEffect(() => {
    if (isOpen && selectedCountry) {
      // Immediately show loading (prevents stale translation flash)
      setTranslationState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));
      // Then fetch translation
      fetchTranslation(selectedCountry);
    } else if (!selectedCountry) {
      // Reset to original if no country selected
      setTranslationState({
        isLoading: false,
        isOriginal: true,
        translations: null,
        targetLanguage: "en",
        error: null,
      });
    }
  }, [isOpen, selectedCountry, fetchTranslation]);

  // Reset showOriginal when translations change
  useEffect(() => {
    setShowOriginal(false);
  }, [translationState.translations]);

  const handleSubmit = () => {
    if (canProceed) {
      onAgree(communityConsent, integrityAgreed);
    }
  };

  const handleToggleLanguage = () => {
    setShowOriginal((prev) => !prev);
  };

  // Check if translation toggle should be shown
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
              {/* Header - Compact */}
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
                  {/* Language Toggle Button */}
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

              {/* Translation error notice (for debugging) */}
              {translationState.error && !translationState.isLoading && (
                <div className="px-4 py-2 text-[10px] text-center bg-red-500/10 text-red-300 border-b border-red-500/20">
                  ⚠️ Translation unavailable: {translationState.error}
                </div>
              )}

              {/* Content - Dense */}
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                {/* 1. Community Participation (Profile + Communications) */}
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                    <Globe className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                    {translationState.isLoading ? (
                      <TextShimmer lines={1} className="w-32" variant="compact" />
                    ) : (
                      texts.communityParticipation
                    )}
                  </p>
                  <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] rounded-lg p-2.5">
                    {translationState.isLoading ? (
                      <TextShimmer lines={4} variant="compact" />
                    ) : (
                      <>
                        <p className="text-[var(--color-text-secondary)] mb-1.5">
                          {texts.byJoiningYouAgree}
                        </p>
                        <div className="space-y-0.5">
                          <span className="block">• {texts.displayGitHubProfile}</span>
                          <span className="block">• {texts.receiveAnnouncements}</span>
                          <span className="block">• {texts.receiveUpdates}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${communityConsent ? "border-green-500" : "border-[var(--border-default)] hover:border-primary/50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={communityConsent}
                      onChange={(e) => setCommunityConsent(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center flex-shrink-0 ${communityConsent ? "bg-green-500 border-green-500" : "border-[var(--border-default)] bg-[var(--color-bg-card)]"}`}
                    >
                      {communityConsent && (
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
                        texts.agreeToParticipate
                      )}
                    </span>
                  </label>
                </div>

                {/* 3. Data Integrity */}
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                    {translationState.isLoading ? (
                      <TextShimmer lines={1} className="w-24" variant="compact" />
                    ) : (
                      texts.dataIntegrity
                    )}
                  </p>
                  <div className="text-xs bg-red-500/15 border border-red-500/40 rounded-lg p-3">
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg leading-none">🚨</span>
                      <div>
                        {translationState.isLoading ? (
                          <TextShimmer lines={2} variant="compact" />
                        ) : (
                          <>
                            <p className="text-red-400 font-medium">
                              {texts.manipulatingWarningTitle}
                            </p>
                            <p className="text-red-400/80 mt-1">
                              • {texts.manipulatingWarningContent}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--color-bg-tertiary)]">
                    {translationState.isLoading ? (
                      <TextShimmer lines={2} className="mb-2" variant="compact" />
                    ) : (
                      <>
                        <p className="text-xs text-[var(--color-text-primary)] mb-2">
                          {texts.promiseNotToManipulate}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mb-2">
                          {texts.typeAgreeToConfirm}
                        </p>
                      </>
                    )}
                    <div className="relative">
                      {/* Visual placeholder - won't be translated */}
                      {!integrityInput && (
                        <span
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)] font-mono pointer-events-none notranslate"
                          translate="no"
                          lang="en"
                        >
                          agree
                        </span>
                      )}
                      <input
                        type="text"
                        value={integrityInput}
                        onChange={(e) => setIntegrityInput(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border-2 bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] focus:outline-none transition-colors ${
                          integrityAgreed
                            ? "border-green-500/50"
                            : integrityInput.length > 0
                              ? "border-amber-500/50"
                              : "border-[var(--border-default)] focus:border-primary"
                        }`}
                      />
                      {integrityAgreed && (
                        <svg
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>

                {/* Terms & Privacy - Inline */}
                <p className="text-[10px] text-[var(--color-text-muted)] text-center pt-2 border-t border-[var(--border-default)]">
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
                </p>
              </div>

              {/* Footer - Compact */}
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
                  <p className="text-[10px] text-center text-[var(--color-text-muted)] mt-2">
                    {!communityConsent && `☐ ${texts.communityIncomplete} • `}
                    {!integrityAgreed && (
                      <span className="notranslate" translate="no">
                        ☐ Type &quot;agree&quot;
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
