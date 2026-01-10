"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Github, Users, Mail, Bell, ExternalLink } from "lucide-react";
import Link from "next/link";

interface AgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: (profileConsent: boolean, communityConsent: boolean) => void;
  isSubmitting?: boolean;
}

export function AgreementModal({ isOpen, onClose, onAgree, isSubmitting }: AgreementModalProps) {
  const [profileConsent, setProfileConsent] = useState(false);
  const [communityConsent, setCommunityConsent] = useState(false);

  const canProceed = profileConsent && communityConsent;

  const handleAgreeAll = () => {
    setProfileConsent(true);
    setCommunityConsent(true);
  };

  const handleSubmit = () => {
    if (canProceed) {
      onAgree(profileConsent, communityConsent);
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
            <div className="w-full max-w-lg bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Developer Network Agreement
                    </h2>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Join the global developer community
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* Intro */}
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    CCGather is a <strong>developer networking community</strong> where developers
                    discover and connect with each other through their Claude Code usage.
                  </p>
                </div>

                {/* Profile Visibility Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                    <Github className="w-4 h-4 text-primary" />
                    Public Developer Profile
                  </div>

                  <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--border-default)] rounded-xl space-y-2">
                    <p className="text-xs text-[var(--color-text-muted)] mb-3">
                      The following information will be visible to other developers:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        GitHub profile (required)
                      </div>
                      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        Usage statistics & rank
                      </div>
                      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30" />X (Twitter) -
                        optional
                      </div>
                      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        Earned badges
                      </div>
                      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                        LinkedIn - optional
                      </div>
                      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        Country & level
                      </div>
                    </div>
                  </div>

                  {/* Profile consent checkbox */}
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-default)] hover:border-primary/50 cursor-pointer transition-colors group">
                    <div className="relative flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={profileConsent}
                        onChange={(e) => setProfileConsent(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-5 h-5 rounded border-2 border-[var(--border-default)] bg-[var(--color-bg-card)] peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                        {profileConsent && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-primary transition-colors">
                        I agree to make my developer profile visible
                      </span>
                      <span className="ml-2 text-xs text-primary">[Required]</span>
                    </div>
                  </label>
                </div>

                {/* Community Updates Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                    <Bell className="w-4 h-4 text-primary" />
                    Community Updates
                  </div>

                  <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--border-default)] rounded-xl space-y-2">
                    <p className="text-xs text-[var(--color-text-muted)] mb-3">
                      As a community member, you will receive:
                    </p>
                    <div className="grid grid-cols-1 gap-2 text-xs">
                      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <Mail className="w-3.5 h-3.5 text-primary" />
                        Weekly rankings & personal insights
                      </div>
                      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <Mail className="w-3.5 h-3.5 text-primary" />
                        Developer news & opportunities
                      </div>
                      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <Mail className="w-3.5 h-3.5 text-primary" />
                        Feature announcements & community highlights
                      </div>
                    </div>
                  </div>

                  {/* Community consent checkbox */}
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-default)] hover:border-primary/50 cursor-pointer transition-colors group">
                    <div className="relative flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={communityConsent}
                        onChange={(e) => setCommunityConsent(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-5 h-5 rounded border-2 border-[var(--border-default)] bg-[var(--color-bg-card)] peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                        {communityConsent && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-primary transition-colors">
                        I agree to receive community updates
                      </span>
                      <span className="ml-2 text-xs text-primary">[Required]</span>
                    </div>
                  </label>
                </div>

                {/* Terms & Privacy */}
                <div className="pt-2 border-t border-[var(--border-default)]">
                  <p className="text-xs text-[var(--color-text-muted)] text-center">
                    By joining, you also agree to our{" "}
                    <Link
                      href="/terms"
                      target="_blank"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Terms of Service <ExternalLink className="w-3 h-3" />
                    </Link>{" "}
                    and{" "}
                    <Link
                      href="/privacy"
                      target="_blank"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Privacy Policy <ExternalLink className="w-3 h-3" />
                    </Link>
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-[var(--border-default)] bg-[var(--color-bg-tertiary)] space-y-3">
                {/* Agree All */}
                <button
                  onClick={handleAgreeAll}
                  disabled={canProceed}
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-primary border border-primary/30 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ✓ Agree to All
                </button>

                {/* Join Button */}
                <button
                  onClick={handleSubmit}
                  disabled={!canProceed || isSubmitting}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-[#B85C3D] text-white font-semibold hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <motion.div
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      <span>Joining Community...</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-5 h-5" />
                      <span>Join the Community</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
