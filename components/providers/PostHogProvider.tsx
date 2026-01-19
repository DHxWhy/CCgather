"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

// PostHog 초기화 상태 (향후 상태 체크용)
export let isPostHogInitialized = false;

// PostHog 초기화 (클라이언트 전용)
if (typeof window !== "undefined") {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const isDev = process.env.NODE_ENV === "development";

  // 개발 환경: 직접 PostHog 호스트 사용 (rewrites POST 이슈 우회)
  // 프로덕션: 프록시 사용 (AdBlocker 우회)
  const apiHost = isDev ? "https://us.i.posthog.com" : "/ingest";

  if (posthogKey) {
    try {
      posthog.init(posthogKey, {
        api_host: apiHost,
        ui_host: "https://us.posthog.com",

        person_profiles: "identified_only",

        // 페이지뷰 자동 추적
        capture_pageview: false, // 수동 추적 (SPA 호환)
        capture_pageleave: true,

        // 자동 캡처 설정
        autocapture: {
          dom_event_allowlist: ["click"],
          element_allowlist: ["a", "button", "input", "select"],
          css_selector_allowlist: ["[data-ph-capture]"],
        },

        // 세션 녹화 (비활성화 - 필요시 활성화)
        disable_session_recording: true,

        // 프라이버시
        persistence: "localStorage",
        respect_dnt: true,

        // 초기화 성공 콜백
        loaded: (ph) => {
          isPostHogInitialized = true;
          if (isDev) {
            ph.debug();
            console.log(`[PostHog] Initialized successfully (${isDev ? "direct" : "proxy"})`);
          }
        },
      });
    } catch (error) {
      console.warn("[PostHog] Initialization failed:", error);
      // Graceful degradation - 앱은 계속 작동
    }
  } else if (process.env.NODE_ENV === "development") {
    console.warn("[PostHog] NEXT_PUBLIC_POSTHOG_KEY not configured");
  }
}

// 페이지뷰 추적 컴포넌트
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthog.capture("$pageview", {
        $current_url: url,
      });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}

// 메인 Provider (Clerk 독립적)
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}

// Export posthog instance for custom event tracking
export { posthog };
