"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, LayoutList, LayoutGrid, Loader2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { ToolCard, ToolListItem, CategoryTabs, PeriodFilter } from "@/components/tools";
import { EligibilityModal } from "@/components/tools/EligibilityModal";
import { ProfileSidePanel } from "@/components/leaderboard/ProfileSidePanel";
import type { ToolWithVoters, ToolCategory, ToolPeriod, ToolSortOption } from "@/types/tools";
import type { LeaderboardUser } from "@/lib/types";

// =====================================================
// Types
// =====================================================

type ViewMode = "list" | "card";

interface EligibilityData {
  eligible: boolean;
  requirements: {
    level: { met: boolean; current: number; required: number; name: string };
    data_days: { met: boolean; current: number; required: number };
  };
  allRequirements: Array<{ key: string; label: string; description: string }>;
}

// Extended user type for profile panel display
interface DisplayUser extends LeaderboardUser {
  rank: number;
  isCurrentUser?: boolean;
}

// =====================================================
// Component
// =====================================================

export default function ToolsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();

  // State
  const [tools, setTools] = useState<ToolWithVoters[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Eligibility Modal State
  const [showEligibilityModal, setShowEligibilityModal] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  // Profile Panel State
  const [selectedUser, setSelectedUser] = useState<DisplayUser | null>(null);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Filter state from URL
  const category = (searchParams.get("category") as ToolCategory | "all") || "all";
  const period = (searchParams.get("period") as ToolPeriod) || "week";
  const sort = (searchParams.get("sort") as ToolSortOption) || "weighted";

  // View mode (local state)
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // User interaction state (would be fetched with tools in production)
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());
  const [userBookmarks, setUserBookmarks] = useState<Set<string>>(new Set());

  // =====================================================
  // Data Fetching
  // =====================================================

  const fetchTools = useCallback(
    async (offset = 0, append = false) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams({
          category,
          period,
          sort,
          limit: "20",
          offset: offset.toString(),
        });

        const res = await fetch(`/api/tools?${params}`);
        if (!res.ok) throw new Error("Failed to fetch tools");

        const data = await res.json();

        if (append) {
          setTools((prev) => [...prev, ...data.tools]);
        } else {
          setTools(data.tools);
        }

        setTotal(data.total);
        setHasMore(data.hasMore);
      } catch (error) {
        console.error("Error fetching tools:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, period, sort]
  );

  useEffect(() => {
    fetchTools(0, false);
  }, [fetchTools]);

  // =====================================================
  // URL State Management
  // =====================================================

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all" || value === "week" || value === "weighted") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/tools?${params.toString()}`, { scroll: false });
  };

  // =====================================================
  // Submit Tool Handler
  // =====================================================

  const handleSubmitClick = async () => {
    if (!isSignedIn) {
      router.push("/sign-in?redirect_url=/tools/submit");
      return;
    }

    setCheckingEligibility(true);
    setShowEligibilityModal(true);

    try {
      const res = await fetch("/api/tools/eligibility");
      if (res.ok) {
        const data = await res.json();
        setEligibility(data);

        // If eligible, redirect to submit page
        if (data.eligible) {
          setShowEligibilityModal(false);
          router.push("/tools/submit");
        }
      }
    } catch (error) {
      console.error("Failed to check eligibility:", error);
    } finally {
      setCheckingEligibility(false);
    }
  };

  // =====================================================
  // Interaction Handlers
  // =====================================================

  const handleVote = async (toolId: string) => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    const res = await fetch(`/api/tools/${toolId}/vote`, {
      method: "POST",
    });

    if (res.ok) {
      const data = await res.json();
      if (data.voted) {
        setUserVotes((prev) => new Set(prev).add(toolId));
      } else {
        setUserVotes((prev) => {
          const newSet = new Set(prev);
          newSet.delete(toolId);
          return newSet;
        });
      }

      // Update tool in list
      setTools((prev) =>
        prev.map((tool) =>
          tool.id === toolId
            ? { ...tool, upvote_count: data.new_count, weighted_score: data.new_weighted_score }
            : tool
        )
      );
    }
  };

  const handleBookmark = async (toolId: string) => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    const res = await fetch(`/api/tools/${toolId}/bookmark`, {
      method: "POST",
    });

    if (res.ok) {
      const data = await res.json();
      if (data.bookmarked) {
        setUserBookmarks((prev) => new Set(prev).add(toolId));
      } else {
        setUserBookmarks((prev) => {
          const newSet = new Set(prev);
          newSet.delete(toolId);
          return newSet;
        });
      }
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchTools(tools.length, true);
    }
  };

  // =====================================================
  // Profile Panel Handler
  // =====================================================

  const handleSuggesterClick = async (userId: string) => {
    if (loadingProfile) return;

    setLoadingProfile(true);
    setProfilePanelOpen(true);

    try {
      // Fetch user profile data
      const res = await fetch(`/api/users/${userId}/profile`);
      if (!res.ok) throw new Error("Failed to fetch user profile");

      const data = await res.json();
      if (data.user) {
        const userData = data.user;
        setSelectedUser({
          ...userData,
          rank: userData.global_rank || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setProfilePanelOpen(false);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleCloseProfilePanel = () => {
    setProfilePanelOpen(false);
    // Delay clearing user data for smooth exit animation
    setTimeout(() => setSelectedUser(null), 300);
  };

  // =====================================================
  // Render
  // =====================================================

  return (
    <div className="space-y-4">
      {/* Controls Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Period Filter */}
        <PeriodFilter selected={period} onChange={(p) => updateFilter("period", p)} />

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-[var(--color-filter-bg)] rounded-lg p-1 border border-[var(--border-default)]">
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "list"
                ? "bg-[var(--color-filter-active)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
            aria-label="리스트 뷰"
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("card")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "card"
                ? "bg-[var(--color-filter-active)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
            aria-label="카드 뷰"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmitClick}
          className={cn(
            "ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
            "bg-[var(--color-claude-coral)] text-white",
            "text-sm font-medium",
            "hover:bg-[var(--color-claude-rust)] transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-claude-coral)] focus-visible:ring-offset-2"
          )}
        >
          <Plus className="w-4 h-4" />
          <span>Submit Tool</span>
        </button>
      </div>

      {/* Category Tabs */}
      <CategoryTabs selected={category} onChange={(c) => updateFilter("category", c)} />

      {/* Results Count */}
      <div className="text-xs text-[var(--color-text-muted)]">{total} tools found</div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-claude-coral)]" />
        </div>
      ) : tools.length === 0 ? (
        // Empty State
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="text-4xl mb-4">🔍</span>
          <p className="text-[var(--color-text-secondary)] mb-4">No tools in this category yet</p>
          <button
            onClick={handleSubmitClick}
            className="text-sm text-[var(--color-claude-coral)] hover:underline"
          >
            Submit the first tool →
          </button>
        </div>
      ) : (
        // Tools List/Grid
        <>
          {viewMode === "list" ? (
            <div className="space-y-2">
              {tools.map((tool, index) => (
                <ToolListItem
                  key={tool.id}
                  tool={tool}
                  rank={index + 1}
                  isVoted={userVotes.has(tool.id)}
                  isBookmarked={userBookmarks.has(tool.id)}
                  onVote={handleVote}
                  onBookmark={handleBookmark}
                  onSuggesterClick={handleSuggesterClick}
                  showWeighted={sort === "weighted"}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {tools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  variant="default"
                  isVoted={userVotes.has(tool.id)}
                  isBookmarked={userBookmarks.has(tool.id)}
                  onVote={handleVote}
                  onBookmark={handleBookmark}
                />
              ))}
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-[var(--color-bg-card)] border border-[var(--border-default)]",
                  "text-sm text-[var(--color-text-secondary)]",
                  "hover:bg-[var(--color-bg-card-hover)] transition-colors",
                  loadingMore && "opacity-50 cursor-not-allowed"
                )}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Eligibility Modal */}
      <EligibilityModal
        isOpen={showEligibilityModal}
        onClose={() => setShowEligibilityModal(false)}
        eligibility={eligibility}
        isLoading={checkingEligibility}
      />

      {/* Profile Side Panel */}
      <ProfileSidePanel
        user={selectedUser}
        isOpen={profilePanelOpen}
        onClose={handleCloseProfilePanel}
        periodFilter="all"
        scopeFilter="global"
      />

      {/* Loading Overlay for Profile */}
      {loadingProfile && profilePanelOpen && !selectedUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
          <div className="bg-[var(--color-bg-card)] rounded-lg p-4 shadow-xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-claude-coral)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">프로필 로딩 중...</span>
          </div>
        </div>
      )}
    </div>
  );
}
