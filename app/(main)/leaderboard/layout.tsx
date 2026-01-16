import type { Metadata } from "next";

// ===========================================
// SEO Metadata for Leaderboard
// ===========================================
export const metadata: Metadata = {
  title: "Leaderboard | CCgather - Claude Code Developer Rankings",
  description:
    "Global leaderboard ranking Claude Code developers by token usage and spending. Track top AI coding enthusiasts, compare country rankings, and see who leads the Claude Code community.",
  keywords: [
    "Claude Code leaderboard",
    "Claude Code rankings",
    "AI developer rankings",
    "Claude Code usage stats",
    "top Claude Code users",
    "Claude Code community",
    "developer leaderboard",
    "token usage rankings",
    "Claude Code global rankings",
  ],
  openGraph: {
    title: "Leaderboard | CCgather - Claude Code Developer Rankings",
    description:
      "Global leaderboard ranking Claude Code developers by token usage. See who leads the AI coding community.",
    type: "website",
    url: "https://ccgather.com/leaderboard",
  },
  twitter: {
    card: "summary_large_image",
    title: "Leaderboard | CCgather",
    description: "Global Claude Code developer rankings by token usage and spending.",
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
    name: "Claude Code Developer Leaderboard",
    description: "Global leaderboard ranking Claude Code developers by token usage and spending.",
    url: "https://ccgather.com/leaderboard",
    mainEntity: {
      "@type": "ItemList",
      name: "Top Claude Code Developers",
      description: "Rankings of Claude Code developers by token usage",
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
