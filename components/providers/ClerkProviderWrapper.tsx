"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import type { ReactNode } from "react";

interface ClerkProviderWrapperProps {
  children: ReactNode;
}

// PostHogUserIdentify는 PostHogProvider 내부에서 호출해야 함
// → PostHogProvider.tsx로 이동됨
export function ClerkProviderWrapper({ children }: ClerkProviderWrapperProps) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#DA7756",
        },
      }}
      // Mars P3: env (NEXT_PUBLIC_CLERK_SIGN_*) 누락 안전망. 명시해두면
      // <SignedOut>/redirectToSignIn 가 Clerk hosted Portal (accounts.dev) 대신
      // 우리 GitHub-only 페이지로 보냄.
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/leaderboard"
      signUpFallbackRedirectUrl="/leaderboard"
    >
      {children}
    </ClerkProvider>
  );
}
