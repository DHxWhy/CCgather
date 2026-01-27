"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { COMMUNITY_FILTER_TAGS, type CommunityFilterTag } from "./community-tags";

export { COMMUNITY_FILTER_TAGS, type CommunityFilterTag };

interface CommunityFilterProps {
  currentTag: CommunityFilterTag;
  className?: string;
  variant?: "desktop" | "mobile";
}

export default function CommunityFilter({
  currentTag,
  className,
  variant = "desktop",
}: CommunityFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleTagChange = useCallback(
    (tagId: CommunityFilterTag) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tagId);
      startTransition(() => {
        router.push(`/community?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams]
  );

  // Mobile variant: horizontal compact buttons - Minimal Glass Style
  if (variant === "mobile") {
    return (
      <nav
        className={cn("flex items-center gap-2 overflow-x-auto scrollbar-hide", className)}
        aria-label="Community filter"
      >
        {COMMUNITY_FILTER_TAGS.map((tag) => {
          const Icon = tag.icon;
          const isActive = currentTag === tag.id;

          return (
            <button
              key={tag.id}
              onClick={() => handleTagChange(tag.id)}
              disabled={isPending}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 border",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-primary)]/20",
                "transition-all duration-200",
                isActive
                  ? "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] border-[var(--border-default)] shadow-sm"
                  : "bg-transparent text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)] hover:border-[var(--border-default)]/50",
                isPending && "opacity-50 cursor-wait"
              )}
              aria-pressed={isActive}
              aria-label={`${tag.label} filter ${isActive ? "(selected)" : ""}`}
            >
              {isPending && isActive ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Icon
                  className={cn("w-4 h-4", isActive ? "opacity-100" : "opacity-60")}
                  aria-hidden="true"
                />
              )}
              {tag.label}
            </button>
          );
        })}
      </nav>
    );
  }

  // Desktop variant: larger clickable cards - Minimal Glass Style
  return (
    <nav className={cn("flex flex-col gap-2", className)} aria-label="Community filter">
      {COMMUNITY_FILTER_TAGS.map((tag) => {
        const Icon = tag.icon;
        const isActive = currentTag === tag.id;

        return (
          <button
            key={tag.id}
            onClick={() => handleTagChange(tag.id)}
            disabled={isPending}
            className={cn(
              "flex items-center gap-3 px-3 py-3 rounded-xl text-left border",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-primary)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]",
              "transition-all duration-200",
              isActive
                ? "bg-[var(--color-bg-card)] border-[var(--border-default)] shadow-sm"
                : "bg-transparent border-transparent hover:bg-[var(--color-bg-secondary)]/50 hover:border-[var(--border-default)]/50",
              isPending && "opacity-50 cursor-wait"
            )}
            aria-pressed={isActive}
            aria-label={`${tag.label} filter ${isActive ? "(selected)" : ""}`}
          >
            <div
              className={cn(
                "p-2 rounded-lg transition-colors",
                isActive ? "bg-[var(--glass-bg)]" : "bg-[var(--glass-bg)]/50"
              )}
            >
              {isPending && isActive ? (
                <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-primary)]" />
              ) : (
                <Icon
                  className={cn(
                    "w-5 h-5",
                    isActive ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"
                  )}
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "text-sm font-medium",
                  isActive
                    ? "text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)]"
                )}
              >
                {tag.label}
              </div>
              <div className="hidden lg:block text-[10px] text-[var(--color-text-muted)]/70 truncate">
                {tag.description}
              </div>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
