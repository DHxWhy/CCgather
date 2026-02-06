"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface NavigatorWithRelatedApps extends Navigator {
  getInstalledRelatedApps?: () => Promise<Array<{ platform: string; url?: string; id?: string }>>;
  standalone?: boolean;
}

const STORAGE_KEY = "pwa-install-dismissed";
const INSTALLED_KEY = "pwa-installed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // Start as dismissed until checked

  // Check if already installed
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkInstalled = async () => {
      const nav = window.navigator as NavigatorWithRelatedApps;

      // 1. Check standalone mode (PWA로 실행 중일 때)
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;

      if (isStandalone) {
        setIsInstalled(true);
        localStorage.setItem(INSTALLED_KEY, "true");
        setIsDismissed(false);
        return;
      }

      // 2. Check getInstalledRelatedApps API (Chrome/Edge 지원)
      if (nav.getInstalledRelatedApps) {
        try {
          const relatedApps = await nav.getInstalledRelatedApps();
          if (relatedApps.length > 0) {
            setIsInstalled(true);
            localStorage.setItem(INSTALLED_KEY, "true");
            setIsDismissed(false);
            return;
          }
          // API says not installed — clear stale localStorage flag
          localStorage.removeItem(INSTALLED_KEY);
        } catch {
          // API 실패 시 localStorage fallback 허용
        }
      }

      // 3. Fallback: Check localStorage (API 미지원 브라우저에서만)
      if (!nav.getInstalledRelatedApps) {
        const wasInstalled = localStorage.getItem(INSTALLED_KEY) === "true";
        if (wasInstalled) {
          setIsInstalled(true);
          setIsDismissed(false);
          return;
        }
      }

      // Not installed, check dismiss state
      setIsInstalled(false);
      const dismissedAt = localStorage.getItem(STORAGE_KEY);
      if (dismissedAt) {
        const dismissedTime = parseInt(dismissedAt, 10);
        if (Date.now() - dismissedTime < DISMISS_DURATION_MS) {
          setIsDismissed(true);
          return;
        }
        localStorage.removeItem(STORAGE_KEY);
      }
      setIsDismissed(false);
    };

    checkInstalled();
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      // beforeinstallprompt fires only when app is NOT installed
      // Clear stale installed flag (e.g. user uninstalled the app)
      if (localStorage.getItem(INSTALLED_KEY) === "true") {
        localStorage.removeItem(INSTALLED_KEY);
        setIsInstalled(false);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Listen for app installed event
    const installedHandler = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      localStorage.setItem(INSTALLED_KEY, "true");
    };

    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        setIsInstalled(true);
        setIsInstallable(false);
        localStorage.setItem(INSTALLED_KEY, "true");
      }

      setDeferredPrompt(null);
      return outcome === "accepted";
    } catch {
      return false;
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  }, []);

  const canShowBanner = isInstallable && !isInstalled && !isDismissed;

  return {
    isInstallable,
    isInstalled,
    canShowBanner,
    promptInstall,
    dismiss,
  };
}
