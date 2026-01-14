"use client";

import { useRef, useCallback, memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ===========================================
// Constants
// ===========================================

const SCROLL_PERCENTAGE = 0.8;

// ===========================================
// Types
// ===========================================

interface HorizontalScrollSectionProps {
  children: React.ReactNode;
  showControls?: boolean;
  /** Accessible label for the scroll region */
  ariaLabel?: string;
}

// ===========================================
// Component
// ===========================================

function HorizontalScrollSectionComponent({
  children,
  showControls = true,
  ariaLabel = "Horizontal scroll content",
}: HorizontalScrollSectionProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Memoized scroll handler to prevent recreation on each render
  const scrollLeft = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    container.scrollBy({
      left: -(container.clientWidth * SCROLL_PERCENTAGE),
      behavior: "smooth",
    });
  }, []);

  const scrollRight = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    container.scrollBy({
      left: container.clientWidth * SCROLL_PERCENTAGE,
      behavior: "smooth",
    });
  }, []);

  return (
    <div className="relative group/scroll" role="region" aria-label={ariaLabel}>
      {/* Scroll Controls */}
      {showControls && (
        <>
          <button
            type="button"
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 dark:bg-black/80 border border-[var(--border-default)] flex items-center justify-center text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white hover:border-[var(--border-hover)] transition-all opacity-0 group-hover/scroll:opacity-100 -translate-x-4 hover:scale-110 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-orange-500"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 dark:bg-black/80 border border-[var(--border-default)] flex items-center justify-center text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white hover:border-[var(--border-hover)] transition-all opacity-0 group-hover/scroll:opacity-100 translate-x-4 hover:scale-110 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-orange-500"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </>
      )}

      {/* Gradient Fade Effects */}
      <div
        className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--color-bg-primary)] to-transparent z-[5] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--color-bg-primary)] to-transparent z-[5] pointer-events-none"
        aria-hidden="true"
      />

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 scroll-smooth snap-x snap-mandatory"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        tabIndex={0}
        role="list"
      >
        {children}
      </div>
    </div>
  );
}

const HorizontalScrollSection = memo(HorizontalScrollSectionComponent);
export default HorizontalScrollSection;
