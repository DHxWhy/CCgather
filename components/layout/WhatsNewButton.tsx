"use client";

import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { GitCommitVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHANGELOG_LATEST_ID,
  hasUnseenUpdate,
  readSeenId,
  WHATS_NEW_SEEN_KEY,
} from "@/lib/constants/changelog";

const WhatsNewModal = lazy(() =>
  import("@/components/layout/WhatsNewModal").then((mod) => ({ default: mod.WhatsNewModal }))
);

interface WhatsNewButtonProps {
  variant?: "icon" | "menu";
  onReportBug?: () => void;
  onOpen?: () => void;
}

export function WhatsNewButton({ variant = "icon", onReportBug, onOpen }: WhatsNewButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    setUnseen(hasUnseenUpdate(readSeenId(window.localStorage), CHANGELOG_LATEST_ID));
  }, []);

  const open = useCallback(() => {
    setUnseen(false);
    try {
      window.localStorage.setItem(WHATS_NEW_SEEN_KEY, CHANGELOG_LATEST_ID);
    } catch {
      /* 시크릿 모드·저장 차단 브라우저에서도 모달은 열려야 한다 */
    }
    onOpen?.();
    setIsOpen(true);
  }, [onOpen]);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={open}
          aria-label={unseen ? "What's new (new updates)" : "What's new"}
          className={cn(
            "group relative flex h-8 w-8 items-center justify-center rounded-full border transition-all",
            "border-[var(--border-default)] hover:border-[var(--color-text-muted)]"
          )}
        >
          <GitCommitVertical
            size={14}
            className="text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text-secondary)]"
          />
          {unseen && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--color-claude-coral)] ring-2 ring-[var(--color-bg-primary)]"
            />
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={open}
          className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-3",
            "text-base font-medium transition-all duration-200",
            "text-[var(--color-text-secondary)] hover:bg-[var(--glass-bg)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <GitCommitVertical size={18} />
          What&apos;s new
          {unseen && (
            <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--color-claude-coral)]" />
          )}
        </button>
      )}

      {isOpen && (
        <Suspense fallback={null}>
          <WhatsNewModal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            onReportBug={onReportBug}
          />
        </Suspense>
      )}
    </>
  );
}

export default WhatsNewButton;
