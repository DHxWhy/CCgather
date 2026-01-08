"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useUser();
  const [isChecking, setIsChecking] = useState(true);

  // Pages that don't require onboarding check (public pages + auth pages)
  const skipOnboardingCheck = [
    "/onboarding",
    "/sign-in",
    "/sign-up",
    "/cli/auth",
    "/leaderboard",
    "/u/",
    "/league/",
    "/news",
    "/terms",
    "/privacy",
  ];

  const shouldSkipCheck = skipOnboardingCheck.some((path) => pathname.startsWith(path));

  useEffect(() => {
    async function checkOnboardingStatus() {
      if (!isLoaded) return;

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
      if (typeof window !== "undefined" && sessionStorage.getItem("onboarding_just_completed")) {
        sessionStorage.removeItem("onboarding_just_completed");
        setIsChecking(false);
        return;
      }

      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        });

        if (response.status === 404) {
          // User doesn't exist in DB yet - redirect to onboarding
          // (Webhook might still be processing)
          router.replace("/onboarding");
          return;
        }

        if (response.ok) {
          const data = await response.json();
          const hasCountry = !!data.user?.country_code;
          const onboardingDone = data.user?.onboarding_completed === true;

          // User needs onboarding if they don't have a country or haven't completed onboarding
          if (!hasCountry || !onboardingDone) {
            router.replace("/onboarding");
            return;
          }
        }
      } catch (error) {
        console.error("Failed to check onboarding status:", error);
        // On error, let the user through instead of blocking
        // They can try again if needed
      } finally {
        setIsChecking(false);
      }
    }

    checkOnboardingStatus();
  }, [isLoaded, isSignedIn, shouldSkipCheck, router]);

  // Show nothing while checking (prevents flash)
  if (isChecking && isSignedIn && !shouldSkipCheck) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-text-muted text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
