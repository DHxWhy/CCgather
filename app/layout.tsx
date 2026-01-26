import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Providers } from "./providers";
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
    default: "CCgather - Global Claude Code Leaderboard",
    template: "%s | CCgather",
  },
  description:
    "Proof of your Claude Code dedication. Track your tokens, prove your commitment, and rise through the global rankings!",
  keywords: [
    "Claude Code",
    "Claude Code leaderboard",
    "Claude Code usage",
    "AI coding",
    "vibe coding",
    "developer leaderboard",
    "token tracker",
    "Anthropic",
    "Claude AI",
    "AI development",
    "code assistant stats",
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
    title: "CCgather - Global Claude Code Leaderboard",
    description:
      "Proof of your Claude Code dedication. Track your tokens and rise through the global rankings!",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CCgather - Claude Code Leaderboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CCgather - Global Claude Code Leaderboard",
    description:
      "Proof of your Claude Code dedication. Track your tokens and rise through the rankings!",
    images: ["/og-image.png"],
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
      { url: "/favicon.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon.png", sizes: "48x48", type: "image/png" },
    ],
    apple: { url: "/favicon.png", sizes: "512x512" },
    shortcut: "/favicon.png",
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
    logo: "https://ccgather.com/logo.png",
    description:
      "Where Claude Code developers gather. Real-time leaderboards, curated AI news, and developer tools.",
    sameAs: ["https://twitter.com/ccgather", "https://github.com/ccgather"],
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
        <GlobalJsonLd />
      </head>
      <body className="min-h-screen bg-bg-primary font-sans antialiased">
        <ClerkProviderWrapper>
          <Providers>{children}</Providers>
        </ClerkProviderWrapper>
      </body>
    </html>
  );
}
