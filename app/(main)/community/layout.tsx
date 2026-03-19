import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claude Code Community - AI Developer Discussion & Insights",
  description:
    "Join the Claude Code developer community. Share insights, discuss AI coding patterns, and connect with developers using Claude Code worldwide. AI-translated multilingual posts.",
  keywords: [
    "Claude Code community",
    "Claude Code discussion",
    "AI developer community",
    "Claude Code forum",
    "Claude Code developers",
    "AI coding community",
    "Claude Code insights",
    "developer discussion",
  ],
  openGraph: {
    title: "Claude Code Community - AI Developer Discussion & Insights",
    description:
      "Join the Claude Code developer community. Share insights and connect with developers worldwide.",
    type: "website",
    url: "https://ccgather.com/community",
  },
  twitter: {
    card: "summary_large_image",
    title: "Claude Code Community - AI Developer Discussion",
    description: "Share insights and connect with Claude Code developers worldwide.",
  },
  alternates: {
    canonical: "https://ccgather.com/community",
  },
};

function CommunityJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Claude Code Developer Community",
    description: "AI-translated multilingual community for Claude Code developers worldwide.",
    url: "https://ccgather.com/community",
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
    mainEntity: {
      "@type": "DiscussionForumPosting",
      headline: "Claude Code Developer Community",
      description: "AI-translated multilingual developer discussion forum",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CommunityJsonLd />
      {children}
    </>
  );
}
