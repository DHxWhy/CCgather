"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { CursorProvider, CustomCursor } from "@/components/ui/cursor";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { PostHogProvider } from "@/components/providers/PostHogProvider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
            gcTime: 5 * 60 * 1000, // 5 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <PostHogProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <CursorProvider enabled>
            {children}
            {/* Custom cursor - only renders on mouse devices */}
            <CustomCursor enableTrail={false} />
          </CursorProvider>
        </ToastProvider>
      </QueryClientProvider>
    </PostHogProvider>
  );
}
