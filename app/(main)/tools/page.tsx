import { Suspense } from "react";
import { Metadata } from "next";
import ToolsContent from "./ToolsContent";
import { CATEGORY_META, TOOL_CATEGORIES, type ToolCategory } from "@/types/tools";

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

        {/* Main Content */}
        <Suspense fallback={<ToolsSkeleton />}>
          <ToolsContent />
        </Suspense>
      </div>
    </main>
  );
}
