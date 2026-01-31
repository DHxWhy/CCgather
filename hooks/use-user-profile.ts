"use client";

import { useQuery, useQueries } from "@tanstack/react-query";
import type { SocialLinks, UsageHistoryPoint } from "@/lib/types";
import type { CCPlanFilter } from "@/lib/types/leaderboard";

// ===========================================
// Types
// ===========================================

export interface UserProfileData {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country_code: string | null;
  total_tokens: number;
  total_cost: number;
  total_sessions: number;
  global_rank: number | null;
  country_rank: number | null;
  current_level: number;
  social_links: SocialLinks | null;
  ccplan: Exclude<CCPlanFilter, "all"> | null;
  has_opus_usage: boolean;
  post_count: number;
}

interface UserProfileResponse {
  user: UserProfileData | null;
}

interface UsageSummaryResponse {
  daily: Array<{ date: string; tokens: number; cost: number }>;
  summary: {
    total_tokens: number;
    total_cost: number;
    days_with_usage: number;
    avg_daily_tokens: number;
  };
}

interface UserBadgesResponse {
  badges: Array<{ badge_type: string; earned_at: string }>;
}

// ===========================================
// Fetch Functions
// ===========================================

async function fetchUserProfile(userId: string): Promise<UserProfileData | null> {
  const response = await fetch(`/api/users/${userId}/profile`);
  if (!response.ok) return null;
  const data: UserProfileResponse = await response.json();
  return data.user;
}

async function fetchUsageSummary(userId: string, days: number = 365): Promise<UsageHistoryPoint[]> {
  const response = await fetch(`/api/users/${userId}/usage-summary?days=${days}`);
  if (!response.ok) return [];
  const data: UsageSummaryResponse = await response.json();
  return (data.daily || []).map((d) => ({
    date: d.date,
    tokens: d.tokens,
    cost: d.cost,
  }));
}

async function fetchUserBadges(userId: string): Promise<string[]> {
  const response = await fetch(`/api/users/${userId}/badges`);
  if (!response.ok) return [];
  const data: UserBadgesResponse = await response.json();
  return (data.badges || []).map((b) => b.badge_type);
}

// ===========================================
// Query Keys Factory
// ===========================================

export const userProfileKeys = {
  all: ["userProfile"] as const,
  profile: (userId: string) => [...userProfileKeys.all, "profile", userId] as const,
  usage: (userId: string, days?: number) =>
    [...userProfileKeys.all, "usage", userId, days ?? 365] as const,
  badges: (userId: string) => [...userProfileKeys.all, "badges", userId] as const,
};

// ===========================================
// Individual Hooks
// ===========================================

export function useUserProfile(userId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userProfileKeys.profile(userId || ""),
    queryFn: () => fetchUserProfile(userId!),
    enabled: !!userId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000, // 5 minutes - profile data changes infrequently
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useUserUsageHistory(
  userId: string | null,
  days: number = 365,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: userProfileKeys.usage(userId || "", days),
    queryFn: () => fetchUsageSummary(userId!, days),
    enabled: !!userId && (options?.enabled ?? true),
    staleTime: 3 * 60 * 1000, // 3 minutes - usage data updates on submission
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

export function useUserBadges(userId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userProfileKeys.badges(userId || ""),
    queryFn: () => fetchUserBadges(userId!),
    enabled: !!userId && (options?.enabled ?? true),
    staleTime: 10 * 60 * 1000, // 10 minutes - badges rarely change
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

// ===========================================
// Combined Hook for ProfileSidePanel
// ===========================================

export interface UseUserProfilePanelResult {
  profile: UserProfileData | null;
  usageHistory: UsageHistoryPoint[];
  badges: string[];
  isLoading: boolean;
  isProfileLoading: boolean;
  isUsageLoading: boolean;
  isBadgesLoading: boolean;
  error: Error | null;
}

export function useUserProfilePanel(
  userId: string | null,
  options?: { enabled?: boolean }
): UseUserProfilePanelResult {
  const enabled = !!userId && (options?.enabled ?? true);

  const results = useQueries({
    queries: [
      {
        queryKey: userProfileKeys.profile(userId || ""),
        queryFn: () => fetchUserProfile(userId!),
        enabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      },
      {
        queryKey: userProfileKeys.usage(userId || "", 365),
        queryFn: () => fetchUsageSummary(userId!, 365),
        enabled,
        staleTime: 3 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      },
      {
        queryKey: userProfileKeys.badges(userId || ""),
        queryFn: () => fetchUserBadges(userId!),
        enabled,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      },
    ],
  });

  const [profileQuery, usageQuery, badgesQuery] = results;

  return {
    profile: profileQuery.data ?? null,
    usageHistory: usageQuery.data ?? [],
    badges: badgesQuery.data ?? [],
    isLoading: profileQuery.isLoading || usageQuery.isLoading || badgesQuery.isLoading,
    isProfileLoading: profileQuery.isLoading,
    isUsageLoading: usageQuery.isLoading,
    isBadgesLoading: badgesQuery.isLoading,
    error: profileQuery.error || usageQuery.error || badgesQuery.error,
  };
}
