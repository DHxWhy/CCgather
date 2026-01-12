import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import CategoryCard from "@/components/beginners/CategoryCard";
import BeginnerItemCard from "@/components/beginners/BeginnerItemCard";
import SearchInput from "@/components/beginners/SearchInput";
import type { BeginnersDictionaryItem, BeginnerCategory } from "@/types/changelog";
import { BEGINNER_CATEGORY_INFO } from "@/types/changelog";

// ===========================================
// SEO Metadata
// ===========================================

export const metadata = {
  title: "Claude Code for Beginners | CCgather - Easy Learning Guide",
  description:
    "Learn Claude Code with everyday examples. A beginner-friendly dictionary explaining commands, flags, and features using simple analogies anyone can understand.",
  keywords: [
    "Claude Code for beginners",
    "Claude Code tutorial",
    "Claude Code guide",
    "vibe coding",
    "learn Claude Code",
    "Claude Code commands explained",
  ],
  openGraph: {
    title: "Claude Code for Beginners | CCgather",
    description: "Learn Claude Code with everyday examples",
    type: "website",
  },
};

// ===========================================
// Data Fetching
// ===========================================

async function getBeginnersData() {
  try {
    const supabase = await createClient();

    // 전체 항목 조회
    const { data: items, error } = await supabase
      .from("beginners_dictionary")
      .select("*")
      .eq("verification_status", "approved")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Failed to fetch beginners dictionary:", error);
      return { items: [], categories: [], featured: [] };
    }

    const allItems = (items || []) as BeginnersDictionaryItem[];

    // 카테고리별 그룹화
    const categoryOrder: BeginnerCategory[] = [
      "getting_started",
      "session",
      "speed",
      "extend",
      "agents",
      "config",
    ];

    const categories = categoryOrder
      .map((category) => {
        const categoryItems = allItems.filter((item) => item.category === category);
        return {
          category,
          info: BEGINNER_CATEGORY_INFO[category],
          items: categoryItems,
          itemCount: categoryItems.length,
        };
      })
      .filter((cat) => cat.itemCount > 0);

    // Featured 항목
    const featured = allItems
      .filter((item) => item.is_featured)
      .sort((a, b) => b.popularity_score - a.popularity_score)
      .slice(0, 4);

    return { items: allItems, categories, featured };
  } catch (error) {
    console.error("Beginners fetch error:", error);
    return { items: [], categories: [], featured: [] };
  }
}

// ===========================================
// Main Page Component
// ===========================================

export default async function BeginnersPage() {
  const { items, categories, featured } = await getBeginnersData();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      {/* Back Link */}
      <Link
        href="/news"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-[var(--color-text-primary)] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to News
      </Link>

      {/* Header */}
      <header className="text-center mb-10 md:mb-12">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-500/10 mb-4">
          <BookOpen className="w-8 h-8 text-blue-400" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          Claude Code for Beginners
        </h1>
        <p className="text-text-muted max-w-lg mx-auto">
          Learn Claude Code with everyday examples. No coding experience required!
        </p>

        {/* Stats */}
        <div className="flex items-center justify-center gap-4 mt-4 text-sm text-text-muted">
          <span>{items.length} items</span>
          <span>•</span>
          <span>{categories.length} categories</span>
        </div>
      </header>

      {/* Search */}
      <div className="max-w-xl mx-auto mb-10">
        <SearchInput />
      </div>

      {/* Empty State */}
      {items.length === 0 && (
        <div className="text-center py-16 text-white/40 bg-white/[0.02] rounded-xl border border-white/10">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg mb-2">Dictionary coming soon!</p>
          <p className="text-sm">We're preparing beginner-friendly guides. Check back later!</p>
        </div>
      )}

      {/* Categories Grid */}
      {categories.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            📂 Categories
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <CategoryCard key={cat.category} category={cat.category} itemCount={cat.itemCount} />
            ))}
          </div>
        </section>
      )}

      {/* Popular Items */}
      {featured.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            🔥 Popular
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featured.map((item) => (
              <BeginnerItemCard key={item.id} item={item} variant="featured" />
            ))}
          </div>
        </section>
      )}

      {/* All Items by Category */}
      {categories.map((cat) => (
        <section key={cat.category} className="mb-10">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <span>{cat.info.emoji}</span> {cat.info.label}
            <span className="text-text-muted text-sm font-normal">({cat.itemCount})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cat.items.map((item) => (
              <BeginnerItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
