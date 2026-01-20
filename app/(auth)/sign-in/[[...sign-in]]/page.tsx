"use client";

import Link from "next/link";
import Image from "next/image";
import { useSignIn } from "@clerk/nextjs";
import { AuthLeftPanel } from "@/components/auth/AuthLeftPanel";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

// Lazy load StarsCanvas for performance
const StarsCanvas = dynamic(
  () => import("@/components/ui/stars-canvas").then((mod) => ({ default: mod.StarsCanvas })),
  { ssr: false, loading: () => null }
);

// Detect in-app browsers (social, messaging, developer platforms)
function isInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor;
  const inAppPatterns = [
    // Social Media
    /FBAN|FBAV/i, // Facebook
    /Instagram/i, // Instagram
    /Twitter/i, // Twitter/X
    /Snapchat/i, // Snapchat
    /TikTok/i, // TikTok
    /LinkedIn/i, // LinkedIn
    /Pinterest/i, // Pinterest
    // Messaging Apps
    /KAKAOTALK/i, // KakaoTalk
    /Line\//i, // Line
    /WhatsApp/i, // WhatsApp
    /Telegram/i, // Telegram
    /Discord/i, // Discord
    /Slack/i, // Slack
    /WeChat|MicroMessenger/i, // WeChat
    // Developer & Productivity
    /Notion/i, // Notion
    /Reddit/i, // Reddit
    /Medium/i, // Medium
    // Regional
    /NAVER/i, // Naver
    /Daum/i, // Daum
    /BAND/i, // Band
    // Other
    /SamsungBrowser\/.*CrossApp/i, // Samsung in-app
    /GSA/i, // Google Search App
    /\bwv\b/i, // Android WebView
  ];
  return inAppPatterns.some((pattern) => pattern.test(ua));
}

export default function SignInPage() {
  const { signIn, isLoaded } = useSignIn();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInAppWarning, setShowInAppWarning] = useState(false);

  // Check for in-app browser on mount
  useEffect(() => {
    if (isInAppBrowser()) {
      setShowInAppWarning(true);
    }
  }, []);

  const handleGitHubSignIn = async () => {
    setError(null);

    // Show warning for in-app browsers
    if (isInAppBrowser()) {
      setShowInAppWarning(true);
      return;
    }

    if (!isLoaded) {
      setError("Loading... Please wait.");
      return;
    }

    if (!signIn) {
      setError("Connection failed. Please refresh the page.");
      return;
    }

    setIsLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_github",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/leaderboard",
      });
    } catch (err) {
      console.error("GitHub sign in error:", err);
      setError("GitHub connection failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-primary)] relative overflow-hidden">
      {/* Stars Background */}
      <StarsCanvas starCount={400} />

      {/* Left Panel - Brand & Visual (hidden on mobile/tablet) */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10">
        <AuthLeftPanel />
      </div>

      {/* Center Divider */}
      <div className="hidden lg:flex items-center relative z-10">
        <div className="w-1 h-64 bg-white/10 rounded-full" />
      </div>

      {/* Right Panel - Sign In Form */}
      <div className="flex-1 flex flex-col items-center lg:items-start justify-center px-6 py-12 lg:pl-16 lg:pr-16 relative z-10">
        <div className="w-full max-w-sm">
          {/* Glass card */}
          <div className="relative backdrop-blur-sm bg-white/[0.02] border border-white/[0.08] rounded-2xl p-8">
            {/* Mobile/Tablet Header */}
            <div className="lg:hidden text-center mb-8">
              <Link href="/" className="inline-flex items-center gap-2 mb-6">
                <Image
                  src="/logo.png"
                  alt="CCgather Logo"
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
                <span className="text-xl font-bold text-white">CCgather</span>
              </Link>
              <p className="text-sm text-[var(--color-text-muted)]">
                Your AI coding journey awaits
              </p>
            </div>

            {/* Desktop Header */}
            <div className="hidden lg:block mb-8">
              <Link href="/" className="inline-flex items-center gap-2 mb-4">
                <Image
                  src="/logo.png"
                  alt="CCgather Logo"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="text-lg font-bold text-white">CCgather</span>
              </Link>
              <h1 className="text-xl font-bold text-white mb-1">
                Proof of your
                <br />
                <span className="shimmer-text">Claude Code dedication</span>
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                Sign in to track your AI coding journey
              </p>
            </div>

            {/* In-App Browser Warning */}
            {showInAppWarning && (
              <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <p className="text-amber-400 text-sm font-medium mb-2">⚠️ Open in Browser</p>
                <p className="text-amber-400/80 text-xs mb-3">Login may not work here.</p>
                <div className="flex items-center gap-2 text-amber-400/90 text-xs">
                  <span>📋</span>
                  <span className="font-mono text-[11px] select-all bg-amber-500/20 px-2 py-1 rounded">
                    ccgather.com/sign-in
                  </span>
                </div>
                <p className="text-amber-400/60 text-[10px] mt-2">
                  Copy → Open Safari or Chrome → Paste
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && !showInAppWarning && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
              >
                {error}
              </div>
            )}

            {/* Custom GitHub Sign In Button */}
            <button
              onClick={handleGitHubSignIn}
              disabled={isLoading || !isLoaded}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading || !isLoaded ? (
                <div
                  className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"
                  role="status"
                  aria-label="Loading"
                />
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              )}
              <span className="text-white font-medium">
                {isLoading ? "Connecting..." : !isLoaded ? "Loading..." : "Continue with GitHub"}
              </span>
            </button>

            {/* Sign Up Link */}
            <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
              Don&apos;t have an account?{" "}
              <Link
                href="/sign-up"
                className="text-[var(--color-claude-coral)] hover:text-[var(--color-claude-peach)] font-medium"
              >
                Sign up
              </Link>
            </p>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-xs text-[var(--color-text-muted)] text-center">
                By signing in, you agree to our{" "}
                <Link href="/terms" className="text-[var(--color-claude-coral)] hover:underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-[var(--color-claude-coral)] hover:underline">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
