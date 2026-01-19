"use client";

import { useEffect, useState } from "react";
import { AuthenticateWithRedirectCallback, useClerk } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";

// Allowed hosts for redirect (security: prevent Open Redirect)
const ALLOWED_HOSTS = ["ccgather.com", "www.ccgather.com", "localhost"];

export default function CLISSOCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut } = useClerk();
  const [hasError, setHasError] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [errorType, setErrorType] = useState<"timeout" | "auth" | "session">("auth");

  // Validate URL to prevent Open Redirect attacks
  const isValidRedirectUrl = (urlString: string): boolean => {
    try {
      const url = new URL(urlString, window.location.origin);
      // Only allow same-origin or whitelisted hosts
      if (url.origin === window.location.origin) return true;
      return ALLOWED_HOSTS.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
      );
    } catch {
      // Relative paths are safe
      return urlString.startsWith("/") && !urlString.startsWith("//");
    }
  };

  // Determine where to redirect after auth (with security validation)
  const getRedirectUrl = (): string => {
    const signInFallbackUrl = searchParams.get("sign_in_fallback_redirect_url");

    if (signInFallbackUrl && isValidRedirectUrl(signInFallbackUrl)) {
      try {
        const url = new URL(signInFallbackUrl, window.location.origin);
        // Only allow /cli/auth paths
        if (url.pathname.startsWith("/cli/auth")) {
          // Return only the path (no external domains)
          return url.pathname + url.search;
        }
      } catch {
        // Fall through to default
      }
    }
    // Default to CLI auth page (safe)
    return "/cli/auth";
  };

  // Timeout detection
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsTimedOut(true);
      setErrorType("timeout");
    }, 15000);

    return () => clearTimeout(timeout);
  }, []);

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
          // If sign out fails, redirect anyway
          router.push("/sign-in");
        });
        return;
      }

      setErrorType("auth");
    }
  }, [signOut, router]);

  const handleRetry = () => {
    router.push("/cli/auth");
  };

  const handleSignIn = async () => {
    // Clear any stale session before redirecting to sign-in
    try {
      await signOut();
    } catch {
      // Ignore errors, proceed to sign-in
    }
    router.push("/sign-in");
  };

  const handleGoHome = () => {
    router.push("/");
  };

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
    const errorMessages = {
      timeout: {
        title: "Sign-in Timeout",
        description: "The sign-in process took too long. Please try again.",
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
                Try CLI Auth
              </button>
              <button
                onClick={handleGoHome}
                className="w-full px-6 py-2.5 bg-transparent hover:bg-white/5 text-zinc-500 font-medium rounded-lg transition-colors"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const redirectUrl = getRedirectUrl();

  // Normal loading state with Clerk callback
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#DA7756]/30 border-t-[#DA7756] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400 text-sm">Completing CLI authentication...</p>
        <p className="text-zinc-500 text-xs mt-2">Please wait a moment</p>
      </div>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl={redirectUrl}
        signUpFallbackRedirectUrl={redirectUrl}
      />
    </div>
  );
}
