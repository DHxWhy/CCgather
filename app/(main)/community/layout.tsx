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
  // mainEntity 의 DiscussionForumPosting 제거 (2026-05-25):
  // - DiscussionForumPosting 은 개별 post 용 schema (Google 표준)
  // - community 페이지는 forum list/collection 이라 부적절
  // - text/datePublished/author 필수 필드 누락 → Search Console 3 errors
  // - WebPage 만 유지 = error 0 + 부적절 schema 제거
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
