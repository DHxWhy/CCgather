"use client";

import { useEffect, useState, useRef } from "react";
import {
  AuthenticateWithRedirectCallback,
  useClerk,
  useAuth,
  useSignIn,
  useSignUp,
} from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ErrorType = "timeout" | "auth" | "session";

// Check if URL has valid OAuth callback parameters
function hasValidCallbackParams(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  return (
    params.has("code") ||
    params.has("state") ||
    params.has("__clerk_status") ||
    params.has("__clerk_created_session") ||
    hash.includes("access_token") ||
    params.has("error") ||
    params.has("error_description")
  );
}

export default function SSOCallbackPage() {
  const router = useRouter();
  const { signOut, setActive } = useClerk();
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [hasError, setHasError] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [errorType, setErrorType] = useState<ErrorType>("auth");
  // Check immediately (not in effect) to avoid race with AuthenticateWithRedirectCallback
  const [isValidCallback] = useState(() => hasValidCallbackParams());
  const redirectedRef = useRef(false);
  const transferRef = useRef(false);
  // Cookie/session 진단용 — callback 처리 후 session 활성화 검증
  const [sessionDiagnostic, setSessionDiagnostic] = useState<string | null>(null);

  // 기존 회원이 sign-up(Get Started) 문으로 OAuth 진입 시 Clerk 는 가입을 완료 못하고
  // externalAccount.status='transferable' 로 표시 → sign-in 으로 이관해야 세션 생성됨.
  // 프리빌트 콜백은 이 케이스를 자동 처리 안 해 미로그인으로 떨어지므로 직접 처리.
  const isTransferCase =
    isLoaded && signUp?.verifications?.externalAccount?.status === "transferable";

  // Stale navigation: no OAuth params → redirect to leaderboard (once)
  useEffect(() => {
    if (!isLoaded || isValidCallback || redirectedRef.current) return;
    redirectedRef.current = true;
    router.replace("/leaderboard");
  }, [isLoaded, isValidCallback, router]);

  // Clerk loading timeout (10s)
  useEffect(() => {
    if (isLoaded) return;
    const timeout = setTimeout(() => {
      if (!redirectedRef.current) {
        console.warn("[SSO] Clerk failed to load after 10s, redirecting...");
        redirectedRef.current = true;
        window.location.href = "/leaderboard";
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [isLoaded]);

  // Callback processing timeout (20s) - only for valid callbacks
  useEffect(() => {
    if (!isValidCallback) return;
    const timeout = setTimeout(() => {
      setIsTimedOut(true);
      setErrorType("timeout");
    }, 20000);
    return () => clearTimeout(timeout);
  }, [isValidCallback]);

  // Session 활성화 검증: OAuth callback 처리 후 8초 안에 isSignedIn=true 가 안 되면
  // = Clerk cookie 가 사용자 PC 에서 설정 실패 (third-party cookie 차단, extension,
  // 옛 stale cookie 충돌 등). silent /leaderboard 로 보내면 무한 루프 발생하므로
  // 명확한 진단 화면 표시.
  useEffect(() => {
    if (!isValidCallback || !isLoaded) return;
    if (isSignedIn) return; // 정상 — Clerk SDK 가 redirect 처리

    const timeout = setTimeout(() => {
      if (!redirectedRef.current && !isSignedIn) {
        const cookieList = document.cookie || "(empty)";
        const hasSessionCookie = /__session|__client/.test(cookieList);
        const diagnostic = [
          `URL: ${window.location.href}`,
          `Cookies set: ${hasSessionCookie ? "YES" : "NO (blocked by browser/extension)"}`,
          `Cookie names: ${cookieList.replace(/=[^;]+/g, "=***").slice(0, 200)}`,
          `User-Agent: ${navigator.userAgent.slice(0, 100)}`,
        ].join("\n");
        console.error("[SSO] Session cookie not set after 8s:", diagnostic);
        setSessionDiagnostic(diagnostic);
        setHasError(true);
        setErrorType("session");
      }
    }, 8000);
    return () => clearTimeout(timeout);
  }, [isValidCallback, isLoaded, isSignedIn]);

  // Handle URL error params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (!error && !errorDescription) return;

    setHasError(true);

    const sessionErrors = [
      "session",
      "user_not_found",
      "account_not_found",
      "invalid_session",
      "session_expired",
    ];
    const isSessionError = sessionErrors.some(
      (e) => error?.toLowerCase().includes(e) || errorDescription?.toLowerCase().includes(e)
    );

    if (isSessionError) {
      setErrorType("session");
      // 자동 signOut 제거 — Cookie 차단 환경에서 또 fail 후 무한 루프 발생.
      // 사용자가 직접 액션 선택하도록 에러 화면 노출.
      return;
    }

    setErrorType("auth");
  }, []);

  // existing-user-via-sign-up → sign-in 이관(transfer)으로 세션 생성. 정상 경로(신규가입·일반
  // 로그인)는 아래 프리빌트 콜백이 그대로 담당 — 이 분기는 transferable 케이스에만 작동(additive).
  // 실패 시 /sign-in 폴백(현 동작과 동일, 악화 없음).
  useEffect(() => {
    if (!isTransferCase || transferRef.current) return;
    if (!signIn || !setActive) return;
    transferRef.current = true;
    redirectedRef.current = true;
    (async () => {
      try {
        const res = await signIn.create({ transfer: true });
        if (res.status === "complete") {
          await setActive({ session: res.createdSessionId });
          window.location.href = "/leaderboard";
          return;
        }
        window.location.href = "/sign-in";
      } catch (err) {
        console.error("[SSO] sign-up→sign-in transfer failed:", err);
        window.location.href = "/sign-in";
      }
    })();
  }, [isTransferCase, signIn, setActive]);

  const handleSignIn = async () => {
    // Clear stale session/sign-in state completely before retry
    try {
      await signOut();
    } catch {
      // Ignore - proceed to sign-in regardless
    }
    // Use full page navigation to ensure clean Clerk state
    window.location.href = "/sign-in";
  };

  const handleRetry = () => {
    window.location.href = "/leaderboard";
  };

  const handleGoHome = () => {
    window.location.href = "/";
  };

  // Loading: Clerk not ready or stale navigation
  if (!isLoaded || !isValidCallback) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#DA7756]/30 border-t-[#DA7756] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Session 실패 (cookie 차단): 명확한 복구 옵션 제공
  if (errorType === "session" && hasError) {
    const handleHardReset = async () => {
      // 모든 storage 청소 + 새 시도. Clerk IndexedDB 는 보존 (앱 reload 시 재구성)
      try {
        if (typeof window !== "undefined") {
          localStorage.clear();
          sessionStorage.clear();
        }
        await signOut().catch(() => {});
      } catch {
        // ignore
      }
      window.location.href = "/sign-up";
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] px-4">
        <div className="max-w-lg w-full text-center">
          <div className="bg-[var(--color-bg-secondary)] border border-[#DA7756]/30 rounded-xl p-8">
            <div className="text-5xl mb-4">&#x26A0;&#xFE0F;</div>
            <h1 className="text-xl font-bold text-[#DA7756] mb-2">Sign-in cookie blocked</h1>
            <p className="text-zinc-300 text-sm mb-4">
              GitHub authentication succeeded, but your browser blocked the session cookie. This
              usually happens with:
            </p>
            <ul className="text-zinc-400 text-xs text-left list-disc pl-6 mb-6 space-y-1">
              <li>Privacy extensions (uBlock, Privacy Badger, Ghostery)</li>
              <li>Chrome &quot;Block third-party cookies&quot; setting</li>
              <li>Brave Shields / Firefox Strict tracking protection</li>
              <li>Stale cookies from a previous broken session</li>
            </ul>
            <div className="space-y-3">
              <button
                onClick={handleHardReset}
                className="w-full px-6 py-2.5 bg-[#DA7756] hover:bg-[#B85C3D] text-white font-medium rounded-lg transition-colors"
              >
                Reset & Try Again
              </button>
              <Link
                href="/"
                className="block w-full px-6 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 font-medium rounded-lg transition-colors text-center"
              >
                Go to Home
              </Link>
            </div>
            {sessionDiagnostic && (
              <details className="mt-6 text-left">
                <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
                  Diagnostic info (for support)
                </summary>
                <pre className="mt-2 p-3 bg-black/40 rounded text-[10px] text-zinc-400 overflow-x-auto whitespace-pre-wrap">
                  {sessionDiagnostic}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Error or timeout
  if (hasError || isTimedOut) {
    const errorMessages: Record<ErrorType, { title: string; description: string }> = {
      timeout: {
        title: "Sign-in Timeout",
        description:
          "The sign-in process took too long. This can happen with browser privacy settings or slow connections.",
      },
      auth: {
        title: "Sign-in Error",
        description: "There was a problem completing your sign-in. Please try again.",
      },
      session: {
        title: "Session Error",
        description: "Your session has expired or is invalid. Please sign in again.",
      },
    };

    const { title, description } = errorMessages[errorType];

    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="bg-[var(--color-bg-secondary)] border border-[#DA7756]/30 rounded-xl p-8">
            <div className="text-5xl mb-4">&#x26A0;&#xFE0F;</div>
            <h1 className="text-xl font-bold text-[#DA7756] mb-2">{title}</h1>
            <p className="text-zinc-400 text-sm mb-6">{description}</p>
            <div className="space-y-3">
              <button
                onClick={handleSignIn}
                className="w-full px-6 py-2.5 bg-[#DA7756] hover:bg-[#B85C3D] text-white font-medium rounded-lg transition-colors"
              >
                Sign In Again
              </button>
              <button
                onClick={handleRetry}
                className="w-full px-6 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 font-medium rounded-lg transition-colors"
              >
                Go to Leaderboard
              </button>
              <button
                onClick={handleGoHome}
                className="w-full px-6 py-2.5 bg-transparent hover:bg-white/5 text-zinc-500 font-medium rounded-lg transition-colors"
              >
                Go to Home
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-6">
              If using Safari, try disabling &quot;Prevent cross-site tracking&quot; in Privacy
              settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Normal: render Clerk callback handler
  // IMPORTANT: Do not add effects that redirect based on isSignedIn here.
  // AuthenticateWithRedirectCallback must complete its full flow
  // (session cookie setup + full-page redirect) without being unmounted.

  // PwaMigration 의 60초 grace 트리거. OAuth 직후 첫 /leaderboard 진입에서
  // SW unregister + reload 가 일어나면 hydration 중 Clerk session 깜빡임.
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem("ccg_oauth_just_finished", Date.now().toString());
    } catch {
      // sessionStorage 차단 — grace 없이 진행
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#DA7756]/30 border-t-[#DA7756] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400 text-sm">Completing sign in...</p>
        <p className="text-zinc-500 text-xs mt-2">Please wait a moment</p>
      </div>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/leaderboard"
        signUpFallbackRedirectUrl="/leaderboard"
      />
    </div>
  );
}
