"use client";

import { useState, useEffect } from "react";
import { X, HelpCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

const faqItems: FAQItem[] = [
  {
    question: "Is my code or chat history uploaded?",
    answer: (
      <>
        <span className="text-green-400 font-medium">No.</span> We only collect usage metrics (token
        counts, costs, models).
        <br />
        <span className="text-[var(--color-text-primary)]">
          Your conversations and code never leave your device.
        </span>
      </>
    ),
  },
  {
    question: "How often should I submit?",
    answer: (
      <>
        As often as you&apos;d like! Claude Code stores local data for{" "}
        <span className="text-[var(--color-claude-coral)] font-medium">~30 days</span>. Submit
        before that.
      </>
    ),
  },
  {
    question: "What is a session fingerprint?",
    answer: (
      <>
        A unique hash to{" "}
        <span className="text-[var(--color-text-primary)]">prevent duplicate submissions</span>.
        <br />
        It contains no personal or code information.
      </>
    ),
  },
  {
    question: "Can I submit from multiple projects?",
    answer: (
      <>
        <span className="text-green-400 font-medium">Yes!</span> The CLI scans{" "}
        <span className="text-[var(--color-text-primary)]">all Claude Code projects</span> on your
        PC in a single run.
      </>
    ),
  },
  {
    question: "Why do I need to sign in?",
    answer: (
      <>
        To link usage data to your{" "}
        <span className="text-[var(--color-text-primary)]">CCgather profile</span>. Authentication
        is done securely via browser.
      </>
    ),
  },
  {
    question: "Is the CLI open source?",
    answer: (
      <>
        <span className="text-green-400 font-medium">Yes!</span> Source at{" "}
        <span className="text-[var(--color-claude-coral)]">github.com/DHxWhy/CCgather</span>.
        <br />A star would mean a lot!
      </>
    ),
  },
];

export function FAQModal({ isOpen, onClose }: FAQModalProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0); // First item expanded by default

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

  // Reset expanded state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setExpandedIndex(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleItem = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

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
            "max-h-[85vh] sm:max-h-[80vh] flex flex-col"
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
          <div className="p-3 sm:p-4 space-y-2 overflow-y-auto flex-1">
            {faqItems.map((item, index) => (
              <div key={index} className="rounded-lg bg-black/20 overflow-hidden">
                <button
                  onClick={() => toggleItem(index)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors"
                >
                  <span className="text-[13px] font-medium text-[var(--color-text-primary)] pr-2">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 flex-shrink-0",
                      expandedIndex === index && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-200",
                    expandedIndex === index ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <p className="px-3 pb-3 text-[12px] text-[var(--color-text-muted)] leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              </div>
            ))}
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
