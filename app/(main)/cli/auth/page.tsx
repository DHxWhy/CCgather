"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser, SignIn } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";

export default function CLIAuthPage() {
  const { isLoaded, isSignedIn } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<
    "loading" | "authenticating" | "authorizing" | "success" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);

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

  // Show sign in if not authenticated
  if (status === "authenticating" || (!isLoaded && status === "loading")) {
    const redirectUrl = userCode
      ? `/cli/auth?code=${encodeURIComponent(userCode)}`
      : callback
        ? `/cli/auth?callback=${encodeURIComponent(callback)}`
        : "/cli/auth";

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
          <SignIn
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "bg-[var(--color-bg-secondary)] border border-white/10",
              },
            }}
            redirectUrl={redirectUrl}
          />
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
