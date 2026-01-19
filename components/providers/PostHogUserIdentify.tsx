"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { usePostHog } from "posthog-js/react";

// 사용자 식별 컴포넌트 - ClerkProvider가 있는 레이아웃에서만 사용
export function PostHogUserIdentify() {
  const { user, isLoaded } = useUser();
  const posthog = usePostHog();

  useEffect(() => {
    if (!isLoaded || !posthog) return;

    if (user) {
      // 로그인한 사용자 식별
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        username: user.username,
        name: user.fullName,
        avatar: user.imageUrl,
        created_at: user.createdAt?.toISOString(),
      });
    } else {
      // 로그아웃 시 리셋
      posthog.reset();
    }
  }, [user, isLoaded, posthog]);

  return null;
}
