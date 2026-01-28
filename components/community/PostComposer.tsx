"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { Send, Globe, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { CommunityFilterTag } from "./community-tags";
import LinkPreview from "./LinkPreview";
import { getFirstEmbeddableUrl, type ParsedUrl } from "@/lib/url-parser";

// ===========================================
// Types
// ===========================================

interface PostComposerProps {
  currentTab: CommunityFilterTag;
  userAvatar?: string;
  userName?: string;
  userLevel?: number;
  onPost?: (content: string, tab: CommunityFilterTag) => void;
  className?: string;
}

// ===========================================
// PostComposer Component
// X/Twitter style inline post composer
// ===========================================

export default function PostComposer({
  currentTab,
  userAvatar,
  userName = "Guest",
  userLevel = 1,
  onPost,
  className,
}: PostComposerProps) {
  const [content, setContent] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [dismissedPreview, setDismissedPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Detect embeddable URL in content
  const detectedUrl: ParsedUrl | null = useMemo(() => {
    if (dismissedPreview) return null;
    return getFirstEmbeddableUrl(content);
  }, [content, dismissedPreview]);

  // Character limit based on tab (shorter for casual vibes)
  const maxLength = currentTab === "vibes" ? 280 : 500;
  const charCount = content.length;
  const isOverLimit = charCount > maxLength;
  const canPost = content.trim().length > 0 && !isOverLimit;

  // Placeholder text based on tab
  const placeholder =
    currentTab === "vibes" ? "Share your vibes..." : "What do you need help with?";

  // Auto-resize textarea
  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  // Handle post submission
  const handlePost = async () => {
    if (!canPost || isPosting) return;

    setIsPosting(true);
    try {
      // Simulate API call (replace with actual implementation)
      await new Promise((resolve) => setTimeout(resolve, 500));
      onPost?.(content, currentTab);
      setContent("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      setIsFocused(false);
    } finally {
      setIsPosting(false);
    }
  };

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handlePost();
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-xl border transition-all duration-300",
        "bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm",
        isFocused
          ? "border-[var(--color-claude-coral)]/30 shadow-lg shadow-[var(--color-claude-coral)]/5"
          : "border-[var(--border-default)] hover:border-[var(--border-hover)]",
        className
      )}
    >
      {/* Subtle star pattern background when focused */}
      {isFocused && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none opacity-30">
          <div className="absolute inset-0 pattern-stars" />
        </div>
      )}

      <div className="relative p-3">
        {/* Main: Avatar + Input */}
        <div className="flex items-start gap-2.5">
          {/* User Avatar */}
          <div className="flex-shrink-0">
            {userAvatar ? (
              <Image
                src={userAvatar}
                alt={userName}
                width={36}
                height={36}
                className="w-9 h-9 rounded-full border border-[var(--border-default)]"
              />
            ) : (
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center",
                  "bg-gradient-to-br from-[var(--color-claude-coral)] to-[var(--color-claude-rust)]",
                  "text-white font-semibold text-sm"
                )}
              >
                {userName[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="flex-1 min-w-0">
            {/* User info badge (shown when focused) */}
            {isFocused && (
              <div className="flex items-center gap-1.5 mb-1.5 animate-fadeIn">
                <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
                  {userName}
                </span>
                <span
                  className={cn(
                    "px-1 py-0.5 text-[9px] font-semibold rounded",
                    userLevel >= 5
                      ? "level-badge-5"
                      : "bg-[var(--color-claude-coral)]/10 text-[var(--color-claude-coral)]"
                  )}
                >
                  Lv.{userLevel}
                </span>
              </div>
            )}

            {/* Textarea */}
            <div className="relative">
              {/* Custom placeholder */}
              {!content && !isFocused && (
                <span className="absolute left-0 top-0 text-[13px] text-[var(--color-text-muted)] pointer-events-none">
                  {placeholder}
                </span>
              )}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setDismissedPreview(false); // Reset dismissed state on new input
                  handleInput();
                }}
                onFocus={() => setIsFocused(true)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={isFocused ? placeholder : ""}
                className={cn(
                  "w-full resize-none bg-transparent",
                  "text-[var(--color-text-primary)]",
                  "focus:outline-none",
                  "text-[13px] leading-relaxed",
                  isFocused ? "min-h-[60px]" : "min-h-[32px]"
                )}
                style={{ maxHeight: "160px" }}
              />
            </div>

            {/* Link Preview */}
            {detectedUrl && isFocused && (
              <div className="relative mt-2 animate-fadeIn">
                <button
                  type="button"
                  onClick={() => setDismissedPreview(true)}
                  className="absolute -top-1 -right-1 z-10 p-1 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)] transition-colors"
                  title="Remove preview"
                >
                  <X size={12} />
                </button>
                <LinkPreview parsedUrl={detectedUrl} />
              </div>
            )}
          </div>
        </div>

        {/* Footer: Actions + Character count + Post button */}
        {isFocused && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-default)] animate-fadeIn">
            {/* Left: Language indicator */}
            <div
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded",
                "text-[9px] text-[var(--color-text-muted)]",
                "bg-[var(--glass-bg)]"
              )}
            >
              <Globe size={10} />
              <span>Auto-translate · Paste URL for preview</span>
            </div>

            {/* Right: Character count + Post button */}
            <div className="flex items-center gap-2">
              {/* Character count */}
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  isOverLimit
                    ? "text-[var(--color-error)]"
                    : charCount > maxLength * 0.8
                      ? "text-[var(--color-warning)]"
                      : "text-[var(--color-text-muted)]"
                )}
              >
                {charCount}/{maxLength}
              </span>

              {/* Post button */}
              <Button
                variant="primary"
                size="sm"
                onClick={handlePost}
                disabled={!canPost || isPosting}
                className="gap-1 h-7 px-3 text-xs"
              >
                {isPosting ? (
                  <>
                    <Sparkles size={12} className="animate-spin" />
                    Posting
                  </>
                ) : (
                  <>
                    <Send size={12} />
                    Post
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Hint when not focused */}
        {!isFocused && (
          <div className="mt-1.5 text-[9px] text-[var(--color-text-muted)] flex items-center gap-1">
            <Globe size={9} />
            <span>Posts are translated to other users&apos; language</span>
          </div>
        )}
      </div>
    </div>
  );
}
