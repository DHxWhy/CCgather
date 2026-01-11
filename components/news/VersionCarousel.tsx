"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, ArrowRight } from "lucide-react";
import type { UpdatePost } from "@/lib/data/news-content";

interface VersionCarouselProps {
  updates: UpdatePost[];
}

export default function VersionCarousel({ updates }: VersionCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Check scroll state
  const checkScrollState = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    checkScrollState();
    container.addEventListener("scroll", checkScrollState);
    window.addEventListener("resize", checkScrollState);

    return () => {
      container.removeEventListener("scroll", checkScrollState);
      window.removeEventListener("resize", checkScrollState);
    };
  }, [updates]);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const cardWidth = 256; // 240px card + 16px gap
    const scrollAmount = direction === "left" ? -cardWidth : cardWidth;

    container.scrollBy({
      left: scrollAmount,
      behavior: "smooth",
    });
  };

  if (updates.length === 0) {
    return null;
  }

  return (
    <div className="relative group">
      {/* Left Arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/80 backdrop-blur-sm border border-white/10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-black transition-all opacity-0 group-hover:opacity-100 -translate-x-1/2"
          aria-label="이전"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Right Arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/80 backdrop-blur-sm border border-white/10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-black transition-all opacity-0 group-hover:opacity-100 translate-x-1/2"
          aria-label="다음"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Scroll Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {updates.map((post, index) => (
          <VersionCard key={post.slug} post={post} isNewest={index === 0} />
        ))}
      </div>

      {/* Gradient Fade (Right) */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-2 w-16 bg-gradient-to-l from-[var(--color-bg-primary)] to-transparent pointer-events-none" />
      )}
    </div>
  );
}

// Version Card Component
function VersionCard({ post, isNewest }: { post: UpdatePost; isNewest: boolean }) {
  const date = new Date(post.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      href={`/news/updates/${post.slug}`}
      className="flex-shrink-0 w-60 scroll-snap-align-start"
      style={{ scrollSnapAlign: "start" }}
    >
      <article className="group h-full p-5 rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent hover:border-green-500/40 hover:from-green-500/10 transition-all cursor-pointer">
        {/* Header: Version Badge + NEW Badge */}
        <div className="flex items-center justify-between mb-3">
          <span className="px-2.5 py-1 rounded-md bg-green-500/20 text-green-400 text-xs font-mono font-medium">
            {post.version}
          </span>
          {isNewest && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--color-claude-coral)] text-white text-[10px] font-bold uppercase tracking-wider">
              NEW
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-[var(--color-text-primary)] mb-2 group-hover:text-green-400 transition-colors leading-snug line-clamp-2 text-sm">
          {post.title}
        </h3>

        {/* Summary */}
        <p className="text-xs text-text-secondary mb-3 leading-relaxed line-clamp-2">
          {post.summary}
        </p>

        {/* Footer: Date + Read More */}
        <div className="flex items-center justify-between mt-auto">
          <span className="text-[10px] text-text-muted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {date}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-green-400 font-medium group-hover:gap-2 transition-all">
            Read <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </article>
    </Link>
  );
}

// Add to global CSS or tailwind config
// .scrollbar-hide::-webkit-scrollbar { display: none; }
// .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
