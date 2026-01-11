import { Metadata } from "next";
import Link from "next/link";
import { Users, Trophy, Globe, MessageSquare, ArrowRight } from "lucide-react";

// ===========================================
// SEO Metadata
// ===========================================

export const metadata: Metadata = {
  title: "Community | CCgather - Claude Code Developer Community",
  description:
    "Join the Claude Code developer community. Track your progress on leaderboards, compete in country rankings, and earn badges.",
  keywords: [
    "Claude Code",
    "developer community",
    "leaderboard",
    "AI developers",
    "coding community",
    "Claude Code rankings",
  ],
  openGraph: {
    title: "Community | CCgather",
    description: "Join the Claude Code developer community",
    type: "website",
  },
};

// ===========================================
// Feature Card Component
// ===========================================

function FeatureCard({
  icon: Icon,
  title,
  description,
  href,
  iconBg,
  iconColor,
  hoverBorder,
}: {
  icon: typeof Users;
  title: string;
  description: string;
  href: string;
  iconBg: string;
  iconColor: string;
  hoverBorder: string;
}) {
  const isExternal = href.startsWith("http");

  const CardContent = (
    <div
      className={`group h-full p-6 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] ${hoverBorder} transition-all cursor-pointer`}
    >
      <div className={`p-3 rounded-xl ${iconBg} w-fit mb-4`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <h3 className="font-semibold text-[var(--color-text-primary)] mb-2 group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-sm text-text-secondary mb-4 leading-relaxed">{description}</p>
      <span className="inline-flex items-center gap-1.5 text-sm text-primary font-medium group-hover:gap-2.5 transition-all">
        {isExternal ? "Join" : "Explore"} <ArrowRight className="w-4 h-4" />
      </span>
    </div>
  );

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {CardContent}
      </a>
    );
  }

  return <Link href={href}>{CardContent}</Link>;
}

// ===========================================
// Stats Component
// ===========================================

function CommunityStats() {
  const stats = [
    { label: "Active Developers", value: "1,200+", color: "text-primary" },
    { label: "Countries", value: "45+", color: "text-green-400" },
    { label: "Total Tokens Tracked", value: "50M+", color: "text-yellow-400" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 p-6 rounded-xl bg-white/[0.02] border border-white/10">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <div className={`text-xl sm:text-2xl md:text-3xl font-bold ${stat.color}`}>
            {stat.value}
          </div>
          <div className="text-xs text-text-muted mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

// ===========================================
// Main Page Component
// ===========================================

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      {/* Header */}
      <header className="mb-10 md:mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 text-purple-400 text-sm font-medium mb-4">
          <Users className="w-4 h-4" />
          Community
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-3">
          Claude Code Developer Community
        </h1>
        <p className="text-text-muted max-w-xl mx-auto text-sm md:text-base">
          Grow with developers worldwide. Track your token usage, climb the rankings, and collect
          badges.
        </p>
      </header>

      {/* Stats */}
      <section className="mb-10 md:mb-12">
        <CommunityStats />
      </section>

      {/* Features Grid */}
      <section className="mb-10 md:mb-12">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-6">
          Community Features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FeatureCard
            icon={Trophy}
            title="Global Leaderboard"
            description="Compare your token usage with Claude Code developers worldwide and compete for the top spots."
            href="/leaderboard"
            iconBg="bg-yellow-500/10"
            iconColor="text-yellow-400"
            hoverBorder="hover:border-yellow-500/30"
          />
          <FeatureCard
            icon={Globe}
            title="Country Rankings"
            description="See where you rank in your country. Connect with local developers and represent your region!"
            href="/leaderboard"
            iconBg="bg-green-500/10"
            iconColor="text-green-400"
            hoverBorder="hover:border-green-500/30"
          />
          <FeatureCard
            icon={MessageSquare}
            title="Discord Community"
            description="Chat with other developers in real-time. Share tips, ask questions, and make friends."
            href="https://discord.gg/ccgather"
            iconBg="bg-blue-500/10"
            iconColor="text-blue-400"
            hoverBorder="hover:border-blue-500/30"
          />
          <FeatureCard
            icon={Users}
            title="Developer Profiles"
            description="Customize your profile, showcase your badges, and share your achievements with the world."
            href="/leaderboard"
            iconBg="bg-purple-500/10"
            iconColor="text-purple-400"
            hoverBorder="hover:border-purple-500/30"
          />
        </div>
      </section>

      {/* CTA */}
      <section className="text-center p-8 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/5 border border-primary/20">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">
          Not signed up yet?
        </h2>
        <p className="text-text-secondary mb-6 text-sm md:text-base">
          Install the CLI and start tracking your tokens. It&apos;s free!
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/leaderboard"
            className="px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
          >
            View Leaderboard
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl bg-white/5 text-[var(--color-text-primary)] font-semibold hover:bg-white/10 transition-colors border border-white/10"
          >
            Install CLI
          </Link>
        </div>
      </section>
    </div>
  );
}
