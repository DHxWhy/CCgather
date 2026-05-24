import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { ClerkProviderWrapper } from "@/components/providers/ClerkProviderWrapper";
import { PwaMigration } from "@/components/pwa/PwaMigration";
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
    default: "CCgather - Claude Code Leaderboard | Track Your AI Coding Stats",
    template: "%s | CCgather",
  },
  description:
    "Track and compare your Claude Code usage with developers worldwide. Real-time leaderboard, token analytics, and global rankings for Claude Code users.",
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
    title: "CCgather - Claude Code Leaderboard | Track Your AI Coding Stats",
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
    title: "CCgather - Claude Code Leaderboard | Track Your AI Coding Stats",
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
    description: "Where Claude Code developers gather. Real-time leaderboards and curated AI news.",
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
      "Real-time global leaderboard for Claude Code usage. Track your tokens and compete with developers worldwide.",
    publisher: {
      "@type": "Organization",
      name: "CCgather",
      url: "https://ccgather.com",
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://ccgather.com/leaderboard?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
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
      "CCgather is a free, open-source global Claude Code leaderboard. It tracks token usage, costs, and sessions for developers worldwide. Features include real-time 3D globe visualization, AI-translated community, country leagues, a 10-tier level system, 27 achievement badges, and a CLI tool (npx ccgather) for automatic data syncing.",
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
      "10-tier level system from Novice to Transcendent",
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
        name: "What is CCgather?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "CCgather is a free, open-source Claude Code leaderboard and community platform. It tracks token usage, costs, and sessions, letting developers see how they rank globally. Features include real-time rankings, 3D globe visualization, AI-powered community translation, country leagues, achievement badges, and a CLI tool (npx ccgather) for automatic data syncing.",
        },
      },
      {
        "@type": "Question",
        name: "How do I track my Claude Code usage?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sign in with GitHub at ccgather.com, then run 'npx ccgather' in your terminal. Your usage data (tokens, costs, sessions) syncs automatically and appears on the global leaderboard. CCgather preserves your complete session history, so your entire development journey is documented. You can view your ranking globally or by country, and track daily activity via GitHub-style heatmaps.",
        },
      },
      {
        "@type": "Question",
        name: "What features does CCgather offer?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "CCgather provides a real-time global Claude Code leaderboard with 3D globe visualization, country-based competitive leagues, a 10-tier level system, 27 achievement badges, an AI-translated multilingual community, GitHub-style activity heatmaps, PWA support with push notifications, and a CLI tool for automatic usage syncing. It is fully open-source under the Apache 2.0 license.",
        },
      },
      {
        "@type": "Question",
        name: "Is CCgather free to use?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, CCgather is completely free and open-source under the Apache 2.0 license. There are no premium tiers, hidden fees, or paid features. The full source code is available on GitHub at github.com/DHxWhy/CCgather.",
        },
      },
      {
        "@type": "Question",
        name: "Does CCgather collect my code or prompts?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. CCgather only collects aggregated usage metadata — input tokens, output tokens, cache tokens, model type, and cost estimates. Your source code, prompts, file paths, and project information never leave your machine. Only anonymous usage statistics are synced to the leaderboard.",
        },
      },
      {
        "@type": "Question",
        name: "How does the CCgather level system work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "CCgather has a 10-tier level system based on total token usage: Novice (0), Apprentice (50M), Journeyman (200M), Expert (500M), Master (1B), Grandmaster (3B), Legend (10B), Mythic (30B), Immortal (50B), and Transcendent (100B+). There are also 27 achievement badges across 5 categories with 4 rarity tiers.",
        },
      },
      {
        "@type": "Question",
        name: "What is the CCgather CLI tool?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The CCgather CLI is a command-line tool you can run with 'npx ccgather' on Windows, macOS, or Linux. It automatically syncs your Claude Code usage data to the global leaderboard. You can sign in, submit data, view rankings, and check your status directly from the terminal.",
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
        {/* PWA stale SW kill-switch — head inline, hydration 전 실행.
            전략: SW 가 등록되어 있고 + localStorage 의 build_id 가 현재 build 와
            다르면 무조건 청소. 매 deploy 마다 일회성 자동 회수.
            - 신규 사용자: SW 없음 → skip
            - 새 사용자가 첫 install: build_id 첫 저장 → skip
            - 옛 사용자: build_id mismatch → 청소 + reload 1회
            - critical path (OAuth/sign-*): reload 보류 (가입 흐름 보호) */}
        <Script id="ccg-sw-kill" strategy="beforeInteractive">
          {`(function(){try{
            if(typeof window==='undefined')return;
            if(!('serviceWorker' in navigator))return;
            var BUILD_ID='${process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_BUILD_ID || Date.now().toString()}';
            var LS_KEY='ccg_build_id';
            var stored=null;
            try{stored=localStorage.getItem(LS_KEY);}catch(_){}
            // 신규 사용자: 저장된 build_id 가 없으면 그냥 마크만 박고 종료
            if(!stored){
              try{localStorage.setItem(LS_KEY,BUILD_ID);}catch(_){}
              return;
            }
            // 같은 build: 이미 청소 끝난 상태
            if(stored===BUILD_ID)return;
            // build_id 다름 → 옛 코드/캐시 보유 → 강제 청소
            navigator.serviceWorker.getRegistrations().then(function(regs){
              return Promise.all(regs.map(function(r){return r.unregister();}));
            }).then(function(){
              if('caches' in window){
                return caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k);})); });
              }
            }).then(function(){
              try{localStorage.setItem(LS_KEY,BUILD_ID);}catch(_){}
              var p=window.location.pathname;
              if(p.indexOf('/sso-callback')===0||p.indexOf('/sign-in')===0||p.indexOf('/sign-up')===0||p.indexOf('/cli/auth')===0)return;
              window.location.reload();
            }).catch(function(e){
              // 청소 실패해도 마크는 박아서 무한 reload 안 함
              try{localStorage.setItem(LS_KEY,BUILD_ID);}catch(_){}
            });
          }catch(_){}})();`}
        </Script>
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
        {/* 옛 PWA SW/캐시 자동 청소 — 일회성, 옛 사용자 회수 */}
        <PwaMigration />
        <ClerkProviderWrapper>{children}</ClerkProviderWrapper>
      </body>
    </html>
  );
}
