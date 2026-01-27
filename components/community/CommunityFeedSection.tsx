"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { Virtuoso } from "react-virtuoso";
import { X, Globe, Star, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { getCountryName } from "@/lib/constants/countries";
import FeedCard, { type FeedPost } from "./FeedCard";
import PostComposer from "./PostComposer";
import type { CommunityFilterTag } from "./CommunityFilter";

// ===========================================
// Types
// ===========================================

interface CommunityFeedSectionProps {
  posts: FeedPost[];
  currentTab: CommunityFilterTag;
  onAuthorClick: (authorId: string) => void;
  // User state
  isSignedIn: boolean;
  hasSubmissionHistory: boolean;
  canPost: boolean;
  userAvatar?: string | null;
  userName?: string | null;
  userLevel?: number;
  // Loading state
  isLoading?: boolean;
  // Modal control (from page level)
  isPostModalOpen?: boolean;
  onPostModalClose?: () => void;
  // Callbacks
  onPost?: (content: string, tab: CommunityFilterTag) => void;
  onLike?: (postId: string) => void;
  onLoginRequired?: (action: "like" | "comment") => void;
  onSubmissionRequired?: () => void;
  // Display options
  variant?: "card" | "plain";
  className?: string;
  // Featured post (from Hall of Fame)
  featuredPostId?: string | null;
  onClearFeatured?: () => void;
  // Author filter (for showing only one user's posts)
  authorFilter?: string | null;
  authorFilterInfo?: { username: string; displayName?: string | null } | null;
  onClearAuthorFilter?: () => void;
  // Country filter (for showing only posts from user's country)
  countryFilter?: "global" | "country";
  userCountryCode?: string | null;
}

// ===========================================
// Loading Skeleton
// ===========================================

function FeedSkeleton({ variant = "card" }: { variant?: "card" | "plain" }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse",
            variant === "card"
              ? "p-4 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--border-default)]"
              : "py-4 border-b border-[var(--border-default)]/50"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-bg-card)]" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 rounded bg-[var(--color-bg-card)]" />
                <div className="h-3 w-10 rounded bg-[var(--color-bg-card)]" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-[var(--color-bg-card)]" />
                <div className="h-4 w-3/4 rounded bg-[var(--color-bg-card)]" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===========================================
// CommunityFeedSection Component
// ===========================================

function CommunityFeedSectionComponent({
  posts,
  currentTab,
  onAuthorClick,
  isSignedIn,
  hasSubmissionHistory,
  canPost: _canPost,
  userAvatar,
  userName,
  userLevel,
  isLoading = false,
  isPostModalOpen = false,
  onPostModalClose,
  onPost,
  onLike,
  onLoginRequired,
  onSubmissionRequired,
  variant = "plain",
  className,
  featuredPostId,
  onClearFeatured,
  authorFilter,
  authorFilterInfo,
  onClearAuthorFilter,
  countryFilter = "global",
  userCountryCode,
}: CommunityFeedSectionProps) {
  const feedContainerRef = useRef<HTMLDivElement>(null);

  // Find featured post
  const featuredPost = featuredPostId ? posts.find((p) => p.id === featuredPostId) : null;

  // Handle post submission from modal
  const handlePostSubmit = useCallback(
    (content: string, tab: CommunityFilterTag) => {
      onPost?.(content, tab);
      onPostModalClose?.();
    },
    [onPost, onPostModalClose]
  );

  const handleLike = useCallback(
    (postId: string) => {
      onLike?.(postId);
    },
    [onLike]
  );

  const handleComment = useCallback((postId: string) => {
    // TODO: Navigate to post detail or open comment modal
    console.log("Comment on post:", postId);
  }, []);

  // ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPostModalOpen) {
        onPostModalClose?.();
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isPostModalOpen, onPostModalClose]);

  // Filter posts by author and/or country
  const filteredPosts = posts.filter((post) => {
    // Author filter takes priority
    if (authorFilter) {
      return post.author.id === authorFilter;
    }
    // Country filter: show only posts from user's country
    if (countryFilter === "country" && userCountryCode) {
      return post.author.country_code === userCountryCode;
    }
    return true;
  });

  return (
    <div className={cn("flex flex-col", className)} style={{ height: "calc(100vh - 220px)" }}>
      {/* Leaderboard-style container - matches glass style */}
      <div className="glass !border-0 rounded-t-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
        {/* Auto-translate Banner */}
        <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-[var(--color-accent-cyan)]" />
            <span className="text-xs font-medium text-[var(--color-accent-cyan)]">
              Auto-translate
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Posts appear in your language
            </span>
          </div>
        </div>

        {/* Country Filter Header */}
        {countryFilter === "country" && userCountryCode && !authorFilter && (
          <div className="flex-shrink-0 px-4 py-2.5 border-b border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center gap-2">
              <FlagIcon countryCode={userCountryCode} size="xs" />
              <span className="text-xs font-medium text-emerald-400">
                {getCountryName(userCountryCode)}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                ({filteredPosts.length} posts)
              </span>
            </div>
          </div>
        )}

        {/* Author Filter Header */}
        {authorFilter && authorFilterInfo && (
          <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--color-claude-coral)]/20 bg-[var(--color-claude-coral)]/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">📰</span>
                <span className="text-xs font-medium text-[var(--color-text-primary)]">
                  Posts by @{authorFilterInfo.username}
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  ({filteredPosts.length} posts)
                </span>
              </div>
              <button
                onClick={onClearAuthorFilter}
                className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors px-2 py-1 rounded-md hover:bg-white/10"
              >
                <ChevronUp size={12} className="rotate-90" />
                <span>Back to all</span>
              </button>
            </div>
          </div>
        )}

        {/* Featured Post - From Hall of Fame */}
        {featuredPost && (
          <div className="flex-shrink-0 border-b border-amber-400/20">
            {/* Featured header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-amber-400/10 to-transparent">
              <div className="flex items-center gap-2">
                <Star size={12} className="text-amber-400 fill-amber-400" />
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                  Featured Post
                </span>
              </div>
              <button
                onClick={onClearFeatured}
                className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <ChevronUp size={12} />
                <span>Back to feed</span>
              </button>
            </div>
            {/* Featured post card with highlight */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-b from-amber-400/5 to-transparent pointer-events-none" />
              <FeedCard
                post={featuredPost}
                userLanguage="ko"
                onAuthorClick={onAuthorClick}
                onLike={handleLike}
                onComment={handleComment}
                isSignedIn={isSignedIn}
                hasSubmissionHistory={hasSubmissionHistory}
                onLoginRequired={onLoginRequired}
                onSubmissionRequired={onSubmissionRequired}
                hideLevelBadge={true}
                variant={variant}
                isFeatured={true}
              />
            </div>
          </div>
        )}

        {/* Feed Content - Virtualized Scrollable */}
        <div ref={feedContainerRef} className="flex-1 min-h-0">
          {/* Skeleton only when loading AND no previous data */}
          {isLoading && filteredPosts.length === 0 ? (
            <div className="px-4 overflow-y-auto h-full scrollbar-hide">
              <FeedSkeleton variant={variant} />
            </div>
          ) : !isLoading && filteredPosts.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="text-4xl">📭</span>
              <p className="text-sm text-[var(--color-text-muted)]">No posts yet</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Be the first to share something!
              </p>
            </div>
          ) : (
            /* Virtualized feed - only renders visible posts */
            /* Shows with reduced opacity when loading new data (stale-while-revalidate) */
            <div
              className={`relative h-full transition-opacity duration-300 ${isLoading ? "opacity-60" : "opacity-100"}`}
            >
              {isLoading && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)]/90 backdrop-blur-sm border border-[var(--border-default)]">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] text-[var(--color-text-muted)]">Updating...</span>
                  </div>
                </div>
              )}
              <Virtuoso
                data={filteredPosts}
                style={{ height: "100%" }}
                overscan={200}
                className="scrollbar-hide h-full"
                itemContent={(_index, post) => (
                  <FeedCard
                    key={post.id}
                    post={post}
                    userLanguage="ko"
                    onAuthorClick={onAuthorClick}
                    onLike={handleLike}
                    onComment={handleComment}
                    isSignedIn={isSignedIn}
                    hasSubmissionHistory={hasSubmissionHistory}
                    onLoginRequired={onLoginRequired}
                    onSubmissionRequired={onSubmissionRequired}
                    hideLevelBadge={true}
                    variant={variant}
                  />
                )}
              />
            </div>
          )}
        </div>
      </div>

      {/* Post Modal */}
      {isPostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onPostModalClose}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg glass rounded-2xl p-4 animate-fadeIn">
            {/* Close button */}
            <button
              onClick={onPostModalClose}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Modal header */}
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
              Create Post
            </h3>

            {/* Post Composer */}
            <PostComposer
              currentTab={currentTab}
              userAvatar={userAvatar || undefined}
              userName={userName || "User"}
              userLevel={userLevel || 1}
              onPost={handlePostSubmit}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Export memoized component
const CommunityFeedSection = memo(CommunityFeedSectionComponent);
export default CommunityFeedSection;
