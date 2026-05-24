"use client";

import Link from "next/link";
import Image from "next/image";
import { useSignUp, useAuth } from "@clerk/nextjs";
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

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "other";
  const ua = navigator.userAgent || navigator.vendor;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export default function SignUpPage() {
  // Clerk 표준 OAuth 가입 패턴: useSignUp + authenticateWithRedirect.
  // 옛 Opus 4.6 commit (c1a3183, 2026-02-09) 가 useSignIn 으로 변경했고
  // 그 직후 3.5개월 동안 신규 가입 0명 funnel 끊김. 표준으로 복귀.
  const { signUp, isLoaded } = useSignUp();
  const { isSignedIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  // Check for in-app browser on mount
  useEffect(() => {
    if (isInAppBrowser()) {
      setShowInAppWarning(true);
      setPlatform(detectPlatform());
    }
  }, []);

  // GitHub OAuth typically fails or silently drops the session inside in-app browsers
  // (cookies/popups blocked). Block the button entirely to avoid sending users into
  // a dead-end flow they can't recover from.
  const isOAuthBlocked = showInAppWarning;

  const handleOpenInExternal = async () => {
    const currentUrl = window.location.href;

    // iOS: x-safari-https:// forces Safari to take over the URL
    if (platform === "ios") {
      const safariUrl = currentUrl.replace(/^https?:\/\//, "x-safari-https://");
      window.location.href = safariUrl;
      return;
    }

    // Android: intent:// hands the URL to Chrome (browser_fallback_url keeps users
    // unstuck if Chrome isn't installed)
    if (platform === "android") {
      const url = new URL(currentUrl);
      const intentUrl =
        `intent://${url.host}${url.pathname}${url.search}` +
        `#Intent;scheme=https;package=com.android.chrome;` +
        `S.browser_fallback_url=${encodeURIComponent(currentUrl)};end;`;
      window.location.href = intentUrl;
      return;
    }

    // Desktop / unknown: clipboard fallback so user can paste into a real browser
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setError("Couldn't copy automatically. Please copy this page's URL manually.");
    }
  };

  const handleGitHubSignUp = async () => {
    setError(null);

    if (!isLoaded) {
      setError("Loading... Please wait.");
      return;
    }

    if (!signUp) {
      setError("Connection failed. Please refresh the page.");
      return;
    }

    setIsLoading(true);
    try {
      // useSignUp 의 OAuth 흐름은 Clerk 가 자동으로 새 user 생성 + 기존 user
      // 발견 시 sso-callback 의 AuthenticateWithRedirectCallback 가 transferable
      // 상태 자동 처리. 명시적 reset 불필요.
      await signUp.authenticateWithRedirect({
        strategy: "oauth_github",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/leaderboard",
      });
    } catch (err) {
      console.error("GitHub sign up error:", err);
      setError("GitHub connection failed. Please refresh the page and try again.");
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
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

      {/* Right Panel - Sign Up Form */}
      <div className="flex-1 flex flex-col items-center lg:items-start justify-center px-6 py-12 lg:pl-16 lg:pr-16 relative z-10">
        <div className="w-full max-w-sm">
          {/* Glass card */}
          <div className="relative backdrop-blur-sm bg-white/[0.02] border border-white/[0.08] rounded-2xl p-8">
            {/* Mobile/Tablet Header */}
            <div className="lg:hidden text-center mb-8">
              <Link href="/" className="inline-flex items-center gap-2 mb-6">
                <Image
                  src="/logos/logo.png"
                  alt="CCgather Logo"
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
                <span className="text-xl font-bold text-white">CCgather</span>
              </Link>
              <p className="text-sm text-[var(--color-text-muted)]">
                Your AI coding journey starts here
              </p>
            </div>

            {/* Desktop Header */}
            <div className="hidden lg:block mb-8">
              <Link href="/" className="inline-flex items-center gap-2 mb-4">
                <Image
                  src="/logos/logo.png"
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
                Join the global Claude Code leaderboard
              </p>
            </div>

            {/* In-App Browser Block — OAuth typically fails here, so block the button */}
            {showInAppWarning && (
              <div
                role="alert"
                className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30"
              >
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-lg leading-none">⚠️</span>
                  <div>
                    <p className="text-amber-200 text-sm font-semibold mb-1">
                      GitHub sign-in won&apos;t work here
                    </p>
                    <p className="text-[var(--color-text-secondary)] text-xs leading-relaxed">
                      This in-app browser blocks OAuth login. Open this page in{" "}
                      <span className="font-semibold text-white">
                        {platform === "ios"
                          ? "Safari"
                          : platform === "android"
                            ? "Chrome"
                            : "Safari or Chrome"}
                      </span>{" "}
                      to continue.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleOpenInExternal}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-amber-100 text-sm font-medium transition-colors"
                >
                  {platform === "ios" && "Open in Safari"}
                  {platform === "android" && "Open in Chrome"}
                  {platform === "other" &&
                    (copyStatus === "copied" ? "Link copied — paste in browser" : "Copy link")}
                </button>
              </div>
            )}

            {/* Error Message */}
            {error && !showInAppWarning && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
              >
                <p className="mb-2">{error}</p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 rounded-md text-red-300 text-xs font-medium transition-colors"
                >
                  Refresh page
                </button>
              </div>
            )}

            {/* Already Signed In State */}
            {isSignedIn ? (
              <div className="text-center">
                <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                  You&apos;re already signed in.
                </div>
                <Link
                  href="/leaderboard"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-[var(--color-claude-coral)] hover:bg-[var(--color-claude-coral)]/90 rounded-xl transition-all text-white font-medium"
                >
                  Go to Leaderboard
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Link>
              </div>
            ) : (
              /* Custom GitHub Sign Up Button — disabled inside in-app browsers */
              <button
                onClick={handleGitHubSignUp}
                disabled={isLoading || !isLoaded || isOAuthBlocked}
                aria-disabled={isOAuthBlocked}
                title={
                  isOAuthBlocked ? "Open in Safari or Chrome to sign in with GitHub" : undefined
                }
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
                  {isOAuthBlocked
                    ? "GitHub sign-in unavailable here"
                    : isLoading
                      ? "Connecting..."
                      : !isLoaded
                        ? "Loading..."
                        : "Continue with GitHub"}
                </span>
              </button>
            )}

            {/* Clerk CAPTCHA mount point — Dashboard 의 sign_up.captcha_enabled=true
                상태에서 OAuth 가입도 CAPTCHA 검증 필요. 이 div 가 없으면 Clerk SDK 가
                widget render 못해 silent fail → Clerk user 생성 안 됨 → DB 50명 그대로.
                invisible/smart widget 은 사용자 클릭 없이 자동 검증. */}
            <div id="clerk-captcha" />

            {/* Sign In Link */}
            <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="text-[var(--color-claude-coral)] hover:text-[var(--color-claude-peach)] font-medium"
              >
                Sign in
              </Link>
            </p>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-xs text-[var(--color-text-muted)] text-center">
                By signing up, you agree to our{" "}
                <Link href="/terms" className="text-[var(--color-claude-coral)] hover:underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="text-[var(--color-claude-coral)] hover:underline whitespace-nowrap"
                >
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
