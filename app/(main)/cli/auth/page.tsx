"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser, useSignIn } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";

export default function CLIAuthPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<
    "loading" | "authenticating" | "authorizing" | "success" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Device code flow
  const userCode = searchParams.get("code");
  // Legacy callback flow (for backwards compatibility)
  const callback = searchParams.get("callback");

  const authorizeDirectly = useCallback(async () => {
    if (userCode) {
      await authorizeDevice(userCode);
    } else if (callback) {
      await generateTokenAndRedirect();
    } else {
      // No code provided - show success
      setStatus("success");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCode, callback]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setStatus("authenticating");
      return;
    }

    // Proceed directly to authorization (no onboarding check needed for CLI)
    authorizeDirectly();
  }, [isLoaded, isSignedIn, authorizeDirectly]);

  // Redirect to leaderboard after success (unless callback flow)
  useEffect(() => {
    if (status === "success" && !callback) {
      const timer = setTimeout(() => {
        router.push("/leaderboard");
      }, 2000);
      return () => clearTimeout(timer);
    }
    return;
  }, [status, callback, router]);

  async function authorizeDevice(code: string) {
    setStatus("authorizing");
    try {
      const response = await fetch("/api/cli/auth/device/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_code: code }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If code was already used or expired, treat as success (user already authorized)
        if (response.status === 410) {
          setStatus("success");
          return;
        }
        throw new Error(data.error || "Failed to authorize");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  // Validate callback URL to prevent Open Redirect attacks
  function isValidCallbackUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();

      // Allow localhost for development
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return true;
      }

      // Allow ccgather domains
      if (hostname === "ccgather.com" || hostname.endsWith(".ccgather.com")) {
        return true;
      }

      // Allow ccgather.dev domains
      if (hostname === "ccgather.dev" || hostname.endsWith(".ccgather.dev")) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  async function generateTokenAndRedirect() {
    try {
      const response = await fetch("/api/cli/auth/token", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate token");
      }

      const data = await response.json();

      if (callback) {
        // Validate callback URL before redirecting
        if (!isValidCallbackUrl(callback)) {
          throw new Error("Invalid callback URL. Only localhost and ccgather.com are allowed.");
        }

        const callbackUrl = new URL(callback);
        callbackUrl.searchParams.set("token", data.token);
        callbackUrl.searchParams.set("userId", data.userId);
        callbackUrl.searchParams.set("username", data.username);

        setStatus("success");
        setTimeout(() => {
          window.location.href = callbackUrl.toString();
        }, 1000);
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  // Handle GitHub sign in with explicit SSO callback URL
  const handleGitHubSignIn = async () => {
    if (!isSignInLoaded || !signIn) return;

    // Build the redirect URL with CLI auth params preserved
    const redirectUrl = userCode
      ? `/cli/auth?code=${encodeURIComponent(userCode)}`
      : callback
        ? `/cli/auth?callback=${encodeURIComponent(callback)}`
        : "/cli/auth";

    setIsSigningIn(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_github",
        redirectUrl: "/sso-callback", // Use consistent SSO callback
        redirectUrlComplete: redirectUrl,
      });
    } catch (err) {
      console.error("GitHub sign in error:", err);
      setError(err instanceof Error ? err.message : "Failed to start sign in");
      setStatus("error");
      setIsSigningIn(false);
    }
  };

  // Show sign in if not authenticated
  if (status === "authenticating" || (!isLoaded && status === "loading")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              CCgather CLI Authentication
            </h1>
            <p className="text-[var(--color-text-muted)]">
              Sign in with GitHub to connect your CLI
            </p>
          </div>

          {/* Custom GitHub Sign In Button */}
          <div className="bg-[var(--color-bg-secondary)] border border-white/10 rounded-xl p-6">
            <button
              onClick={handleGitHubSignIn}
              disabled={!isSignInLoaded || isSigningIn}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-[#DA7756] to-[#B85C3D] text-white font-semibold text-base hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningIn || !isSignInLoaded ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              )}
              <span>
                {isSigningIn
                  ? "Connecting..."
                  : !isSignInLoaded
                    ? "Loading..."
                    : "Continue with GitHub"}
              </span>
            </button>

            <p className="text-center text-xs text-[var(--color-text-muted)] mt-4">
              By signing in, you agree to our{" "}
              <a href="/terms" className="text-[#DA7756] hover:underline">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-[#DA7756] hover:underline">
                Privacy Policy
              </a>
            </p>
          </div>

          {userCode && (
            <div className="mt-4 p-3 bg-white/5 rounded-lg text-center">
              <p className="text-xs text-[var(--color-text-muted)]">
                Device Code: <code className="text-[#DA7756] font-mono">{userCode}</code>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="max-w-md w-full mx-4 text-center">
        {status === "loading" && (
          <>
            <div className="w-12 h-12 border-4 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[var(--color-text-muted)]">Preparing authentication...</p>
          </>
        )}

        {status === "authorizing" && (
          <>
            <div className="w-12 h-12 border-4 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
              Authorizing CLI...
            </h1>
            <p className="text-[var(--color-text-muted)]">Please wait</p>
          </>
        )}

        {status === "success" && (
          <div className="bg-[var(--color-bg-secondary)] border border-green-500/30 rounded-xl p-8">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-green-400 mb-2">CLI Authorized!</h1>
            <p className="text-[var(--color-text-muted)] mb-4">
              {callback ? "Redirecting to CLI..." : "Redirecting to leaderboard..."}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Return to your terminal to submit usage data.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-claude-coral)]/30 rounded-xl p-8">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-[var(--color-claude-coral)] mb-2">
              Authorization Failed
            </h1>
            <p className="text-[var(--color-text-muted)] mb-6">{error}</p>
            <button
              onClick={() => {
                setStatus("loading");
                setError(null);
                authorizeDirectly();
              }}
              className="px-6 py-2.5 bg-[var(--color-claude-coral)] hover:bg-[var(--color-claude-coral-hover)] text-white font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
