"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bug, Lightbulb, MessageSquare, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

// ===========================================
// Types
// ===========================================

type FeedbackType = "bug" | "feature" | "general";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FEEDBACK_TYPES: { type: FeedbackType; label: string; icon: typeof Bug; color: string }[] = [
  { type: "bug", label: "Bug", icon: Bug, color: "text-red-400" },
  { type: "feature", label: "Feature", icon: Lightbulb, color: "text-yellow-400" },
  { type: "general", label: "General", icon: MessageSquare, color: "text-blue-400" },
];

// ===========================================
// FeedbackModal Component
// ===========================================

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>("bug");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const maxLength = 1000;
  const charCount = content.length;
  const isOverLimit = charCount > maxLength;
  const canSubmit = content.trim().length >= 10 && !isOverLimit;

  // Auto-resize textarea
  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  // Handle submit
  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          content,
          page_url: window.location.href,
          user_agent: navigator.userAgent,
        }),
      });

      if (response.ok) {
        setSubmitSuccess(true);
        setTimeout(() => {
          onClose();
          // Reset state after close
          setTimeout(() => {
            setContent("");
            setType("bug");
            setSubmitSuccess(false);
          }, 300);
        }, 1500);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to submit feedback");
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      alert("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const placeholders: Record<FeedbackType, string> = {
    bug: "Describe the bug... What happened? What did you expect?",
    feature: "Describe the feature you'd like to see...",
    general: "Share your thoughts...",
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
            <div className="w-full max-w-md bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden">
              {/* Success State */}
              {submitSuccess ? (
                <div className="p-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center"
                  >
                    <Sparkles className="w-8 h-8 text-green-400" />
                  </motion.div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                    Thank you!
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Your feedback has been submitted.
                  </p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
                    <div className="flex items-center gap-2">
                      <Bug className="w-5 h-5 text-[var(--color-claude-coral)]" />
                      <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                        Send Feedback
                      </h2>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-[var(--color-text-muted)]"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-4">
                    {/* Type Selector */}
                    <div className="flex gap-2">
                      {FEEDBACK_TYPES.map(({ type: t, label, icon: Icon, color }) => (
                        <button
                          key={t}
                          onClick={() => setType(t)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg",
                            "text-xs font-medium transition-all",
                            type === t
                              ? "bg-[var(--color-claude-coral)]/20 text-[var(--color-claude-coral)] border border-[var(--color-claude-coral)]/30"
                              : "bg-[var(--glass-bg)] text-[var(--color-text-muted)] border border-transparent hover:border-[var(--border-default)]"
                          )}
                        >
                          <Icon size={14} className={type === t ? color : ""} />
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Textarea */}
                    <div className="relative">
                      <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => {
                          setContent(e.target.value);
                          handleInput();
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholders[type]}
                        rows={4}
                        className={cn(
                          "w-full resize-none rounded-xl border p-3",
                          "bg-[var(--color-bg-tertiary)]",
                          "text-[var(--color-text-primary)] text-sm",
                          "placeholder:text-[var(--color-text-muted)]",
                          "focus:outline-none focus:border-[var(--color-claude-coral)]/30",
                          "transition-colors",
                          isOverLimit ? "border-red-500/50" : "border-[var(--border-default)]"
                        )}
                        style={{ minHeight: "100px", maxHeight: "200px" }}
                      />
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      {/* Character count */}
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[10px] tabular-nums",
                            isOverLimit
                              ? "text-red-400"
                              : charCount > maxLength * 0.8
                                ? "text-yellow-400"
                                : "text-[var(--color-text-muted)]"
                          )}
                        >
                          {charCount}/{maxLength}
                        </span>
                        {content.trim().length < 10 && (
                          <span className="text-[11px] text-[var(--color-text-muted)]">
                            (
                            <span
                              className={cn(
                                "font-medium",
                                content.trim().length > 0 && "text-amber-400"
                              )}
                            >
                              {10 - content.trim().length} more
                            </span>{" "}
                            chars needed)
                          </span>
                        )}
                      </div>

                      {/* Submit button */}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSubmit}
                        disabled={!canSubmit || isSubmitting}
                        className="gap-1.5"
                      >
                        {isSubmitting ? (
                          <>
                            <Sparkles size={14} className="animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send size={14} />
                            Send
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Hint */}
                    <p className="text-[10px] text-[var(--color-text-muted)] text-center">
                      Press{" "}
                      <kbd className="px-1 py-0.5 rounded bg-[var(--glass-bg)] text-[9px]">
                        Ctrl
                      </kbd>
                      +
                      <kbd className="px-1 py-0.5 rounded bg-[var(--glass-bg)] text-[9px]">
                        Enter
                      </kbd>{" "}
                      to submit
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default FeedbackModal;
