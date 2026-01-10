"use client";

import { useState } from "react";
import {
  Sparkles,
  BookOpen,
  GitCommit,
  Users,
  Clock,
  Zap,
  ChevronRight,
  Flame,
  ArrowRight,
} from "lucide-react";

// Types
interface NewsItem {
  id: string;
  title: string;
  content: string;
  category: "tip" | "guide" | "changelog" | "community";
  published_at: string;
  read_time?: number;
  difficulty?: "beginner" | "intermediate" | "advanced";
  featured?: boolean;
}

// Category Configuration
const CATEGORIES = {
  tip: {
    icon: Sparkles,
    label: "Tips",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    gradient: "from-yellow-500/20 to-yellow-600/5",
  },
  guide: {
    icon: BookOpen,
    label: "Guides",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    gradient: "from-blue-500/20 to-blue-600/5",
  },
  changelog: {
    icon: GitCommit,
    label: "Changelog",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    gradient: "from-green-500/20 to-green-600/5",
  },
  community: {
    icon: Users,
    label: "Community",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    gradient: "from-purple-500/20 to-purple-600/5",
  },
};

const DIFFICULTY_STYLES = {
  beginner: { label: "Beginner", color: "text-green-400", bg: "bg-green-500/10" },
  intermediate: { label: "Intermediate", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  advanced: { label: "Advanced", color: "text-red-400", bg: "bg-red-500/10" },
};

// Placeholder Data
const FEATURED_ARTICLE: NewsItem = {
  id: "featured-1",
  title: "10 Token-Saving Patterns Every Claude Code Developer Should Know",
  content:
    "Master these essential patterns to reduce your token usage by up to 40%. From smart context management to efficient prompting strategies, learn how top developers optimize their Claude Code workflow.",
  category: "guide",
  published_at: new Date().toISOString(),
  read_time: 8,
  difficulty: "intermediate",
  featured: true,
};

const QUICK_TIPS: NewsItem[] = [
  {
    id: "tip-1",
    title: "Use --resume flag to save tokens",
    content: "Continue previous conversations without losing context.",
    category: "tip",
    published_at: new Date().toISOString(),
    read_time: 1,
    difficulty: "beginner",
  },
  {
    id: "tip-2",
    title: "Batch your file operations",
    content: "Group related edits in a single prompt for efficiency.",
    category: "tip",
    published_at: new Date().toISOString(),
    read_time: 2,
    difficulty: "intermediate",
  },
  {
    id: "tip-3",
    title: "Use .claudeignore wisely",
    content: "Exclude large files and directories from context.",
    category: "tip",
    published_at: new Date().toISOString(),
    read_time: 1,
    difficulty: "beginner",
  },
];

const NEWS_ITEMS: NewsItem[] = [
  {
    id: "1",
    title: "New Badge System Released",
    content:
      "We have introduced a new badge system with 17 unique badges across 4 categories. Complete challenges and earn badges to showcase your Claude Code expertise.",
    category: "changelog",
    published_at: new Date(Date.now() - 86400000).toISOString(),
    read_time: 3,
  },
  {
    id: "2",
    title: "Country Leagues Now Available",
    content:
      "Compete with developers from your country! Country leagues show rankings within each nation, fostering local competition and community.",
    category: "community",
    published_at: new Date(Date.now() - 172800000).toISOString(),
    read_time: 2,
  },
  {
    id: "3",
    title: "Getting Started with Claude Code CLI",
    content:
      "A comprehensive guide to setting up and using the CCgather CLI tool to track your Claude Code usage and climb the leaderboard.",
    category: "guide",
    published_at: new Date(Date.now() - 259200000).toISOString(),
    read_time: 10,
    difficulty: "beginner",
  },
  {
    id: "4",
    title: "Advanced Context Management Techniques",
    content:
      "Learn how expert developers manage context windows to maximize productivity while minimizing token usage.",
    category: "guide",
    published_at: new Date(Date.now() - 345600000).toISOString(),
    read_time: 15,
    difficulty: "advanced",
  },
  {
    id: "5",
    title: "Weekly Token Stats Update",
    content:
      "This week's global statistics: 2.5M total tokens tracked, 150 new developers joined, and Korea leads the regional rankings!",
    category: "community",
    published_at: new Date(Date.now() - 432000000).toISOString(),
    read_time: 2,
  },
  {
    id: "6",
    title: "CLI v1.3.26 Released",
    content:
      "New version includes improved error handling, faster submission times, and better offline support.",
    category: "changelog",
    published_at: new Date(Date.now() - 518400000).toISOString(),
    read_time: 3,
  },
];

// Components
function FeaturedHero({ article }: { article: NewsItem }) {
  const category = CATEGORIES[article.category];
  const CategoryIcon = category.icon;
  const difficulty = article.difficulty ? DIFFICULTY_STYLES[article.difficulty] : null;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-6 md:p-8 group hover:border-white/20 transition-all duration-300">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/5 opacity-50" />

      {/* Featured Badge */}
      <div className="relative flex items-center gap-2 mb-4">
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium">
          <Flame className="w-3.5 h-3.5" />
          Featured Guide
        </span>
      </div>

      <div className="relative">
        <h2 className="text-xl md:text-2xl font-semibold text-[var(--color-text-primary)] mb-3 group-hover:text-primary transition-colors">
          {article.title}
        </h2>
        <p className="text-text-secondary leading-relaxed mb-6 max-w-2xl">{article.content}</p>

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className={`flex items-center gap-1.5 ${category.color}`}>
            <CategoryIcon className="w-4 h-4" />
            {category.label}
          </span>
          {article.read_time && (
            <span className="flex items-center gap-1.5 text-text-muted">
              <Clock className="w-4 h-4" />
              {article.read_time} min read
            </span>
          )}
          {difficulty && (
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${difficulty.bg} ${difficulty.color}`}
            >
              {difficulty.label}
            </span>
          )}
          <span className="flex items-center gap-1 text-primary group-hover:gap-2 transition-all cursor-pointer">
            Read more <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </article>
  );
}

function QuickTipCard({ item }: { item: NewsItem }) {
  const difficulty = item.difficulty ? DIFFICULTY_STYLES[item.difficulty] : null;

  return (
    <article className="flex-shrink-0 w-72 p-4 rounded-xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-transparent hover:border-yellow-500/40 transition-all group cursor-pointer">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-yellow-500/20">
          <Zap className="w-4 h-4 text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--color-text-primary)] text-sm mb-1 group-hover:text-yellow-400 transition-colors">
            {item.title}
          </h3>
          <p className="text-xs text-text-muted line-clamp-2">{item.content}</p>
          <div className="flex items-center gap-2 mt-2">
            {item.read_time && (
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {item.read_time}m
              </span>
            )}
            {difficulty && (
              <span className={`text-xs ${difficulty.color}`}>{difficulty.label}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const category = CATEGORIES[item.category];
  const CategoryIcon = category.icon;
  const difficulty = item.difficulty ? DIFFICULTY_STYLES[item.difficulty] : null;

  const date = new Date(item.published_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <article
      className={`p-5 rounded-xl border ${category.border} bg-gradient-to-br ${category.gradient} hover:bg-white/[0.03] transition-all group cursor-pointer`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className={`flex items-center gap-1.5 text-xs font-medium ${category.color}`}>
          <CategoryIcon className="w-3.5 h-3.5" />
          {category.label}
        </span>
        <span className="text-xs text-text-muted">{date}</span>
      </div>

      {/* Content */}
      <h3 className="font-semibold text-[var(--color-text-primary)] mb-2 group-hover:text-primary transition-colors line-clamp-2">
        {item.title}
      </h3>
      <p className="text-sm text-text-secondary line-clamp-2 mb-3">{item.content}</p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          {item.read_time && (
            <span className="text-text-muted flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {item.read_time} min
            </span>
          )}
          {difficulty && <span className={`${difficulty.color}`}>{difficulty.label}</span>}
        </div>
        <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </div>
    </article>
  );
}

function CategoryFilter({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (category: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          selected === null
            ? "bg-primary/20 text-primary"
            : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-primary"
        }`}
      >
        All
      </button>
      {Object.entries(CATEGORIES).map(([key, { icon: Icon, label, color, bg }]) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            selected === key
              ? `${bg} ${color}`
              : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-primary"
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

export default function NewsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredNews = selectedCategory
    ? NEWS_ITEMS.filter((item) => item.category === selectedCategory)
    : NEWS_ITEMS;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)] mb-2">
          News & Resources
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Tips, guides, and updates for Claude Code developers
        </p>
      </header>

      {/* Featured Article */}
      <section className="mb-10">
        <FeaturedHero article={FEATURED_ARTICLE} />
      </section>

      {/* Quick Tips Section */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
            <Zap className="w-5 h-5 text-yellow-400" />
            Quick Tips
          </h2>
          <button className="text-sm text-text-muted hover:text-primary transition-colors flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {QUICK_TIPS.map((tip) => (
            <QuickTipCard key={tip.id} item={tip} />
          ))}
        </div>
      </section>

      {/* Category Filter */}
      <section className="mb-6">
        <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} />
      </section>

      {/* News Grid */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Latest Updates
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNews.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Load More */}
      <div className="mt-8 text-center">
        <button className="px-6 py-3 rounded-xl bg-white/5 text-text-secondary hover:bg-white/10 hover:text-[var(--color-text-primary)] transition-all border border-white/10 hover:border-white/20">
          Load More
        </button>
      </div>
    </div>
  );
}
