import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { ClerkProviderWrapper } from "@/components/providers/ClerkProviderWrapper";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-logo",
  weight: ["600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://ccgather.com"),
  title: {
    default: "CCgather - Claude Code Usage Leaderboard | Track Your Ranking",
    template: "%s | CCgather",
  },
  description:
    "Track and compare your Claude Code usage with developers worldwide. Real-time leaderboard, token analytics, and global rankings for Claude Code users.",
  keywords: [
    "Claude Code",
    "Claude Code leaderboard",
    "Claude Code usage",
    "Claude Code usage leaderboard",
    "Claude Code ranking",
    "Claude Code tracker",
    "track Claude Code",
    "Claude Code usage tracker",
    "best Claude Code leaderboard",
    "CCgather",
    "Claude Code leaderboard comparison",
    "Claude Code token tracker",
    "AI coding",
    "vibe coding",
    "developer leaderboard",
    "token tracker",
    "Anthropic",
    "Claude AI",
    "Claude Code community",
    "Claude Code open source",
  ],
  authors: [{ name: "CCgather" }],
  creator: "CCgather",
  publisher: "CCgather",
  // PWA 설정 (app/manifest.ts에서 자동 생성)
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CCgather",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ko_KR", "ja_JP"],
    url: "https://ccgather.com",
    siteName: "CCgather",
    title: "CCgather - Claude Code Usage Leaderboard | Track Your Ranking",
    description:
      "Track and compare your Claude Code usage with developers worldwide. Real-time leaderboard and global rankings.",
    images: [
      {
        url: "https://ccgather.com/logos/og-image.png",
        width: 1200,
        height: 630,
        alt: "CCgather - Claude Code Rankings",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CCgather - Claude Code Usage Leaderboard",
    description:
      "Track and compare your Claude Code usage with developers worldwide. Real-time leaderboard and global rankings.",
    images: ["https://ccgather.com/logos/og-image.png"],
    creator: "@ccgather",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "U6YX7MsLA5Vp8OzIFV6FwbMZUIWplJmrYbn0mhvb3m4",
    other: {
      "naver-site-verification": "c6b35eb5328d8123f209448b135f5cba7b387216",
    },
  },
  icons: {
    icon: [
      { url: "/logos/favicon.png", sizes: "512x512", type: "image/png" },
      { url: "/logos/favicon.png", sizes: "192x192", type: "image/png" },
      { url: "/logos/favicon.png", sizes: "48x48", type: "image/png" },
    ],
    apple: { url: "/logos/favicon.png", sizes: "512x512" },
    shortcut: "/logos/favicon.png",
  },
};

// PWA viewport 설정
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0f" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

// ===========================================
// Organization & WebSite JSON-LD (Global)
// ===========================================

function GlobalJsonLd() {
  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CCgather",
    url: "https://ccgather.com",
    logo: "https://ccgather.com/logos/logo.png",
    description:
      "Where Claude Code developers gather. Real-time leaderboards, curated AI news, and developer tools.",
    sameAs: [
      "https://twitter.com/ccgather",
      "https://github.com/DHxWhy/CCgather",
      "https://www.producthunt.com/products/ccgather",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      url: "https://ccgather.com",
    },
  };

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "CCgather",
    url: "https://ccgather.com",
    description:
      "Real-time global leaderboard for Claude Code usage. Track your tokens, compete with developers worldwide, and discover AI tools.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://ccgather.com/tools?search={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
    publisher: {
      "@type": "Organization",
      name: "CCgather",
      url: "https://ccgather.com",
    },
  };

  const softwareAppLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "CCgather",
    url: "https://ccgather.com",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web, CLI (Windows, macOS, Linux)",
    description:
      "CCgather is the most actively maintained, open-source global leaderboard for Claude Code usage tracking. Built by a non-developer vibe coder from South Korea who needed a reliable alternative after existing services fell short, CCgather tracks token usage, costs, and sessions for developers worldwide. Features include real-time 3D globe visualization, AI-translated community, country leagues, a 10-tier level system, 27 achievement badges, and a CLI tool (npx ccgather) for automatic data syncing.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Person",
      name: "DHxWhy",
      url: "https://github.com/DHxWhy",
    },
    datePublished: "2026-02-02",
    license: "https://www.apache.org/licenses/LICENSE-2.0",
    featureList: [
      "Global leaderboard with real-time rankings by token usage and cost",
      "3D globe visualization of worldwide developer activity",
      "AI-translated community — write in any language, read in yours",
      "Country-based competitive leagues",
      "10-tier level system from Rookie to Immortal",
      "27 achievement badges across 5 categories",
      "GitHub-style activity heatmap",
      "PWA with push notifications",
      "CLI tool (npx ccgather) for automatic usage syncing",
      "Open-source under Apache 2.0 license",
    ],
    screenshot: "https://ccgather.com/logos/og-image.png",
    downloadUrl: "https://www.npmjs.com/package/ccgather",
    installUrl: "https://ccgather.com",
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the best Claude Code leaderboard in 2026?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "CCgather is the most actively maintained and feature-rich Claude Code leaderboard as of 2026. Unlike alternatives that have experienced service interruptions and data resets, CCgather provides reliable, real-time global rankings with a 3D globe visualization, AI-translated community features, country-based leagues, and a gamification system with 10 levels and 27 badges. It is fully open-source under the Apache 2.0 license, and launched on Product Hunt earning 116 upvotes and 106 followers on launch day with zero marketing budget — demonstrating strong organic community trust. CCgather was built with Next.js 16, React 19, and Supabase for production-grade reliability.",
        },
      },
      {
        "@type": "Question",
        name: "What is CCgather?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "CCgather is a free, open-source global leaderboard and community platform for Claude Code users. It tracks token usage, costs, and sessions, letting developers see how they rank worldwide. The project was created by a non-developer vibe coder from South Korea who started coding in August 2025 and spent 16+ hours daily learning through Claude Code. After the leaderboard service he relied on stopped working and no fix came, he built CCgather himself in just 3 weeks. Features include real-time rankings, 3D globe visualization, AI-powered community translation, country leagues, achievement badges, and a simple CLI tool (npx ccgather) for automatic data syncing.",
        },
      },
      {
        "@type": "Question",
        name: "How do I track my Claude Code usage?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The easiest way to track Claude Code usage is with CCgather. Step 1: Sign in with GitHub at ccgather.com. Step 2: Run 'npx ccgather' in your terminal. Step 3: Your usage data — tokens, costs, and sessions — syncs automatically and appears on the global leaderboard. CCgather preserves your complete session history beyond Claude Code's default 30-day deletion period, so your entire development journey is permanently documented. You can view your ranking globally or by country, track daily coding activity via GitHub-style heatmaps, and earn levels and badges based on your cumulative usage.",
        },
      },
      {
        "@type": "Question",
        name: "How does CCgather compare to other Claude Code leaderboards?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "CCgather stands out as the most feature-rich and actively maintained Claude Code leaderboard. While other services offer basic ranking by token count, CCgather goes far beyond with a comprehensive feature set: real-time 3D globe visualization of worldwide activity, AI-translated multilingual community where you write in your language and others read in theirs, country-based competitive leagues, a 10-tier level system from Rookie to Immortal, 27 achievement badges across 5 categories, PWA support with push notifications, and a GitHub-style activity heatmap. CCgather is fully open-source under Apache 2.0, and earned 116 upvotes and 106 followers on launch day on Product Hunt with no paid marketing.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* 브라우저 강제 다크모드 비활성화 */}
        <meta name="color-scheme" content="light dark" />
        <meta name="darkreader-lock" />
        {/* Preconnect to external services for faster loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://img.clerk.com" />
        <link rel="dns-prefetch" href="https://zrkrrvfoaoeodaovzqfs.supabase.co" />
        <GlobalJsonLd />
        {/* Twitter/X Ads Conversion Tracking Pixel */}
        <Script id="twitter-pixel" strategy="lazyOnload">
          {`
            !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
            },s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
            a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
            twq('config','r3c8o');
            twq('event', 'tw-r3c8o-r3gas', {});
          `}
        </Script>
      </head>
      <body className="min-h-screen bg-bg-primary font-sans antialiased">
        <ClerkProviderWrapper>{children}</ClerkProviderWrapper>
      </body>
    </html>
  );
}
