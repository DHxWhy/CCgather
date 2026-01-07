'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProfileData } from '@/components/profile';

interface UsageHistory {
  date: string;
  tokens: number;
}

interface UseProfileOptions {
  username?: string;
  autoFetch?: boolean;
}

interface UseProfileReturn {
  profile: ProfileData | null;
  usageHistory: UsageHistory[];
  modelBreakdown: Record<string, number>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (data: Partial<ProfileData>) => Promise<boolean>;
}

export function useProfile(options: UseProfileOptions = {}): UseProfileReturn {
  const { username, autoFetch = true } = options;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [usageHistory, setUsageHistory] = useState<UsageHistory[]>([]);
  const [modelBreakdown, setModelBreakdown] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!username) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/profile/${username}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('User not found');
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      setProfile(data.profile);
      setUsageHistory(data.usageHistory || []);
      setModelBreakdown(data.modelBreakdown || {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch profile';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [username]);

  const refresh = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (data: Partial<ProfileData>): Promise<boolean> => {
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const updatedProfile = await response.json();
      setProfile(prev => prev ? { ...prev, ...updatedProfile } : null);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      setError(message);
      return false;
    }
  }, []);

  useEffect(() => {
    if (autoFetch && username) {
      fetchProfile();
    }
  }, [autoFetch, username, fetchProfile]);

  return {
    profile,
    usageHistory,
    modelBreakdown,
    loading,
    error,
    refresh,
    updateProfile,
  };
}

export function useCurrentProfile(): UseProfileReturn & { isLoading: boolean } {
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setCurrentUsername(data.username);
        }
      } catch {
        // User not logged in
      } finally {
        setIsLoading(false);
      }
    }

    fetchCurrentUser();
  }, []);

  const profileHook = useProfile({
    username: currentUsername || undefined,
    autoFetch: !!currentUsername,
  });

  return {
    ...profileHook,
    isLoading: isLoading || profileHook.loading,
  };
}

export default useProfile;
