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
        aria-label="뉴스 필터"
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
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757]",
                isActive
                  ? `${tag.bgColor} text-[var(--color-text-primary)] border border-[var(--border-default)]`
                  : "bg-[var(--color-bg-secondary)] text-text-muted border border-transparent hover:border-[var(--border-default)]",
                isPending && "opacity-50 cursor-wait"
              )}
              aria-pressed={isActive}
              aria-label={`${tag.label} 필터 ${isActive ? "(선택됨)" : ""}`}
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
    <nav className={cn("flex flex-col gap-1", className)} aria-label="뉴스 필터">
      <div className="text-xs font-medium text-text-muted mb-2 px-2 lg:block hidden">필터</div>
      {NEWS_FILTER_TAGS.map((tag) => {
        const Icon = tag.icon;
        const isActive = currentTag === tag.id;

        return (
          <button
            key={tag.id}
            onClick={() => handleTagChange(tag.id)}
            disabled={isPending}
            className={cn(
              "flex items-center gap-2 lg:gap-3 px-2 lg:px-3 py-2 lg:py-2.5 rounded-lg text-left transition-all duration-200",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]",
              isActive
                ? `${tag.bgColor} border border-[var(--border-default)]`
                : "hover:bg-[var(--color-bg-secondary)] border border-transparent",
              isPending && "opacity-50 cursor-wait"
            )}
            aria-pressed={isActive}
            aria-label={`${tag.label} 필터 ${isActive ? "(선택됨)" : ""}`}
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
                  isActive ? "text-[var(--color-text-primary)]" : "text-text-muted"
                )}
              >
                {tag.label}
              </div>
              {/* Description: only on large screens */}
              <div className="hidden lg:block text-[10px] text-text-muted/70 truncate">
                {tag.description}
              </div>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
