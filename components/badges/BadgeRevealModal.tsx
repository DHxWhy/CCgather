"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Badge } from "@/lib/constants/badges";
import { BadgeMotionPlayer } from "@/components/badges/BadgeMotionPlayer";

const REVEAL_SIZE = 168;

const RARITY_CHIP: Record<Badge["rarity"], string> = {
  common: "bg-gray-500/20",
  rare: "bg-blue-500/20",
  epic: "bg-purple-500/20",
  legendary: "bg-[var(--color-claude-coral)]/30",
};

interface BadgeRevealModalProps {
  badge: Badge;
  remaining: number;
  onNext: () => void;
}

export function BadgeRevealModal({ badge, remaining, onNext }: BadgeRevealModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext]);

  if (typeof document === "undefined" || !badge.image) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-reveal-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onNext} />
      <div className="relative w-full max-w-sm rounded-xl border border-[var(--border-default)] bg-[var(--color-bg-primary)] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onNext}
          aria-label="Close"
          className="absolute right-3 top-3 rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-claude-coral)]">
          Badge unlocked
        </div>
        <div className="mt-4 flex justify-center">
          <BadgeMotionPlayer
            badgeId={badge.id}
            image={badge.image}
            rarity={badge.rarity}
            size={REVEAL_SIZE}
          />
        </div>
        <h2
          id="badge-reveal-title"
          className="mt-4 text-center text-lg font-semibold text-[var(--color-text-primary)]"
        >
          {badge.name}
        </h2>
        <div className="mt-1.5 flex justify-center">
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium capitalize text-[var(--color-text-primary)] ${RARITY_CHIP[badge.rarity]}`}
          >
            {badge.rarity}
          </span>
        </div>
        <p className="mt-3 text-center text-xs text-[var(--color-text-secondary)]">
          {badge.description}
        </p>
        <p className="mt-1 text-center text-xs text-[var(--color-text-muted)]">{badge.praise}</p>
        <button
          type="button"
          onClick={onNext}
          className="mt-5 w-full rounded-lg bg-[var(--color-claude-coral)] py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {remaining > 0 ? `Next (${remaining} more)` : "Done"}
        </button>
      </div>
    </div>,
    document.body
  );
}
