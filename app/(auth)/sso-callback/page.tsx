"use client";

import { useEffect, useState } from "react";
import { AuthenticateWithRedirectCallback, useClerk, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

type ErrorType = "timeout" | "auth" | "session";

export default function SSOCallbackPage() {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isLoaded } = useAuth();
  const [hasError, setHasError] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [errorType, setErrorType] = useState<ErrorType>("auth");
  const [isValidCallback, setIsValidCallback] = useState(true);

  // Check if this is a valid OAuth callback or stale PWA navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    // Valid OAuth callback should have: code, state, or hash with access_token
    const hasOAuthParams =
      params.has("code") ||
      params.has("state") ||
      params.has("__clerk_status") ||
      hash.includes("access_token");

    // If no OAuth params and no error params, this is likely a stale PWA navigation
    const hasErrorParams = params.has("error") || params.has("error_description");

    if (!hasOAuthParams && !hasErrorParams) {
      setIsValidCallback(false);
    }
  }, []);

  // Redirect only for stale/direct navigation (no OAuth params)
  // IMPORTANT: Do NOT redirect based on isSignedIn here.
  // AuthenticateWithRedirectCallback must complete its full flow
  // (session cookie setup + full-page redirect) without being unmounted.
  // router.replace() is a client-side navigation that races ahead of cookie setup.
  useEffect(() => {
    if (!isLoaded) return;

    // No valid callback params (stale PWA navigation or direct visit) → go to leaderboard
    if (!isValidCallback) {
      router.replace("/leaderboard");
      return;
    }
  }, [isLoaded, isValidCallback, router]);

  // Clerk loading timeout - redirect if Clerk fails to initialize
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isLoaded) {
        console.warn("[SSO] Clerk failed to load after 10s, redirecting...");
        router.replace("/leaderboard");
      }
    }, 10000);

    if (isLoaded) {
      clearTimeout(timeout);
    }

    return () => clearTimeout(timeout);
  }, [isLoaded, router]);

  // Timeout detection - if callback takes too long, show error state
  useEffect(() => {
    // Don't start timeout if we're redirecting anyway
    if (!isValidCallback) return;

    const timeout = setTimeout(() => {
      setIsTimedOut(true);
      setErrorType("timeout");
    }, 15000); // 15 seconds timeout

    return () => clearTimeout(timeout);
  }, [isValidCallback]);

  // Handle URL error params and session issues
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (error || errorDescription) {
      setHasError(true);

      // Check for session-related errors (deleted user, invalid session)
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
        // Auto sign out to clear invalid session
        signOut({ redirectUrl: "/sign-in" }).catch(() => {
          router.push("/sign-in");
        });
        return;
      }

      setErrorType("auth");
    }
  }, [signOut, router]);

  const handleSignIn = async () => {
    // Clear any stale session before redirecting to sign-in
    try {
      await signOut();
    } catch {
      // Ignore errors, proceed to sign-in
    }
    router.push("/sign-in");
  };

  const handleRetry = () => {
    router.push("/leaderboard");
  };

  const handleGoHome = () => {
    router.push("/");
  };

  // Redirecting: stale PWA navigation or Clerk not loaded yet
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

  // Session error: auto-clearing, show loading
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

  // Show error state
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
            <div className="text-5xl mb-4">⚠️</div>
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
              💡 Tip: If using Safari, try disabling &quot;Prevent cross-site tracking&quot; in
              Privacy settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Normal loading state with Clerk callback
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
