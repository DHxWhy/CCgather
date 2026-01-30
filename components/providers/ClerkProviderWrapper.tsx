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
      signInFallbackRedirectUrl="/leaderboard"
      signUpFallbackRedirectUrl="/leaderboard"
    >
      {children}
    </ClerkProvider>
  );
}
