import { Suspense } from "react";
import { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import Image from "next/image";
import ToolsContent from "./ToolsContent";
import { CATEGORY_META, TOOL_CATEGORIES, type ToolCategory } from "@/lib/types/tools";

// =====================================================
// Quick Links (from News page)
// =====================================================

const QUICK_LINKS = [
  {
    title: "Claude Code Changelog",
    description: "Official release notes",
    url: "https://docs.anthropic.com/en/docs/claude-code/changelog",
    logo: "/logos/claude-symbol-clay.svg",
    color: "claude" as const,
  },
  {
    title: "Anthropic News",
    description: "Official announcements",
    url: "https://www.anthropic.com/news",
    logo: "/logos/anthropic-icon-ivory.svg",
    color: "anthropic" as const,
  },
  {
    title: "Claude Code Docs",
    description: "Documentation & guides",
    url: "https://docs.anthropic.com/en/docs/claude-code",
    logo: "/logos/claude-symbol-clay.svg",
    color: "claude" as const,
  },
];

const COLOR_CLASSES = {
  claude:
    "bg-[#D97757]/20 dark:bg-[#D97757]/25 hover:border-[#D97757]/50 hover:bg-[#D97757]/30 dark:hover:bg-[#D97757]/35",
  anthropic:
    "bg-black/10 dark:bg-white/15 hover:border-black/20 dark:hover:border-white/30 hover:bg-black/15 dark:hover:bg-white/20",
} as const;

const LOGO_BG_CLASSES = {
  claude: "bg-[#D97757]/20 dark:bg-[#D97757]/25",
  anthropic: "bg-black/10 dark:bg-white/10",
} as const;

function QuickLinkCard({ link }: { link: (typeof QUICK_LINKS)[number] }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-center gap-3 p-3 rounded-xl border border-[var(--border-default)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] ${COLOR_CLASSES[link.color]}`}
      aria-label={`${link.title} - ${link.description} (opens in new tab)`}
    >
      <div className={`p-2 rounded-lg ${LOGO_BG_CLASSES[link.color]} transition-colors`}>
        <Image
          src={link.logo}
          alt=""
          width={18}
          height={18}
          className="w-[18px] h-[18px]"
          aria-hidden="true"
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[var(--color-text-primary)] text-xs group-hover:text-white transition-colors">
          {link.title}
        </h3>
        <p className="text-[10px] text-text-muted">{link.description}</p>
      </div>
      <ExternalLink
        className="w-3.5 h-3.5 text-text-muted group-hover:text-white/60 transition-colors flex-shrink-0"
        aria-hidden="true"
      />
    </a>
  );
}

// =====================================================
// Dynamic Metadata for SEO
// =====================================================

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const PERIOD_LABELS: Record<string, string> = {
  day: "Today's",
  week: "This Week's",
  month: "This Month's",
  all: "All Time",
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const category = params.category as ToolCategory | "all" | undefined;
  const period = (params.period as string) || "week";

  // Build dynamic title and description
  const isValidCategory =
    category && category !== "all" && TOOL_CATEGORIES.includes(category as ToolCategory);
  const categoryMeta = isValidCategory ? CATEGORY_META[category as ToolCategory] : null;

  const periodLabel = PERIOD_LABELS[period] || "This Week's";
  const categoryLabel = categoryMeta ? categoryMeta.label : "Developer";
  const categoryEmoji = categoryMeta ? categoryMeta.emoji : "🛠️";

  const title = isValidCategory
    ? `${categoryEmoji} ${categoryLabel} Tools - Claude Code Tools`
    : "Developer Tools - Claude Code Tools & Extensions";

  const description = isValidCategory
    ? `Discover ${periodLabel.toLowerCase()} best ${categoryLabel.toLowerCase()} tools for Claude Code developers. Browse, vote, and share ${categoryLabel.toLowerCase()} tools with the community.`
    : "Discover and share tools loved by Claude Code developers. MCP servers, IDE extensions, AI coding tools, and productivity apps. Vote for your favorites and help the community discover the best developer tools.";

  const ogDescription = isValidCategory
    ? `${periodLabel} top ${categoryLabel.toLowerCase()} tools for Claude Code developers.`
    : "Discover and share tools loved by Claude Code developers. MCP servers, extensions, and AI coding tools.";

  return {
    title,
    description,
    keywords: [
      "Claude Code tools",
      "MCP servers",
      "AI coding tools",
      "developer tools",
      "Claude Code extensions",
      "IDE integrations",
      "AI productivity tools",
      "Claude Code MCP",
      "best developer tools",
      "AI developer tools",
      ...(categoryMeta ? [`${categoryMeta.label} tools`, `Claude Code ${categoryMeta.label}`] : []),
    ],
    openGraph: {
      title: isValidCategory ? `${categoryLabel} Tools - CCgather` : "Developer Tools - CCgather",
      description: ogDescription,
      type: "website",
      url: "https://ccgather.com/tools",
    },
    twitter: {
      card: "summary_large_image",
      title: isValidCategory ? `${categoryLabel} Tools - CCgather` : "Developer Tools - CCgather",
      description: ogDescription,
    },
    alternates: {
      canonical: "https://ccgather.com/tools",
    },
  };
}

// =====================================================
// Loading Skeleton
// =====================================================

function ToolsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-4 mb-6">
        <div className="h-10 w-32 bg-[var(--color-bg-elevated)] rounded-lg" />
        <div className="h-10 w-24 bg-[var(--color-bg-elevated)] rounded-lg" />
        <div className="ml-auto h-10 w-32 bg-[var(--color-bg-elevated)] rounded-lg" />
      </div>

      {/* Category Tabs Skeleton */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-24 bg-[var(--color-bg-elevated)] rounded-full flex-shrink-0"
          />
        ))}
      </div>

      {/* List Skeleton */}
      <div className="space-y-2 mt-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-bg-card)] border border-[var(--border-default)]"
          >
            <div className="w-8 h-8 bg-[var(--color-bg-elevated)] rounded-md" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-[var(--color-bg-elevated)] rounded" />
              <div className="h-3 w-48 bg-[var(--color-bg-elevated)] rounded" />
            </div>
            <div className="h-7 w-16 bg-[var(--color-bg-elevated)] rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// Page Component
// =====================================================

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="max-w-[1000px] mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            🛠️ Developer Tools
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Discover and share tools loved by Claude Code developers
          </p>
        </header>

        {/* Quick Links */}
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {QUICK_LINKS.map((link) => (
              <QuickLinkCard key={link.title} link={link} />
            ))}
          </div>
        </section>

        {/* Main Content */}
        <Suspense fallback={<ToolsSkeleton />}>
          <ToolsContent />
        </Suspense>
      </div>
    </main>
  );
}
