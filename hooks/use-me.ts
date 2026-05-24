"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SocialLinks } from "@/lib/types";

// ===========================================
// Types
// ===========================================

export interface MeData {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country_code: string | null;
  timezone: string | null;
  current_level: number;
  global_rank: number | null;
  country_rank: number | null;
  total_tokens: number;
  total_cost: number;
  onboarding_completed: boolean;
  is_admin: boolean;
  social_links: SocialLinks | null;
  referral_code: string | null;
  hide_profile_on_invite: boolean;
  ccplan: string | null;
  created_at: string;
  last_submission_at: string | null;
  referral_count?: number;
}

interface MeResponse {
  user: MeData;
  referral_count?: number;
}

interface MeUpdateData {
  country_code?: string;
  timezone?: string;
  onboarding_completed?: boolean;
  marketing_consent?: boolean;
  profile_visibility_consent?: boolean;
  community_updates_consent?: boolean;
  integrity_agreed?: boolean;
  social_links?: Partial<SocialLinks>;
  hide_profile_on_invite?: boolean;
}

// ===========================================
// Query Keys
// ===========================================

export const meKeys = {
  all: ["me"] as const,
  profile: () => [...meKeys.all, "profile"] as const,
};

// ===========================================
// Fetch Function
// ===========================================

async function fetchMe(): Promise<MeData | null> {
  // redirect:"manual" — middleware 가 비인증 사용자를 /sign-in 으로 redirect 하는
  // 케이스 방어. 기본 follow 모드면 HTML 응답을 받아 await response.json() 에서
  // SyntaxError 발생 → React Query 가 catch → meData=undefined → Header 가 비로그인
  // 표시. Diana 진단의 secondary throw 원인.
  let response: Response;
  try {
    response = await fetch("/api/me", { cache: "no-store", redirect: "manual" });
  } catch {
    // network 오류 — 비로그인 fallback (boundary 안 띄움)
    return null;
  }

  // opaqueredirect = manual redirect 가 막은 응답 (status:0). 비인증으로 간주.
  if (response.type === "opaqueredirect" || response.status === 0 || response.status === 401) {
    return null;
  }

  // Mercury 발견: currentUser() transient null → /api/me 가 500 반환 가능.
  // 일시 오류는 boundary 안 띄우고 비로그인 fallback (다음 polling 시 회복).
  if (response.status >= 500) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch user data: ${response.status}`);
  }

  // 응답이 JSON 아닐 때 (HTML 등) parser throw 방지
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  const data: MeResponse = await response.json();
  return data.user
    ? {
        ...data.user,
        referral_count: data.referral_count,
      }
    : null;
}

async function updateMe(updates: MeUpdateData): Promise<MeData> {
  const response = await fetch("/api/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update profile");
  }

  const data: MeResponse = await response.json();
  return data.user;
}

// ===========================================
// Hooks
// ===========================================

/**
 * Hook to fetch current user data with caching
 * Replaces direct fetch("/api/me") calls throughout the app
 *
 * Features:
 * - Automatic caching (5 min stale time)
 * - Deduplication of concurrent requests
 * - Background refetch on window focus (disabled)
 * - Shared cache across all components
 */
export function useMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: meKeys.profile(),
    queryFn: fetchMe,
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes - profile data changes infrequently
    gcTime: 30 * 60 * 1000, // 30 minutes cache retention
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for updating user profile with optimistic updates
 */
export function useMeUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMe,
    onSuccess: (updatedUser) => {
      // Update the cache with new data
      queryClient.setQueryData(meKeys.profile(), updatedUser);
    },
    onError: () => {
      // Refetch on error to ensure consistency
      queryClient.invalidateQueries({ queryKey: meKeys.profile() });
    },
  });
}

/**
 * Hook to invalidate user cache (call after actions that modify user data)
 */
export function useInvalidateMe() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: meKeys.all });
  };
}

/**
 * Get cached user data without triggering a fetch
 * Useful for checking cached state in callbacks
 */
export function useMeCached() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<MeData | null>(meKeys.profile());
}
