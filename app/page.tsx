import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CLIButton } from "@/components/cli/CLIButton";
import { LiveStatsTicker } from "@/components/stats/LiveStatsTicker";
import { GetStartedButton } from "@/components/auth/GetStartedButton";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-primary)]">
      {/* Shared Header */}
      <Header />

      {/* Hero */}
      <main className="flex-1 pt-32 pb-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <p className="text-xs text-[var(--color-claude-coral)] font-medium tracking-wide uppercase mb-4">
            Claude Code Leaderboard
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold text-[var(--color-text-primary)] leading-tight mb-4">
            Track your usage.
            <br />
            <span className="text-[var(--color-text-secondary)]">Compete globally.</span>
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto mb-8 leading-relaxed">
            The definitive leaderboard for Claude Code developers. See where you rank among
            thousands of developers worldwide.
          </p>

          <div className="flex gap-3 justify-center mb-16">
            <SignedOut>
              <GetStartedButton className="px-5 py-2.5 rounded-lg bg-[var(--color-claude-coral)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
                Get Started
              </GetStartedButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/leaderboard"
                className="px-5 py-2.5 rounded-lg bg-[var(--color-claude-coral)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                View Rankings
              </Link>
            </SignedIn>
            <Link
              href="/leaderboard"
              className="px-5 py-2.5 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-default)] text-[var(--color-text-secondary)] text-sm font-medium hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Explore
            </Link>
          </div>

          {/* Live Stats Ticker */}
          <div className="max-w-lg mx-auto mb-20">
            <LiveStatsTicker variant="full" />
          </div>

          {/* Section Divider */}
          <div className="section-divider-sm mb-12" />

          {/* How It Works */}
          <div className="max-w-lg mx-auto">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-6">
              How it works
            </p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { num: "01", title: "Sign in", desc: "Quick & secure" },
                { num: "02", title: "Install", desc: "npx ccgather" },
                { num: "03", title: "Track", desc: "Auto sync" },
              ].map((item) => (
                <div key={item.num} className="text-center">
                  <div className="text-[10px] text-[var(--color-claude-coral)] font-mono mb-2">
                    {item.num}
                  </div>
                  <div className="text-xs font-medium text-[var(--color-text-primary)] mb-1">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CLI Section */}
        <div className="mx-auto max-w-2xl px-6 mt-20">
          <div className="section-divider-sm mb-12" />

          <div className="text-center mb-8">
            <p className="text-[10px] text-[var(--color-claude-coral)] uppercase tracking-wider mb-3">
              Command Line Interface
            </p>
            <h2 className="text-xl md:text-2xl font-semibold text-[var(--color-text-primary)] mb-3">
              One command to rule them all
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Install once, sync automatically. No manual tracking needed.
            </p>
          </div>

          {/* CLI Install Command */}
          <div className="glass rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                Quick Install
              </span>
              <span className="text-[10px] text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                Ready
              </span>
            </div>
            <div className="bg-[var(--color-bg-elevated)] rounded-lg p-3 font-mono text-sm">
              <span className="text-[var(--color-text-muted)]">$</span>{" "}
              <span className="text-[var(--color-claude-coral)]">npx</span>{" "}
              <span className="text-[var(--color-text-primary)]">ccgather</span>
            </div>
          </div>

          {/* CLI Features */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { icon: "⚡", title: "Auto Sync", desc: "Syncs your usage data" },
              { icon: "🔐", title: "Secure", desc: "Browser-based login" },
              { icon: "📊", title: "Real-time", desc: "Instant updates" },
              { icon: "🎯", title: "Zero Config", desc: "Just works" },
            ].map((feature) => (
              <div key={feature.title} className="glass rounded-lg p-3 text-left">
                <div className="text-lg mb-1">{feature.icon}</div>
                <div className="text-xs font-medium text-[var(--color-text-primary)] mb-0.5">
                  {feature.title}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)]">{feature.desc}</div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <CLIButton className="text-sm text-[var(--color-claude-coral)] hover:underline">
              View all commands →
            </CLIButton>
          </div>
        </div>
      </main>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* Shared Footer */}
      <Footer />
    </div>
  );
}
