"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SignIn, SignUp } from "@clerk/nextjs";
import { X, Trophy, Users, Zap } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultView?: "sign-in" | "sign-up";
}

export function AuthModal({ isOpen, onClose, defaultView = "sign-in" }: AuthModalProps) {
  const [view, setView] = useState<"sign-in" | "sign-up">(defaultView);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Container */}
          <motion.div
            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-bg-primary border border-white/[0.08] shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col lg:flex-row min-h-[500px]">
              {/* Left Panel - Branding */}
              <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-8 bg-gradient-to-br from-primary/10 via-transparent to-transparent relative overflow-hidden">
                {/* Background Pattern */}
                <div
                  className="absolute inset-0 opacity-[0.03]"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(218, 119, 86, 0.5) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(218, 119, 86, 0.5) 1px, transparent 1px)
                    `,
                    backgroundSize: "40px 40px",
                  }}
                />

                {/* Glow Effect */}
                <div className="absolute -top-20 -left-20 w-60 h-60 bg-primary/20 rounded-full blur-3xl" />

                <div className="relative z-10">
                  {/* Logo */}
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#B85C3D] flex items-center justify-center">
                      <span className="text-white font-bold text-lg">CC</span>
                    </div>
                    <span className="text-xl font-semibold text-text-primary">CCgather</span>
                  </div>

                  {/* Tagline */}
                  <h2 className="text-2xl font-bold text-text-primary mb-4">
                    Join the{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#E8A087]">
                      Global League
                    </span>
                  </h2>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    Track your Claude Code usage, compete with developers worldwide, and rise
                    through the ranks.
                  </p>
                </div>

                {/* Stats Preview */}
                <div className="relative z-10 space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text-primary">15,847+</div>
                      <div className="text-xs text-text-muted">Global Developers</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text-primary">195</div>
                      <div className="text-xs text-text-muted">Countries Competing</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text-primary">Real-time</div>
                      <div className="text-xs text-text-muted">Leaderboard Updates</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Panel - Auth Form */}
              <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
                {/* Mobile Header */}
                <div className="lg:hidden text-center mb-6">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-[#B85C3D] flex items-center justify-center">
                      <span className="text-white font-bold text-sm">CC</span>
                    </div>
                    <span className="text-lg font-semibold text-text-primary">CCgather</span>
                  </div>
                  <p className="text-sm text-text-muted">Join the Global League</p>
                </div>

                {/* Tab Switcher */}
                <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] mb-6">
                  <button
                    onClick={() => setView("sign-in")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      view === "sign-in"
                        ? "bg-primary/20 text-primary"
                        : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setView("sign-up")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      view === "sign-up"
                        ? "bg-primary/20 text-primary"
                        : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    Sign Up
                  </button>
                </div>

                {/* Clerk Components with Custom Appearance */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={view}
                    initial={{ opacity: 0, x: view === "sign-in" ? -10 : 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: view === "sign-in" ? 10 : -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {view === "sign-in" ? (
                      <SignIn
                        routing="hash"
                        appearance={{
                          elements: {
                            rootBox: "w-full",
                            card: "bg-transparent shadow-none p-0 w-full",
                            header: "hidden",
                            headerTitle: "hidden",
                            headerSubtitle: "hidden",
                            socialButtonsBlockButton:
                              "w-full bg-white/[0.03] border border-white/[0.08] text-text-primary hover:bg-white/[0.06] transition-all rounded-xl py-3",
                            socialButtonsBlockButtonText: "text-sm font-medium",
                            socialButtonsBlockButtonArrow: "text-text-muted",
                            dividerLine: "bg-white/[0.08]",
                            dividerText: "text-text-muted text-xs",
                            formButtonPrimary:
                              "w-full bg-gradient-to-r from-primary to-[#B85C3D] hover:opacity-90 transition-opacity rounded-xl py-3 text-sm font-semibold",
                            formFieldInput:
                              "bg-white/[0.03] border border-white/[0.08] rounded-xl py-3 px-4 text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:ring-1 focus:ring-primary/20",
                            formFieldLabel: "text-text-secondary text-sm font-medium mb-1.5",
                            footerAction: "hidden",
                            footer: "hidden",
                            identityPreview:
                              "bg-white/[0.03] border border-white/[0.08] rounded-xl",
                            identityPreviewText: "text-text-primary",
                            identityPreviewEditButton: "text-primary hover:text-primary/80",
                            formFieldAction: "text-primary hover:text-primary/80 text-sm",
                            alertText: "text-red-400 text-sm",
                            formFieldInputShowPasswordButton:
                              "text-text-muted hover:text-text-primary",
                          },
                        }}
                      />
                    ) : (
                      <SignUp
                        routing="hash"
                        appearance={{
                          elements: {
                            rootBox: "w-full",
                            card: "bg-transparent shadow-none p-0 w-full",
                            header: "hidden",
                            headerTitle: "hidden",
                            headerSubtitle: "hidden",
                            socialButtonsBlockButton:
                              "w-full bg-white/[0.03] border border-white/[0.08] text-text-primary hover:bg-white/[0.06] transition-all rounded-xl py-3",
                            socialButtonsBlockButtonText: "text-sm font-medium",
                            socialButtonsBlockButtonArrow: "text-text-muted",
                            dividerLine: "bg-white/[0.08]",
                            dividerText: "text-text-muted text-xs",
                            formButtonPrimary:
                              "w-full bg-gradient-to-r from-primary to-[#B85C3D] hover:opacity-90 transition-opacity rounded-xl py-3 text-sm font-semibold",
                            formFieldInput:
                              "bg-white/[0.03] border border-white/[0.08] rounded-xl py-3 px-4 text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:ring-1 focus:ring-primary/20",
                            formFieldLabel: "text-text-secondary text-sm font-medium mb-1.5",
                            footerAction: "hidden",
                            footer: "hidden",
                            identityPreview:
                              "bg-white/[0.03] border border-white/[0.08] rounded-xl",
                            identityPreviewText: "text-text-primary",
                            identityPreviewEditButton: "text-primary hover:text-primary/80",
                            formFieldAction: "text-primary hover:text-primary/80 text-sm",
                            alertText: "text-red-400 text-sm",
                            formFieldInputShowPasswordButton:
                              "text-text-muted hover:text-text-primary",
                          },
                        }}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-white/[0.05] text-center">
                  <p className="text-xs text-text-muted">
                    By continuing, you agree to our{" "}
                    <a href="/terms" className="text-primary hover:underline">
                      Terms
                    </a>{" "}
                    and{" "}
                    <a href="/privacy" className="text-primary hover:underline">
                      Privacy Policy
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
