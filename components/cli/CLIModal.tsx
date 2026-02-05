"use client";

import { useState, useEffect } from "react";
import { X, Copy, Check, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { posthog } from "@/components/providers/PostHogProvider";

interface CLIModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function CopyButton({ text, trackEvent }: { text: string; trackEvent?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const handleCopy = async () => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for HTTP or unsupported browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!successful) throw new Error("Copy failed");
      }
      setCopied(true);
      setError(false);

      // Track CLI install command copy
      if (trackEvent) {
        posthog.capture(trackEvent, { command: text });
      }

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-white/10 transition-colors"
      title={error ? "Failed to copy" : "Copy to clipboard"}
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-400" />
      ) : error ? (
        <X className="w-4 h-4 text-red-400" />
      ) : (
        <Copy className="w-4 h-4 text-[var(--color-text-muted)]" />
      )}
    </button>
  );
}

export function CLIModal({ isOpen, onClose }: CLIModalProps) {
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
            "pointer-events-auto w-full max-w-md",
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
              <Terminal className="w-5 h-5 text-[var(--color-claude-coral)]" />
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                CCgather CLI
              </h2>
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
            {/* Quick Install */}
            <div>
              <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                Run
              </p>
              <div className="flex items-center justify-between bg-black/40 rounded-lg p-3">
                <code className="text-sm font-mono">
                  <span className="text-[var(--color-text-muted)]">$</span>{" "}
                  <span className="text-[var(--color-claude-coral)]">npx</span>{" "}
                  <span className="text-[var(--color-text-primary)]">ccgather</span>
                </code>
                <CopyButton text="npx ccgather" trackEvent="cli_install_click" />
              </div>
            </div>

            {/* How it works */}
            <div>
              <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                How it works
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-3">
                  <span className="text-[var(--color-claude-coral)] font-mono text-xs">1.</span>
                  <span className="text-[var(--color-text-muted)]">
                    Run <code className="text-[var(--color-claude-coral)]">npx ccgather</code>
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[var(--color-claude-coral)] font-mono text-xs">2.</span>
                  <span className="text-[var(--color-text-muted)]">
                    Sign in via browser (first time only)
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[var(--color-claude-coral)] font-mono text-xs">3.</span>
                  <span className="text-[var(--color-text-muted)]">
                    Select &quot;Submit usage data&quot; to sync your stats
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Options */}
            <div>
              <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                Menu Options
              </p>
              <div className="space-y-1.5 text-xs font-mono">
                {[
                  {
                    icon: "📤",
                    name: "Submit usage data",
                    desc: "Scan & submit to leaderboard",
                  },
                  { icon: "⚙️", name: "Settings", desc: "Re-authenticate" },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between py-1.5 px-2 rounded bg-black/20"
                  >
                    <span className="text-[var(--color-text-primary)] font-sans">
                      {item.icon} {item.name}
                    </span>
                    <span className="text-[var(--color-text-muted)] font-sans">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* What We Collect - Privacy Section */}
            <div>
              <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                What We Collect
              </p>
              <div className="space-y-2 text-xs bg-black/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <span className="text-green-400 font-bold">✓</span>
                  <span className="text-[var(--color-text-muted)]">
                    <span className="text-[var(--color-text-primary)] font-medium">
                      Token counts
                    </span>
                    ,{" "}
                    <span className="text-[var(--color-text-primary)] font-medium">
                      cost estimates
                    </span>
                    ,{" "}
                    <span className="text-[var(--color-text-primary)] font-medium">
                      models used
                    </span>
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">✗</span>
                  <span className="text-[var(--color-text-muted)]">
                    No chat history or code content —{" "}
                    <span className="text-red-400 font-medium underline decoration-red-400/50">
                      never uploaded
                    </span>
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-white/5 text-[var(--color-text-muted)]">
                  <span className="text-[var(--color-claude-coral)] font-medium">Tip:</span> Claude
                  Code keeps local data{" "}
                  <span className="text-[var(--color-claude-coral)] font-medium">~30 days</span>
                  .
                  <br />
                  <span className="text-[var(--color-text-primary)]">Submit manually</span> before
                  it expires.
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-[var(--border-default)] flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Submit when you want to update your rank
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

export default CLIModal;
