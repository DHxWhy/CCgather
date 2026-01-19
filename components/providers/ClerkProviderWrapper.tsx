"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import type { ReactNode } from "react";
import { PostHogUserIdentify } from "./PostHogUserIdentify";

interface ClerkProviderWrapperProps {
  children: ReactNode;
}

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
      <PostHogUserIdentify />
      {children}
    </ClerkProvider>
  );
}
