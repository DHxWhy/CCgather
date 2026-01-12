import { Newspaper, ExternalLink, Building2, FileText, BookOpen, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import OfficialNewsCard from "@/components/news/OfficialNewsCard";
import PressNewsCard from "@/components/news/PressNewsCard";
import type { ContentItem } from "@/types/automation";

// ===========================================
// SEO Metadata
// ===========================================

export const metadata = {
  title: "News | CCgather - Claude Code News and AI Updates",
  description:
    "Stay updated with the latest Claude Code news, AI industry updates, and Anthropic announcements. Get curated news from trusted sources.",
  keywords: [
    "Claude Code",
    "Claude Code news",
    "AI news",
    "Anthropic",
    "AI coding",
    "Claude Code updates",
  ],
  openGraph: {
    title: "News | CCgather",
    description: "Latest Claude Code and AI news curated for developers",
    type: "website",
  },
};

// ===========================================
// Quick Links Data
// ===========================================

const QUICK_LINKS = [
  {
    title: "Claude Code Changelog",
    description: "Official release notes and version history",
    url: "https://docs.anthropic.com/en/docs/claude-code/changelog",
    icon: FileText,
    color: "green",
  },
  {
    title: "Anthropic News",
    description: "Official announcements from Anthropic",
    url: "https://www.anthropic.com/news",
    icon: Building2,
    color: "orange",
  },
  {
    title: "Claude Code Docs",
    description: "Official documentation and guides",
    url: "https://docs.anthropic.com/en/docs/claude-code",
    icon: BookOpen,
    color: "blue",
  },
];

// ===========================================
// Data Fetching
// ===========================================

async function getNewsContent() {
  try {
    const supabase = await createClient();

    // Fetch Claude Code related news (official + claude code keyword)
    const { data: claudeCodeNews } = await supabase
      .from("contents")
      .select("*")
      .eq("type", "news")
      .eq("status", "published")
      .or("content_type.eq.official,content_type.eq.claude_code")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(6);

    // Fetch AI general news (press/general AI news)
    const { data: aiNews } = await supabase
      .from("contents")
      .select("*")
      .eq("type", "news")
      .eq("status", "published")
      .eq("content_type", "press")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(9);

    return {
      claudeCodeNews: (claudeCodeNews || []) as ContentItem[],
      aiNews: (aiNews || []) as ContentItem[],
    };
  } catch (error) {
    console.error("Failed to fetch news content:", error);
    return { claudeCodeNews: [], aiNews: [] };
  }
}

// ===========================================
// Quick Link Card Component
// ===========================================

function QuickLinkCard({ link }: { link: (typeof QUICK_LINKS)[number] }) {
  const colorClasses = {
    green: "bg-green-500/10 text-green-400 hover:border-green-500/40 hover:bg-green-500/15",
    orange: "bg-orange-500/10 text-orange-400 hover:border-orange-500/40 hover:bg-orange-500/15",
    blue: "bg-blue-500/10 text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/15",
  };

  const iconColorClasses = {
    green: "text-green-400",
    orange: "text-orange-400",
    blue: "text-blue-400",
  };

  const Icon = link.icon;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-center gap-4 p-4 rounded-xl border border-white/10 transition-all ${colorClasses[link.color as keyof typeof colorClasses]}`}
    >
      <div className={`p-3 rounded-lg bg-white/5`}>
        <Icon
          className={`w-5 h-5 ${iconColorClasses[link.color as keyof typeof iconColorClasses]}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[var(--color-text-primary)] text-sm group-hover:text-white transition-colors">
          {link.title}
        </h3>
        <p className="text-xs text-text-muted mt-0.5">{link.description}</p>
      </div>
      <ExternalLink className="w-4 h-4 text-text-muted group-hover:text-white/60 transition-colors flex-shrink-0" />
    </a>
  );
}

// ===========================================
// Main Page Component
// ===========================================

export default async function NewsPage() {
  const { claudeCodeNews, aiNews } = await getNewsContent();

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 xl:px-8 py-8 md:py-10 xl:py-12">
      {/* Header */}
      <header className="mb-8 md:mb-10 xl:mb-12">
        <h1 className="text-2xl md:text-3xl xl:text-4xl font-bold text-[var(--color-text-primary)] mb-2">
          News
        </h1>
        <p className="text-text-muted text-sm md:text-base">
          Stay updated with Claude Code and AI industry news
        </p>
      </header>

      {/* Section 1: Quick Links */}
      <section className="mb-10 xl:mb-12">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Official Resources
            </h2>
            <p className="text-[10px] text-text-muted">Direct links to official sources</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {QUICK_LINKS.map((link) => (
            <QuickLinkCard key={link.title} link={link} />
          ))}
        </div>
      </section>

      {/* Section 2: Claude Code News */}
      <section className="mb-10 xl:mb-12">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <Building2 className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Claude Code News
            </h2>
            <p className="text-[10px] text-text-muted">Latest updates about Claude Code</p>
          </div>
        </div>

        <div className="space-y-3">
          {claudeCodeNews.length > 0 ? (
            claudeCodeNews.map((article) => <OfficialNewsCard key={article.id} article={article} />)
          ) : (
            <div className="text-center py-8 text-white/40 bg-white/[0.02] rounded-lg border border-white/10">
              <Building2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No Claude Code news yet</p>
              <p className="text-xs text-text-muted mt-1">Check back soon for the latest updates</p>
            </div>
          )}
        </div>
      </section>

      {/* Section 3: AI News */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Newspaper className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">AI News</h2>
            <p className="text-[10px] text-text-muted">Industry news and updates</p>
          </div>
        </div>

        {aiNews.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {aiNews.map((article) => (
              <PressNewsCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-white/40 bg-white/[0.02] rounded-lg border border-white/10">
            <Newspaper className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No AI news yet</p>
            <p className="text-xs text-text-muted mt-1">
              Stay tuned for the latest AI industry updates
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
