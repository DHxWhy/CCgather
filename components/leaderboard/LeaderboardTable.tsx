"use client";

import { useState, useEffect, useCallback } from "react";
import { UserRow } from "./UserRow";
import { FilterBar } from "./FilterBar";

export interface SocialLinks {
  github?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
}

export interface LeaderboardUser {
  id: string;
  rank: number;
  username: string;
  avatarUrl: string | null;
  country: string | null;
  tier: string;
  totalTokens: number;
  totalSpent: number;
  badges: string[];
  isCurrentUser?: boolean;
  socialLinks?: SocialLinks | null;
}

export interface LeaderboardFilters {
  search: string;
  tier: string;
  country: string;
  timeframe: "all" | "month" | "week" | "day";
}

interface LeaderboardTableProps {
  initialUsers?: LeaderboardUser[];
  currentUserId?: string;
  showFilters?: boolean;
}

export function LeaderboardTable({
  initialUsers = [],
  currentUserId,
  showFilters = true,
}: LeaderboardTableProps) {
  const [users, setUsers] = useState<LeaderboardUser[]>(initialUsers);
  const [filters, setFilters] = useState<LeaderboardFilters>({
    search: "",
    tier: "all",
    country: "all",
    timeframe: "all",
  });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const pageSize = 50;

  const fetchLeaderboard = useCallback(
    async (loadMore = false) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", loadMore ? String(page + 1) : "1");
        params.set("pageSize", String(pageSize));

        if (filters.search) params.set("search", filters.search);
        if (filters.tier !== "all") params.set("tier", filters.tier);
        if (filters.country !== "all") params.set("country", filters.country);
        if (filters.timeframe !== "all") params.set("timeframe", filters.timeframe);

        const response = await fetch(`/api/leaderboard?${params}`);
        const data = await response.json();

        if (data.users) {
          const markedUsers = data.users.map((u: LeaderboardUser) => ({
            ...u,
            isCurrentUser: u.id === currentUserId,
          }));

          if (loadMore) {
            setUsers((prev) => [...prev, ...markedUsers]);
            setPage((p) => p + 1);
          } else {
            setUsers(markedUsers);
            setPage(1);
          }
          setHasMore(data.users.length === pageSize);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setLoading(false);
      }
    },
    [filters, page, currentUserId]
  );

  useEffect(() => {
    if (initialUsers.length === 0) {
      fetchLeaderboard();
    }
  }, [initialUsers.length, fetchLeaderboard]);

  function handleFilterChange(newFilters: Partial<LeaderboardFilters>) {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }

  return (
    <div className="w-full">
      {showFilters && (
        <FilterBar filters={filters} onFilterChange={handleFilterChange} loading={loading} />
      )}

      <div className="mt-4 rounded-lg border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-bg-secondary text-xs text-text-muted border-b border-white/5">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-4">User</div>
          <div className="col-span-2 text-right">Tokens</div>
          <div className="col-span-2 text-right">Spent</div>
          <div className="col-span-2 text-center">Tier</div>
          <div className="col-span-1 text-center">Badges</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/5">
          {users.length === 0 && !loading ? (
            <div className="py-12 text-center text-text-muted">No users found</div>
          ) : (
            users.map((user) => <UserRow key={user.id} user={user} />)
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-8 text-center">
            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && users.length > 0 && (
          <div className="p-4 text-center border-t border-white/5">
            <button
              onClick={() => fetchLeaderboard(true)}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LeaderboardTable;
