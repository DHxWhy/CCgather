"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ===========================================
// Types
// ===========================================

type UpdateMode = "refresh" | "restart";

interface UpdateNotificationProps {
  className?: string;
}

// ===========================================
// Hook: Detect PWA Update
// ===========================================

function usePWAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running as standalone PWA
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Skip in development or if SW not supported
    if (process.env.NODE_ENV === "development" || !("serviceWorker" in navigator)) {
      return;
    }

    const handleUpdate = (registration: ServiceWorkerRegistration) => {
      // New SW is waiting to activate
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setUpdateAvailable(true);
      }

      // Listen for new SW installing
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          // New SW is installed and waiting
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setUpdateAvailable(true);
          }
        });
      });
    };

    // Check existing registration
    navigator.serviceWorker.ready.then(handleUpdate);

    // Also listen for controller change (another tab triggered update, OR
    // workbox skipWaiting:true 가 새 SW 를 즉시 active 시킨 경우).
    // Use window-level flag to prevent multiple reloads across component remounts.
    const CRITICAL_PATHS = ["/sso-callback", "/sign-in", "/sign-up", "/cli/auth", "/onboarding"];
    const isOnCriticalPath = () => {
      const p = window.location.pathname;
      return CRITICAL_PATHS.some((cp) => p.startsWith(cp));
    };

    const handleControllerChange = () => {
      const w = window as Window & { __swRefreshing?: boolean };
      if (w.__swRefreshing) return;

      // Critical path 보호: OAuth code 가 URL 에 있는데 reload 하면 code 손실 → OAuth 실패.
      // 가입/로그인 진행 중에도 reload 시 사용자가 처음부터 다시 해야 함.
      // 사용자가 다른 페이지로 자연 navigate 하면 새 SW 가 그 시점부터 자동 적용됨.
      if (isOnCriticalPath()) {
        console.log("[SW] new controller active on critical path — deferring reload");
        return;
      }

      // OAuth 직후 60s grace: 막 로그인해 landing(/leaderboard 등)에 도착한 순간 controllerchange
      // reload 가 터지면 Clerk 재하이드레이션 중 Sign In 깜빡임 발생. sso-callback 가 박은 마크가
      // 살아있으면 보류 (다음 자연 navigate 시 새 SW 자동 적용). PwaMigration 과 동일 패턴.
      try {
        const mark = sessionStorage.getItem("ccg_oauth_just_finished");
        if (mark) {
          const ts = Number.parseInt(mark, 10);
          if (!Number.isNaN(ts) && Date.now() - ts < 60_000) {
            console.log("[SW] controllerchange reload deferred — OAuth just finished");
            return;
          }
        }
      } catch {
        // sessionStorage 차단 — grace 없이 진행
      }

      w.__swRefreshing = true;
      // Delay reload to let React finish current render cycle and SW activation complete.
      setTimeout(() => {
        window.location.reload();
      }, 100);
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    // Cleanup event listeners to prevent memory leaks
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;

    // Hide notification immediately so it doesn't reappear
    setUpdateAvailable(false);

    // Tell waiting SW to skip waiting and activate
    waitingWorker.postMessage({ type: "SKIP_WAITING" });

    // For standalone PWA, we can't force reload - user needs to restart
    if (!isStandalone) {
      // Browser should reload via controllerchange event,
      // but add fallback in case the event doesn't fire.
      setTimeout(() => {
        const w = window as Window & { __swRefreshing?: boolean };
        if (w.__swRefreshing) return;
        // Critical path 보호: 사용자가 OAuth/가입 도중에 Update Now 를 눌렀어도
        // 그 흐름이 깨지지 않도록 reload 보류. 다음 navigate 시 새 SW 가 자연 적용됨.
        const p = window.location.pathname;
        const critical = ["/sso-callback", "/sign-in", "/sign-up", "/cli/auth", "/onboarding"];
        if (critical.some((cp) => p.startsWith(cp))) return;
        w.__swRefreshing = true;
        setTimeout(() => window.location.reload(), 100);
      }, 2000);
    }
  }, [waitingWorker, isStandalone]);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return {
    updateAvailable,
    isStandalone,
    applyUpdate,
    dismissUpdate,
  };
}

// ===========================================
// Component: Update Notification
// ===========================================

export function UpdateNotification({ className }: UpdateNotificationProps) {
  const { updateAvailable, isStandalone, applyUpdate, dismissUpdate } = usePWAUpdate();
  const [isVisible, setIsVisible] = useState(false);

  // Animate in when update available
  useEffect(() => {
    if (updateAvailable) {
      // Small delay for smooth entrance
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    }
    setIsVisible(false);
    return undefined;
  }, [updateAvailable]);

  // Skip rendering in development mode - PWA is disabled
  // Also skip if no update available
  if (process.env.NODE_ENV === "development" || !updateAvailable) return null;

  const mode: UpdateMode = isStandalone ? "restart" : "refresh";

  const content = {
    refresh: {
      icon: <RefreshCw size={18} className="text-[var(--color-claude-coral)]" />,
      title: "A new version is ready!",
      description: "Update now for a better experience",
      buttonText: "Update Now",
      buttonAction: applyUpdate,
    },
    restart: {
      icon: <Sparkles size={18} className="text-[var(--color-claude-coral)]" />,
      title: "A new version is ready!",
      description: "Reopen the app to apply the update",
      buttonText: "Got it",
      buttonAction: () => {
        applyUpdate(); // Trigger skipWaiting so update is ready on next launch
        dismissUpdate();
      },
    },
  };

  const { icon, title, description, buttonText, buttonAction } = content[mode];

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-sm",
        "transition-all duration-500 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none",
        className
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl",
          "bg-[var(--color-bg-card)] border border-[var(--color-claude-coral)]/20",
          "shadow-lg shadow-[var(--color-claude-coral)]/10",
          "backdrop-blur-xl"
        )}
      >
        {/* Subtle gradient accent */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--color-claude-coral)] to-transparent opacity-50" />

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon with subtle pulse */}
            <div
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                "bg-[var(--color-claude-coral)]/10"
              )}
            >
              <div className="animate-pulse">{icon}</div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{description}</p>

              {/* Action Button */}
              <button
                onClick={buttonAction}
                className={cn(
                  "mt-3 px-4 py-1.5 rounded-lg text-xs font-medium",
                  "bg-[var(--color-claude-coral)] text-white",
                  "hover:bg-[var(--color-claude-rust)] transition-colors",
                  "flex items-center gap-1.5"
                )}
              >
                {mode === "refresh" && <RefreshCw size={12} />}
                {buttonText}
              </button>
            </div>

            {/* Dismiss */}
            <button
              onClick={dismissUpdate}
              className={cn(
                "flex-shrink-0 p-1 rounded-full",
                "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
                "hover:bg-[var(--glass-bg)] transition-colors"
              )}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpdateNotification;
