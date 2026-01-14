import { Suspense } from "react";
import { Metadata } from "next";
import ToolsContent from "./ToolsContent";

// =====================================================
// Metadata
// =====================================================

export const metadata: Metadata = {
  title: "Developer Tools | CCgather",
  description:
    "Discover and share tools loved by Claude Code developers. Vote for your favorites and help the community find the best developer tools.",
  openGraph: {
    title: "Developer Tools | CCgather",
    description: "Discover and share tools loved by Claude Code developers.",
    type: "website",
  },
};

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
      <div className="max-w-5xl mx-auto px-4 py-8">
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
