import type { Metadata } from "next";

// ===========================================
// SEO Metadata for Leaderboard
// ===========================================
export const metadata: Metadata = {
  title: "Claude Code Leaderboard - Global Developer Rankings | CCgather",
  description:
    "Real-time Claude Code leaderboard and ranking. Track top Claude Code developers by token usage worldwide. Compare Claude Code rankings by country and see who leads the global AI coding community.",
  keywords: [
    "Claude Code leaderboard",
    "Claude Code ranking",
    "Claude Code rankings",
    "Claude Code rank",
    "AI developer rankings",
    "Claude Code usage stats",
    "top Claude Code users",
    "Claude Code community",
    "developer leaderboard",
    "token usage rankings",
    "Claude Code global rankings",
    "Anthropic Claude leaderboard",
  ],
  openGraph: {
    title: "Claude Code Leaderboard - Global Developer Rankings",
    description:
      "Real-time Claude Code ranking and leaderboard. Track top developers by token usage worldwide.",
    type: "website",
    url: "https://ccgather.com/leaderboard",
  },
  twitter: {
    card: "summary_large_image",
    title: "Claude Code Leaderboard - Developer Rankings",
    description: "Real-time Claude Code ranking. Track top developers by token usage worldwide.",
  },
  alternates: {
    canonical: "https://ccgather.com/leaderboard",
  },
};

// ===========================================
// JSON-LD Structured Data
// ===========================================
function LeaderboardJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Claude Code Leaderboard - Global Developer Rankings",
    description:
      "Real-time Claude Code leaderboard and ranking. Track top Claude Code developers by token usage worldwide.",
    url: "https://ccgather.com/leaderboard",
    mainEntity: {
      "@type": "ItemList",
      name: "Claude Code Developer Rankings",
      description: "Global rankings of Claude Code developers by token usage",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: 100,
    },
    isPartOf: {
      "@type": "WebSite",
      name: "CCgather",
      url: "https://ccgather.com",
    },
    publisher: {
      "@type": "Organization",
      name: "CCgather",
      url: "https://ccgather.com",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LeaderboardJsonLd />
      {children}
    </>
  );
}
