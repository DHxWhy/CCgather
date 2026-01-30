"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

/**
 * Legacy /join/[code] redirect page
 * Redirects to the new shorter /j/[code] path
 * Keeps old links working while using new URL structure
 */
export default function LegacyJoinRedirect() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  useEffect(() => {
    if (code) {
      // Redirect to the new short URL
      router.replace(`/j/${code}`);
    }
  }, [code, router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
