"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { AlertTriangle, RefreshCw, Home, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// 배포 직후 열려 있던 탭은 사라진 해시의 chunk 를 요청해 404 를 받는다. 사용자
// 잘못이 아니고 재방문이면 반드시 풀리므로, 화면을 보여주기 전에 한 번은 조용히
// 회복시킨다. 무한 새로고침을 막기 위해 탭 단위(sessionStorage)로 1회만 시도한다.
const AUTO_RECOVERY_KEY = "ccg:chunk-auto-recovery";

function isChunkLoadError(error: Error): boolean {
  const name = error.name || "";
  const message = error.message || "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      message
    )
  );
}

async function purgeServiceWorkerAndCaches(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // SW API 차단 환경
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Cache API 차단 환경
  }
}

export default function Error({ error, reset }: ErrorProps) {
  const retryCount = useRef(0);
  const [isRecovering, setIsRecovering] = useState(false);

  // 첫 렌더에서 동기적으로 판정해야 에러 화면이 깜빡이지 않는다.
  const [autoRecovering] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!isChunkLoadError(error)) return false;
    try {
      if (sessionStorage.getItem(AUTO_RECOVERY_KEY)) return false;
      sessionStorage.setItem(AUTO_RECOVERY_KEY, String(Date.now()));
    } catch {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (!autoRecovering) return;
    let cancelled = false;
    void (async () => {
      await purgeServiceWorkerAndCaches();
      if (!cancelled) window.location.reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [autoRecovering]);

  // 갇힌 사용자 escape hatch — F12 콘솔 명령 대체.
  // SW + 모든 cache + localStorage + sessionStorage 전부 청소 후 root 로 이동.
  // Try Again 으로 안 풀리는 사용자가 한 번 클릭으로 회복.
  const handleHardReset = useCallback(async () => {
    setIsRecovering(true);
    await purgeServiceWorkerAndCaches();
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // storage 차단
    }
    // root 로 이동 + replace 로 history 정리
    window.location.replace("/");
  }, []);

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
    await purgeServiceWorkerAndCaches();

    // 첫 시도는 reset() 으로 가벼운 재시도, 두 번째부터 hard reload.
    if (retryCount.current <= 1) {
      reset();
      return;
    }
    window.location.reload();
  }, [reset]);

  if (autoRecovering) {
    return <div className="min-h-screen bg-bg-primary" aria-busy="true" />;
  }

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
          <Button variant="primary" onClick={handleRetry} disabled={isRecovering}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/")}
            disabled={isRecovering}
          >
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>

        {/* Hard reset escape hatch — Try Again 으로 안 풀리는 갇힌 사용자용.
            F12 콘솔 명령 대체. 사용자가 한 번 클릭하면 SW + 모든 캐시 + storage
            청소 후 root 페이지로 이동. 다시 방문하면 정상 작동. */}
        <div className="mt-8 pt-6 border-t border-[var(--border-default)]">
          <p className="text-xs text-text-muted mb-3">
            계속 같은 에러가 나오나요? 사이트 캐시를 완전히 비우면 해결됩니다.
          </p>
          <button
            type="button"
            onClick={handleHardReset}
            disabled={isRecovering}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-[var(--border-default)] hover:border-[var(--color-claude-coral)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isRecovering ? "Resetting…" : "Reset & Recover"}
          </button>
        </div>
      </div>
    </div>
  );
}
