"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Github, Users, ShieldCheck, Bell } from "lucide-react";
import Link from "next/link";

interface AgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: (profileConsent: boolean, integrityConsent: boolean) => void;
  isSubmitting?: boolean;
}

export function AgreementModal({ isOpen, onClose, onAgree, isSubmitting }: AgreementModalProps) {
  const [profileConsent, setProfileConsent] = useState(false);
  const [notificationConsent, setNotificationConsent] = useState(false);
  const [integrityInput, setIntegrityInput] = useState("");

  const integrityAgreed = integrityInput.toLowerCase() === "agree";
  const canProceed = profileConsent && notificationConsent && integrityAgreed;

  const handleSubmit = () => {
    if (canProceed) {
      onAgree(profileConsent, integrityAgreed);
    }
  };

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
                    Join CCgather
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-[var(--color-text-muted)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content - Dense */}
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                {/* 1. Profile Visibility */}
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                    <Github className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                    Public Profile
                  </p>
                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors bg-[var(--color-bg-tertiary)] ${profileConsent ? "border-green-500" : "border-[var(--border-default)] hover:border-primary/50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={profileConsent}
                      onChange={(e) => setProfileConsent(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center flex-shrink-0 ${profileConsent ? "bg-green-500 border-green-500" : "border-[var(--border-default)] bg-[var(--color-bg-card)]"}`}
                    >
                      {profileConsent && (
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
                      I agree to display my GitHub profile publicly
                    </span>
                  </label>
                </div>

                {/* 2. Platform Notifications */}
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                    <Bell className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                    Platform Notifications
                  </p>
                  <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] rounded-lg p-2.5">
                    <p className="text-[var(--color-text-secondary)] mb-1.5">You may receive:</p>
                    <div className="space-y-0.5">
                      <span className="block">• Important service announcements</span>
                      <span className="block">• Major feature updates</span>
                      <span className="block">• Account-related notifications</span>
                    </div>
                  </div>
                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${notificationConsent ? "border-green-500" : "border-[var(--border-default)] hover:border-primary/50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={notificationConsent}
                      onChange={(e) => setNotificationConsent(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center flex-shrink-0 ${notificationConsent ? "bg-green-500 border-green-500" : "border-[var(--border-default)] bg-[var(--color-bg-card)]"}`}
                    >
                      {notificationConsent && (
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
                      I agree to receive platform notifications
                    </span>
                  </label>
                </div>

                {/* 3. Data Integrity */}
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                    Data Integrity
                  </p>
                  <div className="text-xs bg-red-500/15 border border-red-500/40 rounded-lg p-3">
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg leading-none">🚨</span>
                      <div>
                        <p className="text-red-400 font-medium">
                          Manipulating usage data may result in:
                        </p>
                        <p className="text-red-400/80 mt-1">
                          • Claude Code malfunction • Account suspension
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--color-bg-tertiary)]">
                    <p className="text-xs text-[var(--color-text-primary)] mb-2">
                      I promise not to manipulate my usage data
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mb-2">
                      Type &quot;agree&quot; to confirm
                    </p>
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
                  By joining, you agree to our{" "}
                  <Link href="/terms" target="_blank" className="underline hover:text-primary">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" className="underline hover:text-primary">
                    Privacy Policy
                  </Link>
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
                      <span>Joining...</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      <span>Join the Community</span>
                    </>
                  )}
                </button>

                {!canProceed && (
                  <p className="text-[10px] text-center text-[var(--color-text-muted)] mt-2">
                    {!profileConsent && "☐ Profile • "}
                    {!notificationConsent && "☐ Notifications • "}
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
