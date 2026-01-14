"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import ShareButtons from "./ShareButtons";

// ===========================================
// Types
// ===========================================

interface CTASectionProps {
  articleUrl: string;
  articleTitle: string;
  oneLiner?: string;
}

interface FetchState {
  isLoggedIn: boolean;
  userCount: number | null;
  isLoading: boolean;
}

// ===========================================
// Component
// ===========================================

function CTASectionComponent({ articleUrl, articleTitle, oneLiner }: CTASectionProps) {
  const [state, setState] = useState<FetchState>({
    isLoggedIn: false,
    userCount: null,
    isLoading: true,
  });

  // Combine both fetches into a single effect with Promise.all for parallel execution
  const fetchData = useCallback(async () => {
    try {
      const [authRes, statsRes] = await Promise.all([
        fetch("/api/auth/session").catch(() => null),
        fetch("/api/stats/users").catch(() => null),
      ]);

      const [authData, statsData] = await Promise.all([
        authRes?.json().catch(() => null),
        statsRes?.json().catch(() => null),
      ]);

      setState({
        isLoggedIn: !!authData?.user,
        userCount: statsData?.count ?? null,
        isLoading: false,
      });
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { isLoggedIn, userCount, isLoading } = state;

  // Show nothing while loading to prevent layout shift
  if (isLoading) {
    return (
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 animate-pulse">
        <div className="h-20" />
      </div>
    );
  }

  // Member view: Share buttons
  if (isLoggedIn) {
    return (
      <section
        className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20"
        aria-labelledby="share-heading"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 id="share-heading" className="text-lg font-semibold text-white mb-1">
              Was this article helpful?
            </h3>
            <p className="text-sm text-text-muted">Share it with your fellow developers</p>
          </div>
          <ShareButtons url={articleUrl} title={articleTitle} oneLiner={oneLiner} />
        </div>
      </section>
    );
  }

  // Non-member view: CTA
  return (
    <section
      className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-purple-500/10 border border-orange-500/20"
      aria-labelledby="cta-heading"
    >
      <div className="flex flex-col items-center text-center sm:text-left sm:flex-row sm:items-center gap-6">
        <div className="flex-1">
          <h3
            id="cta-heading"
            className="text-xl font-semibold text-white mb-2 flex items-center gap-2 justify-center sm:justify-start"
          >
            <Sparkles className="w-5 h-5 text-orange-400" aria-hidden="true" />
            Are you a Claude Code user?
          </h3>
          <p className="text-text-muted mb-3">
            Join CCgather and share your usage to discover how other developers are using Claude
            Code.
          </p>
          {userCount && (
            <p className="text-sm text-orange-400 font-medium" aria-live="polite">
              {userCount.toLocaleString()} developers have joined
            </p>
          )}
        </div>

        <nav className="flex flex-col sm:flex-row gap-3" aria-label="Sign up options">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-white/20 text-white/70 font-medium hover:bg-white/5 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Learn More
          </Link>
        </nav>
      </div>
    </section>
  );
}

const CTASection = memo(CTASectionComponent);
export default CTASection;
