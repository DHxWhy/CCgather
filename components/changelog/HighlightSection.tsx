"use client";

import type { ChangelogItem } from "@/types/changelog";
import ChangelogItemCard from "./ChangelogItemCard";

interface HighlightSectionProps {
  highlights: ChangelogItem[];
  title?: string;
}

export default function HighlightSection({
  highlights,
  title = "Highlights",
}: HighlightSectionProps) {
  if (highlights.length === 0) return null;

  // First item is hero (full width), rest are side cards (2 columns below)
  const [heroItem, ...sideItems] = highlights;

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
        <span className="text-yellow-400">⭐</span> {title}
      </h2>

      {/* Hero Card - Full Width (1 Column) */}
      {heroItem && (
        <div className="mb-4">
          <ChangelogItemCard item={heroItem} isHighlight variant="hero" />
        </div>
      )}

      {/* Side Cards - 2 Columns Below */}
      {sideItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sideItems.slice(0, 2).map((item) => (
            <ChangelogItemCard key={item.id} item={item} isHighlight variant="default" />
          ))}
        </div>
      )}
    </section>
  );
}
