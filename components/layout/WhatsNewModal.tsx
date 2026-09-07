"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GitBranch, GitCommitVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHANGELOG,
  CHANGELOG_CATEGORY,
  type ChangelogCategory,
  type ChangelogEntry,
} from "@/lib/constants/changelog";

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReportBug?: () => void;
}

interface LiveState {
  deployedAt: string | null;
  commit: string | null;
  syncedToday: number;
}

const CATEGORY_STYLE: Record<ChangelogCategory, { chip: string; dot: string }> = {
  new: {
    chip: "text-emerald-500 border-emerald-500/35 bg-emerald-500/10",
    dot: "bg-emerald-500",
  },
  improved: {
    chip: "text-[var(--color-claude-coral)] border-[var(--color-claude-coral)]/35 bg-[var(--color-claude-coral)]/10",
    dot: "bg-[var(--color-claude-coral)]",
  },
  fixed: {
    chip: "text-sky-500 border-sky-500/35 bg-sky-500/10",
    dot: "bg-sky-500",
  },
};

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function monthKey(date: string) {
  return date.slice(0, 7);
}

function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function CommitRail({ isLast, dotClass }: { isLast: boolean; dotClass?: string }) {
  return (
    <div className="relative flex w-5 justify-center">
      <span
        aria-hidden
        className={cn(
          "absolute top-0 w-px bg-[var(--border-default)]",
          isLast ? "h-[11px]" : "bottom-[-1.25rem]"
        )}
      />
      {dotClass && (
        <span
          aria-hidden
          className={cn(
            "relative mt-1.5 h-2 w-2 rounded-full ring-4 ring-[var(--color-bg-secondary)]",
            dotClass
          )}
        />
      )}
    </div>
  );
}

function EntryRow({ entry, isLast }: { entry: ChangelogEntry; isLast: boolean }) {
  const style = CATEGORY_STYLE[entry.category];
  const meta = CHANGELOG_CATEGORY[entry.category];

  return (
    <li data-entry className="flex gap-3 pb-5">
      <CommitRail isLast={isLast} dotClass={style.dot} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <time
            dateTime={entry.date}
            className="text-[11px] tabular-nums text-[var(--color-text-muted)]"
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            {entry.date}
          </time>
          <span
            className={cn(
              "rounded border px-1.5 py-px text-[10px] font-medium lowercase tracking-wide",
              style.chip
            )}
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            {meta.mark} {meta.label}
          </span>
        </div>
        <h3 className="mt-1 text-[13px] font-semibold leading-snug text-[var(--color-text-primary)]">
          {entry.title}
        </h3>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          {entry.summary}
        </p>
      </div>
    </li>
  );
}

export function WhatsNewModal({ isOpen, onClose, onReportBug }: WhatsNewModalProps) {
  const [live, setLive] = useState<LiveState | null>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch("/api/whats-new")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LiveState | null) => {
        if (!cancelled && data) setLive(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // 6번째 항목의 절반이 걸치도록 스크롤 높이를 실측한다 — 행 높이가 문구 길이·웹폰트에 따라
  // 달라져 고정값으로 맞출 수 없다. getBoundingClientRect 는 등장 애니메이션(zoom-in-95)의
  // scale 이 곱해져 5% 작게 나오므로 변형에 영향받지 않는 offsetTop/offsetHeight 로 잰다
  useLayoutEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const measure = () => {
      const list = listRef.current;
      if (cancelled || !list) return;
      const sixth = list.querySelectorAll<HTMLElement>("[data-entry]")[5];
      if (!sixth) return;
      const target = sixth.offsetTop + Math.round(sixth.offsetHeight / 2);
      setMaxHeight((prev) => (prev === target ? prev : target));
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => undefined);
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", measure);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const deployed = relativeTime(live?.deployedAt ?? null);
  let lastMonth = "";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="whats-new-title"
          className={cn(
            "pointer-events-auto flex w-full max-w-md flex-col",
            "border border-[var(--border-default)] bg-[var(--color-bg-secondary)]",
            "rounded-xl shadow-2xl sm:rounded-2xl",
            "animate-in fade-in zoom-in-95 duration-200",
            "max-h-[90vh]"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-[var(--border-default)] p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--color-bg-primary)]">
                <GitBranch size={15} className="text-[var(--color-claude-coral)]" />
              </span>
              <div>
                <h2
                  id="whats-new-title"
                  className="text-sm font-semibold text-[var(--color-text-primary)]"
                >
                  What&apos;s new
                </h2>
                <p
                  className="text-[10px] text-[var(--color-text-muted)]"
                  style={{ fontFamily: "var(--font-mono, monospace)" }}
                >
                  {CHANGELOG.length} updates since {CHANGELOG[CHANGELOG.length - 1]?.date}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-shrink-0 px-4 pt-3">
            <div
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[var(--border-default)] bg-[var(--color-bg-primary)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]"
              style={{ fontFamily: "var(--font-mono, monospace)" }}
            >
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-medium text-emerald-500">live</span>
              {live?.commit && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-[var(--color-text-secondary)]">main@{live.commit}</span>
                </>
              )}
              {deployed && (
                <>
                  <span aria-hidden>·</span>
                  <span>deployed {deployed}</span>
                </>
              )}
              {live && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    <span className="text-[var(--color-text-secondary)]">{live.syncedToday}</span>{" "}
                    {live.syncedToday === 1 ? "dev" : "devs"} synced today
                  </span>
                </>
              )}
            </div>
          </div>

          <ol
            ref={listRef}
            className="relative min-h-0 overflow-y-auto px-4 pt-4 scrollbar-hide"
            style={maxHeight ? { maxHeight } : undefined}
          >
            {CHANGELOG.map((entry, index) => {
              const key = monthKey(entry.date);
              const showMonth = key !== lastMonth;
              lastMonth = key;
              return (
                <Fragment key={entry.id}>
                  {showMonth && (
                    <li className="flex gap-3 pb-2">
                      <CommitRail isLast={false} />
                      <span
                        className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]"
                        style={{ fontFamily: "var(--font-mono, monospace)" }}
                      >
                        {MONTH_LABEL.format(new Date(`${entry.date}T00:00:00Z`))}
                      </span>
                    </li>
                  )}
                  <EntryRow entry={entry} isLast={index === CHANGELOG.length - 1} />
                </Fragment>
              );
            })}
          </ol>

          <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-[var(--border-default)] px-4 py-3">
            <a
              href="https://github.com/DHxWhy/CCgather/commits/main"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
            >
              <GitCommitVertical size={13} />
              Full commit history
            </a>
            {onReportBug && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReportBug();
                }}
                className="text-[11px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
              >
                Report a bug
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default WhatsNewModal;
