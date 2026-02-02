import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="max-w-md w-full text-center">
        {/* 404 Visual */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center justify-center">
              <FileQuestion className="w-12 h-12 text-[var(--color-claude-coral)]" />
            </div>
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full bg-[var(--color-claude-coral)] opacity-20 blur-xl -z-10" />
          </div>
        </div>

        {/* 404 Text */}
        <h1 className="text-6xl font-bold gradient-text mb-4">404</h1>
        <h2 className="text-xl font-semibold text-text-primary mb-2">Page Not Found</h2>
        <p className="text-text-secondary mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button variant="primary">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button variant="outline">Leaderboard</Button>
          </Link>
        </div>

        {/* Quick Links */}
        <div className="mt-10 pt-8 border-t border-[var(--border-default)]">
          <p className="text-sm text-text-muted mb-4">Popular destinations:</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/leaderboard"
              className="text-sm text-[var(--color-claude-coral)] hover:text-[var(--color-claude-peach)] transition-colors"
            >
              Leaderboard
            </Link>
            <Link
              href="/community"
              className="text-sm text-[var(--color-claude-coral)] hover:text-[var(--color-claude-peach)] transition-colors"
            >
              Community
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
