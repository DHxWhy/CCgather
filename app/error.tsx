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

  // 첫 Try Again 부터 옛 PWA SW + 전체 cache 청소 (Diana 진단:
  // ChunkLoadError 가 영구화되는 패턴이라 reset() 단독으로는 절대 회복 불가).
  // 옛 worker-*.js (skipWaiting=false 시절) 이 살아있으면서 옛 chunk URL 캐시
  // 서빙 → 새 build 의 hash 와 mismatch → boundary 무한 루프.
  const handleRetry = useCallback(async () => {
    retryCount.current += 1;

    // 모든 시도에서 SW + cache 전체 청소. precache 도 새 build 에서 다시 만들어짐.
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // SW API 없는 환경 — 무시
    }
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // Cache API 차단 — 무시
    }

    // 첫 시도는 reset() 으로 가벼운 재시도, 두 번째부터 hard reload.
    if (retryCount.current <= 1) {
      reset();
      return;
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
