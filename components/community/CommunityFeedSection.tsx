"use client";

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
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
  currentUserId?: string | null; // For delete button visibility
  userAvatar?: string | null;
  userName?: string | null;
  userLevel?: number;
  userLanguage?: string | null; // User's preferred language for translation (null = show original)
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
  // Infinite scroll
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  // Auto-translate (batch translation)
  // null = settings not loaded yet (show loading state)
  autoTranslateEnabled?: boolean | null;
  onAutoTranslateToggle?: (enabled: boolean) => void;
  isTranslationLoading?: boolean;
  pendingTranslationIds?: Set<string>; // Post IDs that are awaiting translation
}

// ===========================================
// Loading Skeleton
// ===========================================

function FeedSkeleton({ variant = "card" }: { variant?: "card" | "plain" }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse min-h-[100px]",
            variant === "card"
              ? "p-3 rounded-xl bg-[var(--color-bg-secondary)]/50 border border-[var(--border-default)]"
              : "py-5 px-3 border-b border-[var(--border-default)]/50"
          )}
        >
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--color-bg-card)] flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-20 rounded bg-[var(--color-bg-card)]" />
                <div className="h-3 w-8 rounded bg-[var(--color-bg-card)]" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-[var(--color-bg-card)]" />
                <div className="h-4 w-2/3 rounded bg-[var(--color-bg-card)]" />
              </div>
              <div className="flex items-center gap-4 pt-2">
                <div className="h-3 w-12 rounded bg-[var(--color-bg-card)]" />
                <div className="h-3 w-12 rounded bg-[var(--color-bg-card)]" />
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
  currentUserId,
  userAvatar,
  userName,
  userLevel,
  userLanguage,
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
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  autoTranslateEnabled = null, // null = not loaded yet
  onAutoTranslateToggle,
  isTranslationLoading = false,
  pendingTranslationIds,
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

  const handleComment = useCallback((_postId: string) => {
    // Comment section is toggled inline in FeedCard
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

  // Filter posts by author and/or country - memoized to prevent infinite loop
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
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
  }, [posts, authorFilter, countryFilter, userCountryCode]);

  // Memoize endReached callback for Virtuoso
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Memoize Virtuoso components to prevent re-creation
  const virtuosoComponents = useMemo(
    () => ({
      Footer: () =>
        isLoadingMore ? (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[var(--color-text-muted)]">Loading more...</span>
            </div>
          </div>
        ) : !hasMore && filteredPosts.length > 0 ? (
          <div className="flex justify-center py-4">
            <span className="text-xs text-[var(--color-text-muted)]">No more posts</span>
          </div>
        ) : null,
    }),
    [isLoadingMore, hasMore, filteredPosts.length]
  );

  // Store pendingTranslationIds in ref to avoid itemContent re-creation
  const pendingTranslationIdsRef = useRef(pendingTranslationIds);
  pendingTranslationIdsRef.current = pendingTranslationIds;

  // Memoize itemContent callback to prevent Virtuoso re-renders
  const renderItem = useCallback(
    (_index: number, post: FeedPost) => (
      <FeedCard
        key={post.id}
        post={post}
        userLanguage={userLanguage || undefined}
        onAuthorClick={onAuthorClick}
        onLike={handleLike}
        onComment={handleComment}
        isSignedIn={isSignedIn}
        hasSubmissionHistory={hasSubmissionHistory}
        onLoginRequired={onLoginRequired}
        onSubmissionRequired={onSubmissionRequired}
        hideLevelBadge={true}
        variant={variant}
        currentUserId={currentUserId || undefined}
        isTranslationPending={
          autoTranslateEnabled === true && (pendingTranslationIdsRef.current?.has(post.id) || false)
        }
      />
    ),
    [
      userLanguage,
      onAuthorClick,
      handleLike,
      handleComment,
      isSignedIn,
      hasSubmissionHistory,
      onLoginRequired,
      onSubmissionRequired,
      variant,
      currentUserId,
      autoTranslateEnabled,
    ]
  );

  return (
    <div className={cn("flex flex-col", className)} style={{ height: "calc(100vh - 220px)" }}>
      {/* Leaderboard-style container - matches glass style */}
      <div className="glass !border-0 rounded-t-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
        {/* Auto-translate Banner with Toggle */}
        <div
          className={cn(
            "flex-shrink-0 px-4 py-2.5 border-b border-white/[0.06] relative overflow-hidden",
            isTranslationLoading && autoTranslateEnabled === true && "translate-banner-shimmer"
          )}
        >
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <Globe
                size={14}
                className={
                  autoTranslateEnabled === true
                    ? "text-[var(--color-accent-cyan)]"
                    : "text-[var(--color-text-muted)]"
                }
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  autoTranslateEnabled === true
                    ? "text-[var(--color-accent-cyan)]"
                    : "text-[var(--color-text-muted)]"
                )}
              >
                {isTranslationLoading && autoTranslateEnabled === true
                  ? "Translating..."
                  : "Auto-translate"}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {autoTranslateEnabled === null
                  ? "Loading preferences..."
                  : isTranslationLoading && autoTranslateEnabled
                    ? "Processing multiple languages"
                    : autoTranslateEnabled
                      ? "Posts appear in your language"
                      : "Showing original posts"}
              </span>
            </div>
            {/* Toggle Switch - disabled until settings loaded */}
            {isSignedIn && onAutoTranslateToggle && (
              <button
                role="switch"
                aria-checked={autoTranslateEnabled === true}
                onClick={() =>
                  autoTranslateEnabled !== null && onAutoTranslateToggle(!autoTranslateEnabled)
                }
                disabled={autoTranslateEnabled === null}
                className={cn(
                  "relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0",
                  autoTranslateEnabled === null && "opacity-50 cursor-not-allowed",
                  autoTranslateEnabled === true
                    ? "bg-[var(--color-accent-cyan)]"
                    : "bg-[var(--color-bg-card)] border border-white/10"
                )}
                aria-label={
                  autoTranslateEnabled === true ? "Disable auto-translate" : "Enable auto-translate"
                }
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                    autoTranslateEnabled === true && "translate-x-4"
                  )}
                />
              </button>
            )}
          </div>
          {/* Community intro for guests */}
          <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)]/70 leading-relaxed">
            Connect with Claude Code developers worldwide. No language barriers!
          </p>
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
                userLanguage={userLanguage || undefined}
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
                currentUserId={currentUserId || undefined}
                isTranslationPending={
                  autoTranslateEnabled === true &&
                  (pendingTranslationIds?.has(featuredPost.id) || false)
                }
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
                endReached={handleEndReached}
                itemContent={renderItem}
                components={virtuosoComponents}
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
