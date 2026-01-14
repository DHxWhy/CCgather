"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, Cpu, Wrench, Globe, Loader2 } from "lucide-react";

// Available filter tags
export const NEWS_FILTER_TAGS = [
  {
    id: "all",
    label: "All",
    icon: Globe,
    description: "모든 뉴스",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "claude",
    label: "Claude",
    icon: Sparkles,
    description: "Claude & Anthropic",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
  },
  {
    id: "dev-tools",
    label: "Dev Tools",
    icon: Wrench,
    description: "개발자 도구",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  {
    id: "industry",
    label: "Industry",
    icon: Cpu,
    description: "AI 업계 소식",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
] as const;

export type NewsFilterTag = (typeof NEWS_FILTER_TAGS)[number]["id"];

interface NewsTagFilterProps {
  currentTag: NewsFilterTag;
  className?: string;
}

export default function NewsTagFilter({ currentTag, className }: NewsTagFilterProps) {
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

  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="뉴스 필터">
      <div className="text-xs font-medium text-text-muted mb-2 px-2">필터</div>
      {NEWS_FILTER_TAGS.map((tag) => {
        const Icon = tag.icon;
        const isActive = currentTag === tag.id;

        return (
          <button
            key={tag.id}
            onClick={() => handleTagChange(tag.id)}
            disabled={isPending}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]",
              isActive
                ? `${tag.bgColor} border border-[var(--border-default)]`
                : "hover:bg-[var(--color-bg-secondary)] border border-transparent",
              isPending && "opacity-50 cursor-wait"
            )}
            aria-pressed={isActive}
            aria-label={`${tag.label} 필터 ${isActive ? "(선택됨)" : ""}`}
          >
            <div className={cn("p-1.5 rounded-md", tag.bgColor)}>
              {isPending && isActive ? (
                <Loader2 className={cn("w-4 h-4 animate-spin", tag.color)} />
              ) : (
                <Icon className={cn("w-4 h-4", tag.color)} aria-hidden="true" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "text-sm font-medium",
                  isActive ? "text-[var(--color-text-primary)]" : "text-text-muted"
                )}
              >
                {tag.label}
              </div>
              <div className="text-[10px] text-text-muted/70 truncate">{tag.description}</div>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
