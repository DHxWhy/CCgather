import type { Metadata } from "next";

// ===========================================
// SEO Metadata for Leaderboard
// ===========================================
export const metadata: Metadata = {
  title: "Claude Code Usage Leaderboard - Track & Compare Global Rankings",
  description:
    "Real-time Claude Code usage leaderboard. Track and compare top Claude Code developers by token usage worldwide. See global rankings, usage stats, and compete with the AI coding community.",
  keywords: [
    "Claude Code leaderboard",
    "Claude Code usage leaderboard",
    "Claude Code ranking",
    "Claude Code usage tracker",
    "track Claude Code usage",
    "compare Claude Code",
    "Claude Code stats",
    "top Claude Code users",
    "Claude Code community",
    "developer leaderboard",
    "token usage rankings",
    "Anthropic Claude leaderboard",
  ],
  openGraph: {
    title: "Claude Code Usage Leaderboard - Track & Compare Rankings",
    description:
      "Real-time Claude Code usage leaderboard. Track and compare top developers by token usage worldwide.",
    type: "website",
    url: "https://ccgather.com/leaderboard",
  },
  twitter: {
    card: "summary_large_image",
    title: "Claude Code Usage Leaderboard - Track & Compare",
    description:
      "Real-time Claude Code usage leaderboard. Track and compare top developers worldwide.",
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
    name: "Claude Code Usage Leaderboard - Track & Compare Global Rankings",
    description:
      "Real-time Claude Code usage leaderboard. Track and compare top developers by token usage worldwide.",
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
