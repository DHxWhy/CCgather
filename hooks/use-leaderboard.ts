'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LeaderboardUser, LeaderboardFilters } from '@/components/leaderboard';

interface UseLeaderboardOptions {
  initialFilters?: Partial<LeaderboardFilters>;
  pageSize?: number;
  autoFetch?: boolean;
}

interface UseLeaderboardReturn {
  users: LeaderboardUser[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  filters: LeaderboardFilters;
  page: number;
  total: number;
  setFilters: (filters: Partial<LeaderboardFilters>) => void;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  findUserRank: (userId: string) => Promise<LeaderboardUser | null>;
}

const defaultFilters: LeaderboardFilters = {
  search: '',
  tier: 'all',
  country: 'all',
  timeframe: 'all',
};

export function useLeaderboard(options: UseLeaderboardOptions = {}): UseLeaderboardReturn {
  const {
    initialFilters = {},
    pageSize = 50,
    autoFetch = true,
  } = options;

  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFiltersState] = useState<LeaderboardFilters>({
    ...defaultFilters,
    ...initialFilters,
  });

  const fetchLeaderboard = useCallback(async (
    currentPage: number,
    currentFilters: LeaderboardFilters,
    append: boolean = false
  ) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('pageSize', String(pageSize));

      if (currentFilters.search) params.set('search', currentFilters.search);
      if (currentFilters.tier !== 'all') params.set('tier', currentFilters.tier);
      if (currentFilters.country !== 'all') params.set('country', currentFilters.country);
      if (currentFilters.timeframe !== 'all') params.set('timeframe', currentFilters.timeframe);

      const response = await fetch(`/api/leaderboard?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (append) {
        setUsers(prev => [...prev, ...(data.users || [])]);
      } else {
        setUsers(data.users || []);
      }

      setTotal(data.total || 0);
      setHasMore((data.users?.length || 0) === pageSize);
      setPage(currentPage);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch leaderboard';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  const setFilters = useCallback((newFilters: Partial<LeaderboardFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFiltersState(updatedFilters);
    setPage(1);
    fetchLeaderboard(1, updatedFilters, false);
  }, [filters, fetchLeaderboard]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    await fetchLeaderboard(page + 1, filters, true);
  }, [loading, hasMore, page, filters, fetchLeaderboard]);

  const refresh = useCallback(async () => {
    setPage(1);
    await fetchLeaderboard(1, filters, false);
  }, [filters, fetchLeaderboard]);

  const findUserRank = useCallback(async (userId: string): Promise<LeaderboardUser | null> => {
    try {
      const response = await fetch(`/api/leaderboard/user/${userId}`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchLeaderboard(1, filters, false);
    }
  }, [autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    users,
    loading,
    error,
    hasMore,
    filters,
    page,
    total,
    setFilters,
    loadMore,
    refresh,
    findUserRank,
  };
}

export default useLeaderboard;
