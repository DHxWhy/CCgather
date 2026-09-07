"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bug, Settings, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsMenuProps {
  isActive: boolean;
  onReportBug: () => void;
}

export function SettingsMenu({ isActive, onReportBug }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px]",
    "text-[var(--color-text-secondary)] transition-colors",
    "hover:bg-[var(--glass-bg)] hover:text-[var(--color-text-primary)]"
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Settings menu"
        className={cn(
          "group flex h-8 w-8 items-center justify-center rounded-full border transition-all",
          isActive || open
            ? "border-[var(--color-claude-coral)] bg-[var(--color-claude-coral)]/10"
            : "border-[var(--border-default)] hover:border-[var(--color-text-muted)]"
        )}
      >
        <Settings
          size={14}
          className={cn(
            "transition-colors",
            isActive || open
              ? "text-[var(--color-claude-coral)]"
              : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]"
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-10 z-50 w-48 p-1.5",
            "rounded-xl border border-[var(--border-default)] bg-[var(--color-bg-secondary)] shadow-2xl",
            "animate-in fade-in zoom-in-95 duration-150"
          )}
        >
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <SlidersHorizontal size={14} className="text-[var(--color-text-muted)]" />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onReportBug();
            }}
            className={itemClass}
          >
            <Bug size={14} className="text-[var(--color-text-muted)]" />
            Report a bug
          </button>
        </div>
      )}
    </div>
  );
}

export default SettingsMenu;
