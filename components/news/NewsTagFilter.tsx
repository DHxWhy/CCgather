"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { NEWS_FILTER_TAGS, type NewsFilterTag } from "./news-tags";

export { NEWS_FILTER_TAGS, type NewsFilterTag };

interface NewsTagFilterProps {
  currentTag: NewsFilterTag;
  className?: string;
  variant?: "desktop" | "mobile";
}

export default function NewsTagFilter({
  currentTag,
  className,
  variant = "desktop",
}: NewsTagFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleTagChange = useCallback(
    (tagId: NewsFilterTag) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tagId === "all") {
        params.delete("tag");
      } else {
        params.set("tag", tagId);
      }
      startTransition(() => {
        router.push(`/news?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams]
  );

  // Mobile variant: horizontal compact buttons
  if (variant === "mobile") {
    return (
      <nav
        className={cn("flex items-center gap-2 overflow-x-auto scrollbar-hide", className)}
        aria-label="News filter"
      >
        {NEWS_FILTER_TAGS.map((tag) => {
          const Icon = tag.icon;
          const isActive = currentTag === tag.id;

          return (
            <button
              key={tag.id}
              onClick={() => handleTagChange(tag.id)}
              disabled={isPending}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757]",
                isActive
                  ? `${tag.bgColor} text-[var(--color-text-primary)] border border-[var(--border-default)]`
                  : "bg-[var(--color-section-bg)] text-[var(--color-text-muted)] border border-transparent hover:bg-[var(--color-section-bg-hover)] hover:border-[var(--border-default)]",
                isPending && "opacity-50 cursor-wait"
              )}
              aria-pressed={isActive}
              aria-label={`${tag.label} filter ${isActive ? "(selected)" : ""}`}
            >
              {isPending && isActive ? (
                <Loader2 className={cn("w-3.5 h-3.5 animate-spin", tag.color)} />
              ) : (
                <Icon className={cn("w-3.5 h-3.5", tag.color)} aria-hidden="true" />
              )}
              {tag.label}
            </button>
          );
        })}
      </nav>
    );
  }

  // Desktop variant: vertical list (tablet: compact, desktop: with descriptions)
  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="News filter">
      <div className="text-xs font-medium text-[var(--color-text-muted)] mb-2 px-2 lg:block hidden">
        Filter
      </div>
      {NEWS_FILTER_TAGS.map((tag) => {
        const Icon = tag.icon;
        const isActive = currentTag === tag.id;

        return (
          <button
            key={tag.id}
            onClick={() => handleTagChange(tag.id)}
            disabled={isPending}
            className={cn(
              "flex items-center gap-2 lg:gap-3 px-2 lg:px-3 py-2 lg:py-2.5 rounded-lg text-left",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]",
              isActive
                ? `${tag.bgColor} border border-[var(--border-default)]`
                : "bg-[var(--color-section-bg)] hover:bg-[var(--color-section-bg-hover)] border border-transparent",
              isPending && "opacity-50 cursor-wait"
            )}
            aria-pressed={isActive}
            aria-label={`${tag.label} filter ${isActive ? "(selected)" : ""}`}
          >
            <div className={cn("p-1 lg:p-1.5 rounded-md", tag.bgColor)}>
              {isPending && isActive ? (
                <Loader2 className={cn("w-4 h-4 animate-spin", tag.color)} />
              ) : (
                <Icon className={cn("w-4 h-4", tag.color)} aria-hidden="true" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "text-xs lg:text-sm font-medium",
                  isActive ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"
                )}
              >
                {tag.label}
              </div>
              {/* Description: only on large screens */}
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
