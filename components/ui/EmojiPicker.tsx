"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { EmojiPicker as FrimousseEmojiPicker } from "frimousse";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

// ===========================================
// Types
// ===========================================

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  position?: "top" | "bottom";
  align?: "left" | "right";
  className?: string;
  buttonClassName?: string;
  size?: "sm" | "md";
}

// ===========================================
// EmojiPicker Component
// ===========================================

export function EmojiPicker({
  onEmojiSelect,
  position = "top",
  align = "left",
  className,
  buttonClassName,
  size = "sm",
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleEmojiSelect = useCallback(
    (emoji: { emoji: string }) => {
      onEmojiSelect(emoji.emoji);
      setIsOpen(false);
    },
    [onEmojiSelect]
  );

  const iconSize = size === "sm" ? 14 : 16;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-center rounded-full transition-colors",
          "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
          "hover:bg-[var(--glass-bg)]",
          size === "sm" ? "p-1.5" : "p-2",
          isOpen && "text-[var(--color-claude-coral)] bg-[var(--color-claude-coral)]/10",
          buttonClassName
        )}
        aria-label="Add emoji"
        aria-expanded={isOpen}
      >
        <Smile size={iconSize} />
      </button>

      {/* Emoji Picker Popover */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 animate-fadeIn",
            // Position
            position === "top" ? "bottom-full mb-2" : "top-full mt-2",
            // Align
            align === "left" ? "left-0" : "right-0"
          )}
        >
          <div
            className={cn(
              "w-[280px] h-[320px] rounded-lg border shadow-xl overflow-hidden",
              // Light/Dark mode backgrounds
              "bg-[var(--color-bg-card)] border-[var(--border-default)]",
              "dark:bg-[#1a1a1c] dark:border-[#2a2a2e]"
            )}
          >
            <FrimousseEmojiPicker.Root
              className="flex flex-col h-full"
              onEmojiSelect={handleEmojiSelect}
            >
              {/* Search */}
              <div className="p-2 border-b border-[var(--border-default)]">
                <FrimousseEmojiPicker.Search
                  placeholder="Search emoji..."
                  className={cn(
                    "w-full px-3 py-1.5 text-sm rounded-md",
                    "bg-[var(--color-bg-secondary)] border border-[var(--border-default)]",
                    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
                    "focus:outline-none focus:border-[var(--color-claude-coral)]/50"
                  )}
                />
              </div>

              {/* Emoji List */}
              <FrimousseEmojiPicker.Viewport className="flex-1 overflow-y-auto px-2 py-1">
                <FrimousseEmojiPicker.Loading>
                  <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">
                    Loading...
                  </div>
                </FrimousseEmojiPicker.Loading>
                <FrimousseEmojiPicker.Empty>
                  <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">
                    No emoji found
                  </div>
                </FrimousseEmojiPicker.Empty>
                <FrimousseEmojiPicker.List
                  components={{
                    CategoryHeader: ({ category }) => (
                      <div className="w-full sticky top-0 py-1.5 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide bg-[var(--color-bg-card)] dark:bg-[#1a1a1c]">
                        {category.label}
                      </div>
                    ),
                    Row: ({ children }) => <div className="flex gap-0.5">{children}</div>,
                    Emoji: ({ emoji, ...props }) => (
                      <button
                        type="button"
                        className={cn(
                          "w-8 h-8 flex items-center justify-center text-xl rounded",
                          "hover:bg-[var(--glass-bg)] transition-colors",
                          "focus:outline-none focus:bg-[var(--color-claude-coral)]/20"
                        )}
                        {...props}
                      >
                        {emoji.emoji}
                      </button>
                    ),
                  }}
                />
              </FrimousseEmojiPicker.Viewport>
            </FrimousseEmojiPicker.Root>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmojiPicker;
