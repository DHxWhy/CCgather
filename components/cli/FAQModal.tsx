"use client";

import { useEffect } from "react";
import { X, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FAQModal({ isOpen, onClose }: FAQModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto w-full max-w-lg",
            "bg-[var(--color-bg-secondary)] border border-[var(--border-default)]",
            "rounded-xl sm:rounded-2xl shadow-2xl",
            "animate-in fade-in zoom-in-95 duration-200",
            "max-h-[95vh] sm:max-h-[90vh] flex flex-col"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[var(--border-default)] flex-shrink-0">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[var(--color-claude-coral)]" />
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">FAQ</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-[var(--color-text-muted)]" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
            <div className="p-3 rounded-lg bg-black/20 space-y-2">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                Is my code or chat history uploaded?
              </p>
              <p className="text-[11px] sm:text-[13px] text-[var(--color-text-muted)] leading-relaxed">
                <span className="text-green-400 font-medium">No.</span>
                <br className="sm:hidden" />
                <span className="sm:ml-1">
                  We only collect usage metrics
                  <br className="hidden sm:inline" /> (token counts, costs, models).
                </span>
                <br />
                <span className="text-[var(--color-text-primary)]">
                  Your conversations and code never leave your device.
                </span>
              </p>
            </div>

            <div className="p-3 rounded-lg bg-black/20 space-y-2">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                How often should I submit?
              </p>
              <p className="text-[11px] sm:text-[13px] text-[var(--color-text-muted)] leading-relaxed">
                As often as you&apos;d like!
                <br />
                Claude Code stores local data for{" "}
                <span className="text-[var(--color-claude-coral)] font-medium">~30 days</span>.
                <br className="sm:hidden" />
                <span className="sm:ml-1">Submit before that.</span>
              </p>
            </div>

            <div className="p-3 rounded-lg bg-black/20 space-y-2">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                What is a session fingerprint?
              </p>
              <p className="text-[11px] sm:text-[13px] text-[var(--color-text-muted)] leading-relaxed">
                A unique hash to{" "}
                <span className="text-[var(--color-text-primary)]">
                  prevent duplicate submissions
                </span>
                .
                <br />
                It contains no personal or code information.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-black/20 space-y-2">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                Can I submit from multiple projects?
              </p>
              <p className="text-[11px] sm:text-[13px] text-[var(--color-text-muted)] leading-relaxed">
                <span className="text-green-400 font-medium">Yes!</span>
                <br className="sm:hidden" />
                <span className="sm:ml-1">
                  The CLI scans{" "}
                  <span className="text-[var(--color-text-primary)]">all Claude Code projects</span>
                  <br className="hidden sm:inline" /> on your PC in a single run.
                </span>
              </p>
            </div>

            <div className="p-3 rounded-lg bg-black/20 space-y-2">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                Why do I need to sign in?
              </p>
              <p className="text-[11px] sm:text-[13px] text-[var(--color-text-muted)] leading-relaxed">
                To link usage data to your{" "}
                <span className="text-[var(--color-text-primary)]">CCgather profile</span>.
                <br />
                Authentication is done securely via browser.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-black/20 space-y-2">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                Is the CLI open source?
              </p>
              <p className="text-[11px] sm:text-[13px] text-[var(--color-text-muted)] leading-relaxed">
                <span className="text-green-400 font-medium">Yes!</span>
                <br className="sm:hidden" />
                <span className="sm:ml-1">
                  Source at{" "}
                  <span className="text-[var(--color-claude-coral)]">
                    github.com/DHxWhy/CCgather
                  </span>
                </span>
                <br />
                <span className="text-[var(--color-text-muted)]">A star would mean a lot!</span>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-[var(--border-default)] flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Questions? Join our Discord community
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[var(--color-claude-coral)] text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default FAQModal;
