"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { AccountRecoveryModal } from "./AccountRecoveryModal";
import { BrandSpinner } from "@/components/shared/BrandSpinner";
import { useMe } from "@/hooks/use-me";

// Race-guard flag set by /onboarding right after successful completion.
// Stored as Date.now() string; valid for up to 5s after onboarding finishes.
const ONBOARDING_FLAG_KEY = "onboarding_just_completed";
const ONBOARDING_FLAG_TTL_MS = 5_000;

/** Read the just-completed flag without consuming it. Auto-cleans expired values. */
function readOnboardingJustCompleted(): boolean {
  try {
    const raw = sessionStorage.getItem(ONBOARDING_FLAG_KEY);
    if (!raw) return false;
    const ts = Number.parseInt(raw, 10);
    if (Number.isNaN(ts)) {
      sessionStorage.removeItem(ONBOARDING_FLAG_KEY);
      return false;
    }
    if (Date.now() - ts > ONBOARDING_FLAG_TTL_MS) {
      sessionStorage.removeItem(ONBOARDING_FLAG_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// 라이브 get_pending_deletion_info(p_clerk_id) 의 실제 반환 shape (064 마이그레이션).
interface PendingDeletionInfo {
  pending: true;
  deleted_at: string;
  days_remaining: number;
  username: string;
  display_name: string | null;
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
  // mount-once guard — survives Strict-Mode double-invoke, prevents the second
  // mount from missing the flag and bouncing the user back to /onboarding.
  const consumedFlagRef = useRef(false);

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

  // isRedirecting latches true the moment we trigger a router.replace and was never
  // cleared anywhere. OnboardingGuard lives in the persistent (main) layout, so once a
  // user is bounced to /onboarding the flag stayed true forever — and after they finish
  // onboarding and land back on a non-skip page (/leaderboard), showLoading kept seeing
  // isRedirecting===true → infinite "Loading." spinner. Clear it once the navigation
  // actually lands (pathname changed = redirect complete).
  useEffect(() => {
    setIsRedirecting(false);
  }, [pathname]);

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

      // Skip check if just completed onboarding (prevents race condition).
      // Either: (1) flag still valid in sessionStorage, or
      //         (2) this instance already consumed it once (Strict Mode remount).
      if (consumedFlagRef.current || readOnboardingJustCompleted()) {
        consumedFlagRef.current = true;
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
          // 라이브 RPC 계약: { pending, days_remaining, username, display_name }.
          // 옛 코드는 pending_deletion 을 읽어 항상 undefined → 복구 모달이 영영 안 떴음.
          if (recoveryData.pending) {
            setPendingDeletionInfo(recoveryData);
            setIsChecking(false);
            return;
          }
        }

        // Check onboarding status using cached meData.
        // 새 정책: country/onboarding 은 가입 시 자동 처리됨 (IP geo + implicit consent).
        // 따라서 Guard 는 "DB row 존재 여부" 만 확인. country 가 null 이라도 진입 허용
        // — 리더보드/settings 에서 banner 로 입력 유도.
        if (!meData && isMeFetched) {
          // User not found in DB — 자동 생성 fallback 이 실패한 매우 드문 경우
          setIsRedirecting(true);
          router.replace("/onboarding");
          return;
        }

        if (meData) {
          // Frictionless 가입 정책:
          //   - webhook 또는 /api/me 자동 생성이 onboarding_completed=true 로 세팅함
          //   - country_code 는 /api/me GET 의 IP geo 백필이 채움
          //   → 모두 비어있는 사용자만 legacy (2026-02 이전 가입자 ~9명) 로 간주
          //
          // country 만 비어있는 경우는 통과 — 사용자가 settings/banner 에서 채울 수 있음
          // (사이트 진입 자체를 막지 않음)
          const isLegacyUnonboarded = !meData.country_code && meData.onboarding_completed === false;

          if (isLegacyUnonboarded) {
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
  // 로그인 사용자만 선제적 로딩 표시 (깜빡임 방지)
  const showLoading =
    // 1. 로그인 확인됨 + /api/me 아직 로드 안됨 → 로딩
    (isLoaded && isSignedIn && !isMeFetched && !shouldSkipCheck) ||
    // 2. 기존 체킹 로직 (recovery-check 등)
    (hasMounted && (isChecking || isRedirecting) && isSignedIn && !shouldSkipCheck);
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
