"use client";

import Link from "next/link";
// Icons removed - using emoji from category info
import type { BeginnerCategory } from "@/types/changelog";
import { BEGINNER_CATEGORY_INFO } from "@/types/changelog";

interface CategoryCardProps {
  category: BeginnerCategory;
  itemCount: number;
}

export default function CategoryCard({ category, itemCount }: CategoryCardProps) {
  const info = BEGINNER_CATEGORY_INFO[category];

  return (
    <Link href={`/news/beginners?category=${category}`} className="block group">
      <article className="p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all text-center">
        {/* Emoji */}
        <div className="text-4xl mb-3">{info.emoji}</div>

        {/* Label */}
        <h3 className="font-semibold text-[var(--color-text-primary)] mb-1 group-hover:text-green-400 transition-colors">
          {info.label}
        </h3>

        {/* Description */}
        <p className="text-xs text-text-muted mb-3">{info.description}</p>

        {/* Item Count */}
        <span className="text-xs text-text-secondary">{itemCount} items</span>
      </article>
    </Link>
  );
}
