"use client";

import { useEffect, useCallback, useRef } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const retryCount = useRef(0);

  useEffect(() => {
    // Log error to monitoring service (e.g., Sentry)
    console.error("Application Error:", error);
  }, [error]);

  // First attempt: React error boundary reset (lightweight).
  // Second attempt: Clear stale SW caches + hard reload (full recovery).
  const handleRetry = useCallback(async () => {
    retryCount.current += 1;

    if (retryCount.current <= 1) {
      // Lightweight retry — re-render without full page reload
      reset();
      return;
    }

    // Full recovery — clear stale caches and hard reload
    try {
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        // Only clear workbox runtime caches — precache is version-managed by SW itself
        const staleCaches = cacheNames.filter(
          (name) =>
            name === "static-resources" || name === "external-resources" || name === "start-url"
        );
        await Promise.all(staleCaches.map((name) => caches.delete(name)));
      }
    } catch {
      // Ignore cache cleanup errors
    }
    window.location.reload();
  }, [reset]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-[var(--color-error-bg)] flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-[var(--color-error)]" />
          </div>
        </div>

        {/* Error Message */}
        <h1 className="text-2xl font-bold text-text-primary mb-2">Something went wrong</h1>
        <p className="text-text-secondary mb-6">
          An unexpected error occurred. Please try again or return to the home page.
        </p>

        {/* Error Details (Development) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mb-6 p-4 bg-[var(--color-bg-card)] border border-[var(--border-default)] rounded-lg text-left">
            <p className="text-xs font-mono text-text-muted break-all">{error.message}</p>
            {error.digest && (
              <p className="text-xs font-mono text-text-disabled mt-2">Digest: {error.digest}</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="primary" onClick={handleRetry}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
