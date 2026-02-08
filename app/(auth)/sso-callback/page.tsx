"use client";

import { useEffect, useState, useRef } from "react";
import { AuthenticateWithRedirectCallback, useClerk, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

type ErrorType = "timeout" | "auth" | "session";

// Check if URL has valid OAuth callback parameters
function hasValidCallbackParams(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  return (
    params.has("code") ||
    params.has("state") ||
    params.has("__clerk_status") ||
    params.has("__clerk_created_session") ||
    hash.includes("access_token") ||
    params.has("error") ||
    params.has("error_description")
  );
}

export default function SSOCallbackPage() {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isLoaded } = useAuth();
  const [hasError, setHasError] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [errorType, setErrorType] = useState<ErrorType>("auth");
  // Check immediately (not in effect) to avoid race with AuthenticateWithRedirectCallback
  const [isValidCallback] = useState(() => hasValidCallbackParams());
  const redirectedRef = useRef(false);

  // Stale navigation: no OAuth params → redirect to leaderboard (once)
  useEffect(() => {
    if (!isLoaded || isValidCallback || redirectedRef.current) return;
    redirectedRef.current = true;
    router.replace("/leaderboard");
  }, [isLoaded, isValidCallback, router]);

  // Clerk loading timeout (10s)
  useEffect(() => {
    if (isLoaded) return;
    const timeout = setTimeout(() => {
      if (!redirectedRef.current) {
        console.warn("[SSO] Clerk failed to load after 10s, redirecting...");
        redirectedRef.current = true;
        window.location.href = "/leaderboard";
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [isLoaded]);

  // Callback processing timeout (20s) - only for valid callbacks
  useEffect(() => {
    if (!isValidCallback) return;
    const timeout = setTimeout(() => {
      setIsTimedOut(true);
      setErrorType("timeout");
    }, 20000);
    return () => clearTimeout(timeout);
  }, [isValidCallback]);

  // Handle URL error params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (!error && !errorDescription) return;

    setHasError(true);

    const sessionErrors = [
      "session",
      "user_not_found",
      "account_not_found",
      "invalid_session",
      "session_expired",
    ];
    const isSessionError = sessionErrors.some(
      (e) => error?.toLowerCase().includes(e) || errorDescription?.toLowerCase().includes(e)
    );

    if (isSessionError) {
      setErrorType("session");
      signOut({ redirectUrl: "/sign-in" }).catch(() => {
        window.location.href = "/sign-in";
      });
      return;
    }

    setErrorType("auth");
  }, [signOut]);

  const handleSignIn = async () => {
    // Clear stale session/sign-in state completely before retry
    try {
      await signOut();
    } catch {
      // Ignore - proceed to sign-in regardless
    }
    // Use full page navigation to ensure clean Clerk state
    window.location.href = "/sign-in";
  };

  const handleRetry = () => {
    window.location.href = "/leaderboard";
  };

  const handleGoHome = () => {
    window.location.href = "/";
  };

  // Loading: Clerk not ready or stale navigation
  if (!isLoaded || !isValidCallback) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#DA7756]/30 border-t-[#DA7756] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Session error: auto-clearing
  if (errorType === "session") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="bg-[var(--color-bg-secondary)] border border-white/10 rounded-xl p-8">
            <div className="w-8 h-8 border-2 border-[#DA7756]/30 border-t-[#DA7756] rounded-full animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Session Refresh Required</h1>
            <p className="text-zinc-400 text-sm">Clearing session and redirecting to sign in...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error or timeout
  if (hasError || isTimedOut) {
    const errorMessages: Record<ErrorType, { title: string; description: string }> = {
      timeout: {
        title: "Sign-in Timeout",
        description:
          "The sign-in process took too long. This can happen with browser privacy settings or slow connections.",
      },
      auth: {
        title: "Sign-in Error",
        description: "There was a problem completing your sign-in. Please try again.",
      },
      session: {
        title: "Session Error",
        description: "Your session has expired or is invalid. Please sign in again.",
      },
    };

    const { title, description } = errorMessages[errorType];

    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="bg-[var(--color-bg-secondary)] border border-[#DA7756]/30 rounded-xl p-8">
            <div className="text-5xl mb-4">&#x26A0;&#xFE0F;</div>
            <h1 className="text-xl font-bold text-[#DA7756] mb-2">{title}</h1>
            <p className="text-zinc-400 text-sm mb-6">{description}</p>
            <div className="space-y-3">
              <button
                onClick={handleSignIn}
                className="w-full px-6 py-2.5 bg-[#DA7756] hover:bg-[#B85C3D] text-white font-medium rounded-lg transition-colors"
              >
                Sign In Again
              </button>
              <button
                onClick={handleRetry}
                className="w-full px-6 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 font-medium rounded-lg transition-colors"
              >
                Go to Leaderboard
              </button>
              <button
                onClick={handleGoHome}
                className="w-full px-6 py-2.5 bg-transparent hover:bg-white/5 text-zinc-500 font-medium rounded-lg transition-colors"
              >
                Go to Home
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-6">
              If using Safari, try disabling &quot;Prevent cross-site tracking&quot; in Privacy
              settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Normal: render Clerk callback handler
  // IMPORTANT: Do not add effects that redirect based on isSignedIn here.
  // AuthenticateWithRedirectCallback must complete its full flow
  // (session cookie setup + full-page redirect) without being unmounted.
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#DA7756]/30 border-t-[#DA7756] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400 text-sm">Completing sign in...</p>
        <p className="text-zinc-500 text-xs mt-2">Please wait a moment</p>
      </div>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/leaderboard"
        signUpFallbackRedirectUrl="/leaderboard"
      />
    </div>
  );
}
