import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Providers } from "./providers";
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://ccgather.com"),
  title: {
    default: "CCgather - Where Claude Code Developers Gather",
    template: "%s | CCgather",
  },
  description:
    "Real-time global leaderboard for Claude Code usage. Track your tokens, compete with developers worldwide, and rise through the ranks. Join the gathering!",
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
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ko_KR", "ja_JP"],
    url: "https://ccgather.com",
    siteName: "CCgather",
    title: "CCgather - Where Claude Code Developers Gather",
    description: "Real-time global leaderboard for Claude Code usage. Track, compete, and rise!",
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
    title: "CCgather - Where Claude Code Developers Gather",
    description: "Real-time global leaderboard for Claude Code usage",
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
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/logo.png", sizes: "72x72", type: "image/png" },
    ],
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#DA7756",
        },
      }}
    >
      <html
        lang="en"
        className={`${inter.variable} ${jetbrainsMono.variable}`}
        suppressHydrationWarning
      >
        <body className="min-h-screen bg-bg-primary font-sans antialiased">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
