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

    // Also listen for controller change (another tab triggered update)
    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    // Cleanup event listeners to prevent memory leaks
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;

    // Tell waiting SW to skip waiting and activate
    waitingWorker.postMessage({ type: "SKIP_WAITING" });

    // For standalone PWA, we can't force reload - user needs to restart
    if (!isStandalone) {
      // Browser will reload via controllerchange event
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

  if (!updateAvailable) return null;

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
