"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";

// PostHog 초기화 상태 (향후 상태 체크용)
export let isPostHogInitialized = false;

// 페이지뷰 추적 컴포넌트 (Suspense 불필요 - window.location 직접 사용)
function PostHogPageView() {
  const pathname = usePathname();
  const posthogClient = usePostHog();

  useEffect(() => {
    if (pathname && posthogClient) {
      // window.location.search를 직접 사용하여 Suspense 트리거 방지
      const searchParams = new URLSearchParams(window.location.search);
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthogClient.capture("$pageview", {
        $current_url: url,
      });
    }
  }, [pathname, posthogClient]);

  return null;
}

// 사용자 식별 컴포넌트 - PostHogProvider 내부에서만 사용
// (이전에 ClerkProviderWrapper에 있었으나, usePostHog()는 PHProvider 내부에서 호출해야 함)
function PostHogUserIdentify() {
  const { user, isLoaded } = useUser();
  const posthogClient = usePostHog();

  useEffect(() => {
    if (!isLoaded || !posthogClient) return;

    if (user) {
      // 로그인한 사용자 식별
      posthogClient.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        username: user.username,
        name: user.fullName,
        avatar: user.imageUrl,
        created_at: user.createdAt?.toISOString(),
      });
    } else {
      // 로그아웃 시 리셋
      posthogClient.reset();
    }
  }, [user, isLoaded, posthogClient]);

  return null;
}

// PostHog lazy init - hydration 이후 초기화하여 메인 스레드 차단 방지
function usePostHogInit() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || posthog.__loaded) return;
    initialized.current = true;

    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!posthogKey) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[PostHog] NEXT_PUBLIC_POSTHOG_KEY not configured");
      }
      return;
    }

    const isDev = process.env.NODE_ENV === "development";
    const apiHost = isDev ? "https://us.i.posthog.com" : "/ingest";

    try {
      posthog.init(posthogKey, {
        api_host: apiHost,
        ui_host: "https://us.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: {
          dom_event_allowlist: ["click"],
          element_allowlist: ["a", "button", "input", "select"],
          css_selector_allowlist: ["[data-ph-capture]"],
        },
        disable_session_recording: true,
        persistence: "localStorage",
        respect_dnt: true,
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
    }
  }, []);
}

// 메인 Provider
// PostHog lazy init → useEffect 내에서 초기화 (hydration 후)
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  usePostHogInit();

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      <PostHogUserIdentify />
      {children}
    </PHProvider>
  );
}

// Export posthog instance for custom event tracking
export { posthog };
