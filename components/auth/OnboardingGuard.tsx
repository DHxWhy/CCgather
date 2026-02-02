"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { AccountRecoveryModal } from "./AccountRecoveryModal";
import { BrandSpinner } from "@/components/shared/BrandSpinner";
import { useMe } from "@/hooks/use-me";

interface PendingDeletionInfo {
  pending_deletion: true;
  deleted_at: string;
  expires_at: string;
  remaining_hours: number;
  stats: {
    tools_submitted: number;
    votes_count: number;
    level: number;
    username: string;
  };
}

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useUser();
  // Initialize as false to prevent hydration mismatch (server renders children)
  const [isChecking, setIsChecking] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [pendingDeletionInfo, setPendingDeletionInfo] = useState<PendingDeletionInfo | null>(null);

  // React Query: Cached /api/me call
  const {
    data: meData,
    isLoading: isMeLoading,
    isFetched: isMeFetched,
  } = useMe({
    enabled: isLoaded && !!isSignedIn,
  });

  // Pages that don't require onboarding check (public pages + auth pages)
  const skipOnboardingCheck = [
    "/onboarding",
    "/sign-in",
    "/sign-up",
    "/cli/auth",
    "/terms",
    "/privacy",
  ];

  const shouldSkipCheck = skipOnboardingCheck.some((path) => pathname.startsWith(path));

  // Handler for account recovery
  const handleRecover = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/recover", { method: "POST" });
      if (!response.ok) throw new Error("Recovery failed");
      setPendingDeletionInfo(null);
      // Refresh the page to load recovered user data
      window.location.reload();
    } catch (error) {
      throw error;
    }
  }, []);

  // Handler for fresh start
  const handleFreshStart = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/fresh-start", { method: "POST" });
      if (!response.ok) throw new Error("Fresh start failed");
      setPendingDeletionInfo(null);
      // Redirect to onboarding for new account
      router.replace("/onboarding");
    } catch (error) {
      throw error;
    }
  }, [router]);

  // Set mounted state after hydration
  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    async function checkOnboardingStatus() {
      // Prevent re-running if already redirecting
      if (isRedirecting) return;
      if (!isLoaded || !hasMounted) return;

      // Not signed in - no need to check
      if (!isSignedIn) {
        setIsChecking(false);
        return;
      }

      // Skip check for certain pages
      if (shouldSkipCheck) {
        setIsChecking(false);
        return;
      }

      // Skip check if just completed onboarding (prevents race condition)
      if (sessionStorage.getItem("onboarding_just_completed")) {
        sessionStorage.removeItem("onboarding_just_completed");
        setIsChecking(false);
        return;
      }

      // Wait for React Query to finish fetching /api/me
      if (isMeLoading) {
        setIsChecking(true);
        return;
      }

      // Start checking only after mount (prevents hydration mismatch)
      setIsChecking(true);

      try {
        // Only fetch recovery-check separately (meData comes from React Query cache)
        const recoveryResponse = await fetch("/api/auth/recovery-check", { cache: "no-store" });

        // Check for pending deletion first
        if (recoveryResponse.ok) {
          const recoveryData = await recoveryResponse.json();
          if (recoveryData.pending_deletion) {
            setPendingDeletionInfo(recoveryData);
            setIsChecking(false);
            return;
          }
        }

        // Check onboarding status using cached meData
        if (!meData && isMeFetched) {
          // User not found in DB
          setIsRedirecting(true);
          router.replace("/onboarding");
          return;
        }

        if (meData) {
          const hasCountry = !!meData.country_code;
          const onboardingDone = meData.onboarding_completed === true;

          if (!hasCountry || !onboardingDone) {
            setIsRedirecting(true);
            router.replace("/onboarding");
            return;
          }
        }
      } catch (error) {
        console.error("Failed to check onboarding status:", error);
      } finally {
        if (!isRedirecting) {
          setIsChecking(false);
        }
      }
    }

    checkOnboardingStatus();
  }, [
    isLoaded,
    isSignedIn,
    shouldSkipCheck,
    router,
    hasMounted,
    isRedirecting,
    meData,
    isMeLoading,
    isMeFetched,
  ]);

  // 모든 훅 호출 후 단일 렌더링 로직 (조건부 early return 제거)
  // React 훅 규칙: 렌더링 간에 훅 개수가 일정해야 함
  const showLoading = hasMounted && (isChecking || isRedirecting) && isSignedIn && !shouldSkipCheck;
  const showRecoveryModal = !!pendingDeletionInfo;

  // 렌더링 우선순위: 로딩 > 복구 모달 > children
  let content: React.ReactNode;

  if (showLoading) {
    content = (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <BrandSpinner size="lg" showText />
      </div>
    );
  } else if (showRecoveryModal) {
    content = (
      <>
        <div className="min-h-screen bg-bg-primary" />
        <AccountRecoveryModal
          isOpen={true}
          pendingInfo={pendingDeletionInfo}
          onRecover={handleRecover}
          onFreshStart={handleFreshStart}
        />
      </>
    );
  } else {
    content = <>{children}</>;
  }

  return content;
}
