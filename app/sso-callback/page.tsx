"use client";

import { useEffect, useState } from "react";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function SSOCallbackPage() {
  const router = useRouter();
  const [hasError, setHasError] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);

  // Timeout detection - if callback takes too long, show error state
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsTimedOut(true);
    }, 15000); // 15 seconds timeout

    return () => clearTimeout(timeout);
  }, []);

  // Handle URL error params (Clerk sometimes adds error info to URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("error") || params.has("error_description")) {
      setHasError(true);
    }
  }, []);

  const handleRetry = () => {
    // Clear state and redirect to sign-in
    router.push("/leaderboard");
  };

  const handleGoHome = () => {
    router.push("/");
  };

  // Show error state
  if (hasError || isTimedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="bg-[var(--color-bg-secondary)] border border-[#DA7756]/30 rounded-xl p-8">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-[#DA7756] mb-2">
              {isTimedOut ? "Sign-in Timeout" : "Sign-in Error"}
            </h1>
            <p className="text-zinc-400 text-sm mb-6">
              {isTimedOut
                ? "The sign-in process took too long. This can happen with browser privacy settings or slow connections."
                : "There was a problem completing your sign-in. Please try again."}
            </p>
            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className="w-full px-6 py-2.5 bg-[#DA7756] hover:bg-[#B85C3D] text-white font-medium rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleGoHome}
                className="w-full px-6 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 font-medium rounded-lg transition-colors"
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
        afterSignInUrl="/leaderboard"
        afterSignUpUrl="/leaderboard"
      />
    </div>
  );
}
