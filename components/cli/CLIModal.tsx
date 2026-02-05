"use client";

import { useState, useEffect } from "react";
import { X, Copy, Check, Terminal, HelpCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { posthog } from "@/components/providers/PostHogProvider";

type TabType = "overview" | "faq";

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
  const [activeTab, setActiveTab] = useState<TabType>("overview");

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

  // Reset tab when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab("overview");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Info },
    { id: "faq" as const, label: "FAQ", icon: HelpCircle },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto w-full max-w-lg",
            "bg-[var(--color-bg-secondary)] border border-[var(--border-default)]",
            "rounded-2xl shadow-2xl",
            "animate-in fade-in zoom-in-95 duration-200"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-[var(--color-claude-coral)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
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

          {/* Tabs */}
          <div className="flex border-b border-[var(--border-default)]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors relative",
                  activeTab === tab.id
                    ? "text-[var(--color-claude-coral)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-claude-coral)]" />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {activeTab === "overview" ? (
              <>
                {/* Quick Install */}
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
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
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
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
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
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
                        <span className="text-[var(--color-text-muted)] font-sans">
                          {item.desc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* What We Collect - Privacy Section */}
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                    What We Collect
                  </p>
                  <div className="space-y-2 text-xs bg-black/20 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✓</span>
                      <span className="text-[var(--color-text-muted)]">
                        Token counts, cost estimates, models used
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-400">✗</span>
                      <span className="text-[var(--color-text-muted)]">
                        No chat history or code content — never uploaded
                      </span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/5 text-[var(--color-text-muted)]">
                      <span className="text-[var(--color-claude-coral)]">Tip:</span> Claude Code
                      keeps local data ~30 days. Submit manually before it expires.
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* FAQ Tab */
              <div className="space-y-4">
                {[
                  {
                    q: "Is my code or chat history uploaded?",
                    a: "No. We only collect aggregated usage metrics (token counts, costs, models). Your actual conversations and code never leave your device.",
                  },
                  {
                    q: "How often should I submit?",
                    a: "As often as you'd like! Claude Code stores local session data for approximately 30 days. Submit before that to ensure your stats are captured.",
                  },
                  {
                    q: "What is a session fingerprint?",
                    a: "A unique hash generated from your session metadata to prevent duplicate submissions. It doesn't contain any personal or code information.",
                  },
                  {
                    q: "Can I submit from multiple projects?",
                    a: "Yes! The CLI automatically scans all Claude Code projects on your PC in a single run. No need to run it separately for each project.",
                  },
                  {
                    q: "Why do I need to sign in?",
                    a: "To link your usage data to your CCgather profile and leaderboard rank. Authentication is done securely via your browser.",
                  },
                  {
                    q: "Is the CLI open source?",
                    a: "Yes! Check out the source code at github.com/hanjuho/ccgather-cli. A star would mean a lot!",
                  },
                ].map((faq, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{faq.q}</p>
                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border-default)] flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">
              {activeTab === "overview"
                ? "Submit when you want to update your rank"
                : "Questions? Join our Discord community"}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[var(--color-claude-coral)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
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
