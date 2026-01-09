"use client";

import { useState, useEffect } from "react";
import { X, Copy, Check, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface CLIModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-white/10 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-400" />
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

          {/* Content */}
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
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
                <CopyButton text="npx ccgather" />
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
                    Authenticate with your GitHub account (first time only)
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
                  { icon: "📤", name: "Submit usage data", desc: "Scan & submit to leaderboard" },
                  { icon: "📊", name: "View my rank", desc: "Check your current ranking" },
                  { icon: "⚙️", name: "Settings", desc: "Re-authenticate or disconnect" },
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

            {/* Data Sources */}
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                Data Sources
              </p>
              <div className="text-xs text-[var(--color-text-muted)] space-y-1">
                <div>
                  <code className="text-[var(--color-claude-coral)]">~/.claude/projects/</code> -
                  Claude Code session logs
                </div>
                <div>
                  <code className="text-[var(--color-claude-coral)]">~/.claude/ccgather.json</code>{" "}
                  - Scanned usage data
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border-default)] flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">
              Run when you want to update your rank
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
