"use client";

import { memo, useState, useCallback, useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import {
  Heart,
  MessageCircle,
  Globe,
  Send,
  Share2,
  Check,
  Reply,
  Trash2,
  Loader2,
  MoreHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { TextShimmer } from "@/components/ui/TextShimmer";
import LinkPreview from "./LinkPreview";
import { getTagEmoji } from "./community-tags";
import { getFirstEmbeddableUrl } from "@/lib/url-parser";

// ===========================================
// Types
// ===========================================

export interface FeedComment {
  id: string;
  author: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    current_level?: number;
  };
  content: string;
  original_content?: string; // Original content before translation
  translated_content?: string; // Translated content
  original_language?: string; // Original language code from API (for lazy-loaded replies)
  is_translated?: boolean; // Whether this comment was translated
  created_at: string;
  parent_comment_id?: string | null;
  likes_count?: number;
  is_liked?: boolean;
  replies?: FeedComment[];
  replies_count?: number; // Total replies count (for lazy loading)
  replies_loaded?: boolean; // Whether replies have been loaded
}

export interface LikedByUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

export interface FeedPost {
  id: string;
  author: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    level: number;
    country_code?: string;
  };
  content: string;
  translated_content?: string;
  original_language: string;
  is_translated: boolean;
  tab?: string; // Board/category: general, showcase, help
  images?: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  is_liked?: boolean;
  liked_by?: LikedByUser[];
  comments?: FeedComment[];
  has_more_comments?: boolean; // True if there are more comments to load
}

interface FeedCardProps {
  post: FeedPost;
  userLanguage?: string;
  onAuthorClick?: (authorId: string) => void;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onCommentLike?: (commentId: string) => void;
  onCommentReply?: (commentId: string, parentAuthor: string) => void;
  onCommentSubmit?: (postId: string, comment: FeedComment) => void; // New: callback when comment is submitted
  onPostDelete?: (postId: string) => void; // Callback when post is deleted
  className?: string;
  // Auth props
  isSignedIn?: boolean;
  hasSubmissionHistory?: boolean;
  currentUserId?: string; // Current user's database ID for ownership check
  onLoginRequired?: (action: "like" | "comment") => void;
  onSubmissionRequired?: () => void;
  // Display options
  hideLevelBadge?: boolean; // Hide level badge for community mode (no rank display)
  variant?: "card" | "plain"; // card = bordered, plain = borderless (leaderboard style)
  isFeatured?: boolean; // Highlight style for Hall of Fame featured posts
  // Translation state (managed by parent)
  isTranslationPending?: boolean; // True when translation is being fetched via batch API
  // Translation function to get cached translations for comments/replies
  getCommentTranslation?: (id: string) => string | undefined;
}

// ===========================================
// Helper: Time Ago
// ===========================================

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ===========================================
// CommentItem Component (separated to avoid Turbopack mangling)
// ===========================================

interface CommentItemProps {
  comment: FeedComment;
  isReply?: boolean;
  isSignedIn: boolean;
  hasSubmissionHistory: boolean;
  currentUserId?: string; // For ownership check
  onAuthorClick?: (authorId: string) => void;
  onCommentLike?: (commentId: string) => void;
  onCommentReply?: (commentId: string, parentAuthor: string) => void;
  onCommentDelete?: (commentId: string) => void; // Delete callback
  onLoginRequired?: (action: "like" | "comment") => void;
  onSubmissionRequired?: () => void;
  // Translation props
  translatedContent?: string; // Cached translation from batch API
  userLanguage?: string; // User's target language
  // Shimmer effect for newly loaded comments
  isNewlyLoaded?: boolean; // Show shimmer animation for 1 cycle
}

const CommentItem = memo(function CommentItem({
  comment,
  isReply = false,
  isSignedIn,
  hasSubmissionHistory,
  currentUserId,
  onAuthorClick,
  onCommentLike,
  onCommentReply,
  onCommentDelete,
  onLoginRequired,
  onSubmissionRequired,
  translatedContent,
  userLanguage,
  isNewlyLoaded = false,
}: CommentItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Local state for likes - enables optimistic updates
  const [localLikesCount, setLocalLikesCount] = useState(comment.likes_count ?? 0);
  const [localIsLiked, setLocalIsLiked] = useState(comment.is_liked ?? false);
  const [isLiking, setIsLiking] = useState(false);
  // Translation toggle state
  const [showOriginal, setShowOriginal] = useState(false);
  // Shimmer: directly use isNewlyLoaded prop (managed by parent FeedCard)
  const showShimmer = isNewlyLoaded;
  // Use translatedContent from batch API if available, otherwise fallback to comment's own translated_content
  const effectiveTranslation = translatedContent || comment.translated_content;
  // Check translation: either has different translation text OR is_translated flag from API (for lazy-loaded replies)
  const isTranslated =
    (!!effectiveTranslation && effectiveTranslation !== comment.content) ||
    comment.is_translated === true;
  // For lazy-loaded replies: content may already be translated, original_content has the original
  const originalContent = comment.original_content || comment.content;
  const displayContent = showOriginal ? originalContent : effectiveTranslation || comment.content;
  // Language detection for display - prioritize API-provided original_language
  const originalLanguage =
    comment.original_language ||
    (comment.original_content
      ? detectCommentLanguage(comment.original_content)
      : detectCommentLanguage(comment.content));

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  // Close menu on escape
  useEffect(() => {
    if (!showMenu) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowMenu(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showMenu]);

  const authorName = comment.author.display_name || comment.author.username;
  const avatarUrl = comment.author.avatar_url;
  const hasParent = !!comment.parent_comment_id;
  const isOwner = currentUserId && comment.author.id === currentUserId;

  const handleLikeClick = useCallback(async () => {
    if (!isSignedIn) {
      onLoginRequired?.("like");
      return;
    }
    if (isLiking) return;

    // Optimistic update
    const wasLiked = localIsLiked;
    setLocalIsLiked(!wasLiked);
    setLocalLikesCount((prev) => (wasLiked ? prev - 1 : prev + 1));
    setIsLiking(true);

    try {
      const response = await fetch(`/api/community/comments/${comment.id}/like`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        // Sync with server response
        setLocalIsLiked(data.liked);
        setLocalLikesCount(data.likes_count);
        onCommentLike?.(comment.id);
      } else {
        // Rollback on error
        setLocalIsLiked(wasLiked);
        setLocalLikesCount((prev) => (wasLiked ? prev + 1 : prev - 1));
      }
    } catch (error) {
      console.error("Error liking comment:", error);
      // Rollback on error
      setLocalIsLiked(wasLiked);
      setLocalLikesCount((prev) => (wasLiked ? prev + 1 : prev - 1));
    } finally {
      setIsLiking(false);
    }
  }, [isSignedIn, isLiking, localIsLiked, onLoginRequired, onCommentLike, comment.id]);

  const handleReplyClick = useCallback(() => {
    if (!isSignedIn) {
      onLoginRequired?.("comment");
      return;
    }
    if (!hasSubmissionHistory) {
      onSubmissionRequired?.();
      return;
    }
    onCommentReply?.(comment.id, authorName);
  }, [
    isSignedIn,
    hasSubmissionHistory,
    onLoginRequired,
    onSubmissionRequired,
    onCommentReply,
    comment.id,
    authorName,
  ]);

  const handleDeleteClick = useCallback(async () => {
    if (!isOwner || isDeleting) return;

    const confirmMessage = isReply
      ? "이 답글을 삭제하시겠습니까?"
      : "이 댓글을 삭제하시겠습니까? 관련 답글도 함께 삭제됩니다.";
    if (!window.confirm(confirmMessage)) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/community/comments/${comment.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setIsDeleted(true);
        onCommentDelete?.(comment.id);
      } else {
        const error = await response.json();
        console.error("Failed to delete comment:", error);
        alert("삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }, [isOwner, isDeleting, isReply, comment.id, onCommentDelete]);

  const avatarSize = isReply ? 20 : 24;
  const textSize = isReply ? "text-[11px]" : "text-[12px]";
  const iconSize = isReply ? 9 : 10;

  // Show deleted placeholder
  if (isDeleted) {
    return (
      <div
        className={cn(
          "py-2 px-3 rounded-lg border border-dashed",
          "border-[var(--border-default)]/50 bg-[var(--color-bg-secondary)]/20",
          isReply ? "text-[10px]" : "text-[11px]",
          "text-[var(--color-text-muted)] italic"
        )}
      >
        삭제된 {isReply ? "답글" : "댓글"}입니다.
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 group/comment">
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={authorName}
          width={avatarSize}
          height={avatarSize}
          className={cn("rounded-full flex-shrink-0", isReply ? "w-5 h-5" : "w-6 h-6")}
        />
      ) : (
        <div
          className={cn(
            "rounded-full flex-shrink-0 bg-gradient-to-br from-[var(--color-claude-coral)] to-[var(--color-claude-rust)] flex items-center justify-center text-white font-semibold",
            isReply ? "w-5 h-5 text-[9px]" : "w-6 h-6 text-[10px]"
          )}
        >
          {authorName[0]?.toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <button
              onClick={() => onAuthorClick?.(comment.author.id)}
              className={cn(
                textSize,
                "font-medium text-[var(--color-text-primary)] hover:underline"
              )}
            >
              {authorName}
            </button>
            <span
              className={cn(
                isReply ? "text-[9px]" : "text-[10px]",
                "text-[var(--color-text-muted)]"
              )}
            >
              {timeAgo(comment.created_at)}
            </span>
          </div>
          {/* More menu - only visible to owner on hover */}
          {isOwner && (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setShowMenu((prev) => !prev)}
                className={cn(
                  "p-1 rounded transition-all",
                  "opacity-0 group-hover/comment:opacity-100",
                  showMenu && "opacity-100",
                  "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10"
                )}
                aria-label="더 보기"
              >
                <MoreHorizontal size={isReply ? 12 : 14} />
              </button>
              {/* Dropdown menu */}
              {showMenu && (
                <div
                  className={cn(
                    "absolute right-0 top-full mt-1 z-50",
                    "min-w-[80px] py-1",
                    "bg-[var(--color-bg-secondary)] border border-[var(--border-default)]",
                    "rounded-lg shadow-xl overflow-hidden",
                    "animate-fadeIn"
                  )}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleDeleteClick();
                    }}
                    disabled={isDeleting}
                    className={cn(
                      "w-full px-3 py-1.5 text-left flex items-center gap-2",
                      isReply ? "text-[10px]" : "text-[11px]",
                      "text-rose-400 hover:bg-rose-500/10",
                      "transition-colors",
                      isDeleting && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isDeleting ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Language indicator - show when translated (not during shimmer) */}
        {isTranslated && userLanguage && !showShimmer && (
          <div className="flex items-center gap-1 text-[9px] text-[var(--color-text-muted)] mb-0.5">
            <span className="text-[var(--color-accent-cyan)]">
              {LANGUAGE_CODES[originalLanguage] || originalLanguage.toUpperCase()}
            </span>
            <span className="opacity-40">→</span>
            <span className="opacity-60">
              {LANGUAGE_CODES[userLanguage] || userLanguage.toUpperCase()}
            </span>
          </div>
        )}
        {/* Content - show shimmer for newly loaded comments */}
        {showShimmer ? (
          <TextShimmer
            contentLength={comment.content.length}
            variant={isReply ? "compact" : "default"}
          />
        ) : (
          <p className={cn(textSize, "text-[var(--color-text-secondary)] leading-relaxed")}>
            {displayContent}
          </p>
        )}
        {/* Comment actions */}
        <div className="flex items-center gap-2 mt-0.5">
          <button
            onClick={handleLikeClick}
            disabled={isLiking}
            className={cn(
              "flex items-center gap-1 transition-colors",
              isReply ? "text-[9px]" : "text-[10px]",
              localIsLiked
                ? "text-[var(--color-accent-red)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-accent-red)]",
              isLiking && "opacity-50"
            )}
          >
            <Heart size={iconSize} fill={localIsLiked ? "currentColor" : "none"} />
            {localLikesCount > 0 && <span>{localLikesCount}</span>}
          </button>
          {/* Reply button - only for top-level comments */}
          {!isReply && !hasParent && (
            <button
              onClick={handleReplyClick}
              className={cn(
                "flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent-blue)] transition-colors",
                isReply ? "text-[9px]" : "text-[10px]"
              )}
            >
              <Reply size={iconSize} />
              <span>답글</span>
            </button>
          )}
          {/* Translation toggle - only show if comment is translated */}
          {isTranslated && (
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className={cn(
                "flex items-center gap-1 transition-colors",
                isReply ? "text-[9px]" : "text-[10px]",
                showOriginal
                  ? "text-[var(--color-accent-cyan)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-accent-cyan)]"
              )}
              title={showOriginal ? "번역 보기" : "원문 보기"}
            >
              <Globe size={iconSize} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ===========================================
// Language Name Map
// ===========================================

// Language code mappings (lowercase to uppercase for display)
const LANGUAGE_CODES: Record<string, string> = {
  en: "EN",
  ko: "KR",
  ja: "JP",
  zh: "CN",
  de: "DE",
  es: "ES",
  fr: "FR",
  pt: "PT",
};

// Simple language detection for comments
function detectCommentLanguage(text: string): string {
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja";
  if (/[\u4E00-\u9FFF]/.test(text) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "zh";
  if (/[äöüßÄÖÜ]/.test(text)) return "de";
  if (/[éèêëàâùûôîïç]/i.test(text)) return "fr";
  if (/[áéíóúüñ¿¡]/i.test(text)) return "es";
  if (/[ãõáéíóúâêôç]/i.test(text)) return "pt";
  return "en";
}

// ===========================================
// FeedCard Component
// ===========================================

function FeedCardComponent({
  post,
  userLanguage = "ko",
  onAuthorClick,
  onLike,
  onComment,
  onCommentLike,
  onCommentReply,
  onCommentSubmit,
  onPostDelete,
  className,
  isSignedIn = false,
  hasSubmissionHistory = false,
  currentUserId,
  onLoginRequired,
  onSubmissionRequired,
  hideLevelBadge = false,
  variant = "card",
  isFeatured = false,
  isTranslationPending = false,
  getCommentTranslation,
}: FeedCardProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  // Use translated_content from parent (batch translation) instead of local fetch
  const localTranslatedContent = post.translated_content;
  const [isLiked, setIsLiked] = useState(post.is_liked ?? false);
  const [likesCount, setLikesCount] = useState(post.likes_count);

  // Sync state when post props change (after API response updates parent state)
  // This fixes the bug where likes state was not syncing after page refresh
  useEffect(() => {
    setIsLiked(post.is_liked ?? false);
  }, [post.is_liked]);

  useEffect(() => {
    setLikesCount(post.likes_count);
  }, [post.likes_count]);

  const [isHovered, setIsHovered] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [shareSuccess, setShareSuccess] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [localComments, setLocalComments] = useState<FeedComment[]>(post.comments || []);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [hasMoreComments, setHasMoreComments] = useState(post.has_more_comments ?? false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Reply state
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; authorName: string } | null>(
    null
  );
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  // Replies expansion state (per comment)
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  // Shimmer state for newly loaded comments/replies (show shimmer for 1s)
  const [shimmeringComments, setShimmeringComments] = useState<Set<string>>(new Set());

  // Check if current user is the post author
  const isOwner = currentUserId && post.author.id === currentUserId;

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  // Close menu on escape
  useEffect(() => {
    if (!showMenu) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowMenu(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showMenu]);

  // Load more comments (called when "더 보기" button is clicked)
  const loadMoreComments = useCallback(async () => {
    if (commentsLoading || !hasMoreComments) return;

    // Get existing comment IDs to identify newly loaded ones
    const existingIds = new Set(localComments.map((c) => c.id));

    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/community/comments?post_id=${post.id}`);
      const data = await res.json();
      if (data.comments && data.comments.length > 0) {
        setLocalComments(data.comments);
        setHasMoreComments(false); // All comments loaded

        // Find newly loaded comments (not in existing set)
        const newCommentIds = data.comments
          .filter((c: { id: string }) => !existingIds.has(c.id))
          .map((c: { id: string }) => c.id);

        if (newCommentIds.length > 0) {
          // Add to shimmer set
          setShimmeringComments((prev) => {
            const next = new Set(prev);
            newCommentIds.forEach((id: string) => next.add(id));
            return next;
          });
          // Remove shimmer after 1s
          setTimeout(() => {
            setShimmeringComments((prev) => {
              const next = new Set(prev);
              newCommentIds.forEach((id: string) => next.delete(id));
              return next;
            });
          }, 1000);
        }
      }
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setCommentsLoading(false);
    }
  }, [commentsLoading, hasMoreComments, post.id, localComments]);

  // Load replies for a specific comment
  const loadReplies = useCallback(
    async (commentId: string) => {
      if (loadingReplies.has(commentId)) return;

      setLoadingReplies((prev) => new Set(prev).add(commentId));
      try {
        const res = await fetch(`/api/community/comments/${commentId}/replies`);
        const data = await res.json();
        if (data.replies && data.replies.length > 0) {
          // Update the comment's replies in localComments
          setLocalComments((prev) =>
            prev.map((c) =>
              c.id === commentId ? { ...c, replies: data.replies, replies_loaded: true } : c
            )
          );
          // Add reply IDs to shimmer set for 1 cycle animation
          const replyIds = data.replies.map((r: { id: string }) => r.id);
          setShimmeringComments((prev) => {
            const next = new Set(prev);
            replyIds.forEach((id: string) => next.add(id));
            return next;
          });
          // Remove shimmer after 1s (fast load feedback)
          setTimeout(() => {
            setShimmeringComments((prev) => {
              const next = new Set(prev);
              replyIds.forEach((id: string) => next.delete(id));
              return next;
            });
          }, 1000);
        } else if (data.replies) {
          // Empty replies array
          setLocalComments((prev) =>
            prev.map((c) =>
              c.id === commentId ? { ...c, replies: data.replies, replies_loaded: true } : c
            )
          );
        }
      } catch (err) {
        console.error("Failed to load replies:", err);
      } finally {
        setLoadingReplies((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
      }
    },
    [loadingReplies]
  );

  // Toggle replies visibility for a comment
  const toggleReplies = useCallback(
    (commentId: string, hasRepliesLoaded: boolean) => {
      const isExpanded = expandedReplies.has(commentId);

      if (isExpanded) {
        // Collapse
        setExpandedReplies((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
      } else {
        // Expand
        setExpandedReplies((prev) => new Set(prev).add(commentId));
        // Load replies if not already loaded
        if (!hasRepliesLoaded) {
          loadReplies(commentId);
        }
      }
    },
    [expandedReplies, loadReplies]
  );

  const displayName = post.author.display_name || post.author.username;
  const displayContent = showOriginal ? post.content : localTranslatedContent || post.content;
  const hasTranslation = !!localTranslatedContent;
  const originalLang = post.original_language || "en";
  const fromLangCode = LANGUAGE_CODES[originalLang] || originalLang.toUpperCase();
  const toLangCode = userLanguage ? LANGUAGE_CODES[userLanguage] || userLanguage.toUpperCase() : "";
  // For guests (no userLanguage), treat as "same language" to skip translation
  const isSameLanguage = !userLanguage || originalLang === userLanguage;

  // Extract embeddable URL from content
  const embeddedUrl = useMemo(() => {
    return getFirstEmbeddableUrl(post.content);
  }, [post.content]);

  // Handle like - requires login only
  const handleLike = useCallback(() => {
    if (!isSignedIn) {
      onLoginRequired?.("like");
      return;
    }
    // Trigger animation only when liking (not unliking)
    if (!isLiked) {
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 600);
    }
    setIsLiked((prev) => !prev);
    setLikesCount((prev) => (isLiked ? prev - 1 : prev + 1));
    onLike?.(post.id);
  }, [isSignedIn, isLiked, onLike, onLoginRequired, post.id]);

  // Handle comment - toggle comment section, requires login for posting
  const handleCommentClick = useCallback(() => {
    setShowComments((prev) => {
      // If opening comments section for the first time, add shimmer to existing comments
      if (!prev && localComments.length > 0) {
        const commentIds = localComments.map((c) => c.id);
        setShimmeringComments((prevSet) => {
          const next = new Set(prevSet);
          commentIds.forEach((id) => next.add(id));
          return next;
        });
        // Remove shimmer after 1s
        setTimeout(() => {
          setShimmeringComments((prevSet) => {
            const next = new Set(prevSet);
            commentIds.forEach((id) => next.delete(id));
            return next;
          });
        }, 1000);
      }
      return !prev;
    });
    onComment?.(post.id);
  }, [onComment, post.id, localComments]);

  // Handle share - Web Share API on mobile only, clipboard on desktop
  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}/community?post=${post.id}`;

    // Detect mobile device (touch + small screen)
    const isMobile = "ontouchstart" in window && window.innerWidth < 768;

    // Only use Web Share API on actual mobile devices
    if (isMobile && navigator.share) {
      const shareData = {
        title: `${displayName}'s post on CCgather`,
        text: post.content.slice(0, 100) + (post.content.length > 100 ? "..." : ""),
        url: shareUrl,
      };

      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        // User cancelled - don't fallback
        if ((error as Error).name === "AbortError") return;
        // Other error - fall through to clipboard
      }
    }

    // Desktop or mobile fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    }
  }, [post.id, post.content, displayName]);

  // Handle comment submit
  const handleCommentSubmit = useCallback(async () => {
    if (!isSignedIn) {
      onLoginRequired?.("comment");
      return;
    }
    if (!hasSubmissionHistory) {
      onSubmissionRequired?.();
      return;
    }
    if (!commentText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/community/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: post.id,
          content: commentText.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to post comment:", error);
        return;
      }

      const { comment } = await response.json();

      // Add to local comments
      const newComment: FeedComment = {
        id: comment.id,
        author: comment.author,
        content: comment.content,
        likes_count: 0,
        is_liked: false,
        created_at: comment.created_at,
        replies: [],
      };

      setLocalComments((prev) => [...prev, newComment]);
      setCommentsCount((prev) => prev + 1);
      setCommentText("");
      // Reset textarea height
      if (commentInputRef.current) {
        commentInputRef.current.style.height = "auto";
      }
      setShowComments(true);

      // Notify parent
      onCommentSubmit?.(post.id, newComment);
    } catch (error) {
      console.error("Error posting comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSignedIn,
    hasSubmissionHistory,
    commentText,
    isSubmitting,
    post.id,
    onLoginRequired,
    onSubmissionRequired,
    onCommentSubmit,
  ]);

  // Handle author click to open profile panel
  const handleAuthorClick = useCallback(() => {
    onAuthorClick?.(post.author.id);
  }, [onAuthorClick, post.author.id]);

  // Handle reply button click
  const handleReplyClick = useCallback((commentId: string, authorName: string) => {
    setReplyingTo({ commentId, authorName });
    setReplyText(""); // Don't auto-fill @mention - cleaner UX
    // Focus input after state update
    setTimeout(() => replyInputRef.current?.focus(), 50);
  }, []);

  // Handle cancel reply
  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    setReplyText("");
  }, []);

  // Handle reply submit
  const handleReplySubmit = useCallback(async () => {
    if (!replyingTo || !replyText.trim() || isSubmittingReply) return;
    if (!isSignedIn) {
      onLoginRequired?.("comment");
      return;
    }
    if (!hasSubmissionHistory) {
      onSubmissionRequired?.();
      return;
    }

    setIsSubmittingReply(true);
    try {
      const response = await fetch("/api/community/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: post.id,
          content: replyText.trim(),
          parent_comment_id: replyingTo.commentId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to post reply:", error);
        return;
      }

      const { comment } = await response.json();

      // Add reply to the parent comment's replies
      const newReply: FeedComment = {
        id: comment.id,
        author: comment.author,
        content: comment.content,
        parent_comment_id: replyingTo.commentId,
        likes_count: 0,
        is_liked: false,
        created_at: comment.created_at,
      };

      setLocalComments((prev) =>
        prev.map((c) =>
          c.id === replyingTo.commentId ? { ...c, replies: [...(c.replies || []), newReply] } : c
        )
      );
      setCommentsCount((prev) => prev + 1);
      // Reset textarea height before clearing state
      if (replyInputRef.current) {
        replyInputRef.current.style.height = "auto";
      }
      setReplyingTo(null);
      setReplyText("");
      onCommentReply?.(replyingTo.commentId, replyingTo.authorName);
    } catch (error) {
      console.error("Error posting reply:", error);
    } finally {
      setIsSubmittingReply(false);
    }
  }, [
    replyingTo,
    replyText,
    isSubmittingReply,
    isSignedIn,
    hasSubmissionHistory,
    post.id,
    onLoginRequired,
    onSubmissionRequired,
    onCommentReply,
  ]);

  // Translation is now handled at the page level via batch API
  // isTranslationPending prop indicates if translation is in progress

  // Handle translation toggle (manual) - toggles between original and translated view
  const handleTranslate = useCallback(() => {
    // If translation exists, toggle view
    if (hasTranslation) {
      setShowOriginal((prev) => !prev);
    }
    // If translating, do nothing (wait for auto-translate)
    // If no translation and not same language, auto-translate will handle it
  }, [hasTranslation]);

  // Handle post delete
  const handleDelete = useCallback(async () => {
    if (!isOwner || isDeleting) return;

    // Confirm before delete
    if (!window.confirm("이 게시물을 삭제하시겠습니까? 관련 댓글도 함께 삭제됩니다.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/community/posts/${post.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setIsDeleted(true);
        onPostDelete?.(post.id);
      } else {
        const error = await response.json();
        console.error("Failed to delete post:", error);
        alert("삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }, [isOwner, isDeleting, post.id, onPostDelete]);

  // If deleted, show placeholder
  if (isDeleted) {
    return (
      <article
        className={cn(
          "relative p-4 rounded-xl border border-dashed",
          "border-[var(--border-default)] bg-[var(--color-bg-secondary)]/30",
          "text-center text-sm text-[var(--color-text-muted)]",
          className
        )}
      >
        삭제된 게시물입니다.
      </article>
    );
  }

  return (
    <article
      data-feed-card
      className={cn(
        "relative transition-all duration-200 group min-h-[100px]",
        variant === "card" && [
          "p-3 rounded-xl border",
          "bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm",
          "border-[var(--border-default)] hover:border-[var(--border-hover)]",
          "hover:shadow-md hover:shadow-black/5",
        ],
        variant === "plain" && [
          "py-5 px-3 my-1 mx-2",
          "border-b border-[var(--border-default)]/50",
          "bg-white/[0.02] hover:bg-white/[0.05]",
          "rounded-xl",
        ],
        isFeatured && ["ring-1 ring-amber-400/30", "bg-amber-400/[0.03]"],
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* More menu (dropdown) - positioned at top-right of card */}
      {isOwner && (
        <div ref={menuRef} className="absolute top-3 right-3 z-10">
          <button
            onClick={() => setShowMenu((prev) => !prev)}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              showMenu
                ? "bg-white/10 text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10",
              "opacity-0 group-hover:opacity-100",
              showMenu && "opacity-100"
            )}
            aria-label="더 보기"
          >
            <MoreHorizontal size={16} />
          </button>
          {/* Dropdown menu */}
          {showMenu && (
            <div
              className={cn(
                "absolute right-0 top-full mt-1",
                "min-w-[100px] py-1",
                "bg-[var(--color-bg-secondary)] border border-[var(--border-default)]",
                "rounded-lg shadow-xl overflow-hidden",
                "animate-fadeIn"
              )}
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  handleDelete();
                }}
                disabled={isDeleting}
                className={cn(
                  "w-full px-3 py-2 text-left flex items-center gap-2",
                  "text-[11px] font-medium",
                  "text-rose-400 hover:bg-rose-500/10",
                  "transition-colors",
                  isDeleting && "opacity-50 cursor-not-allowed"
                )}
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Header: Author info */}
      <div className="flex items-start gap-2">
        {/* Avatar with flag overlay */}
        <button
          onClick={handleAuthorClick}
          className="flex-shrink-0 group/avatar relative"
          aria-label={`View ${displayName}'s profile`}
        >
          {post.author.avatar_url ? (
            <Image
              src={post.author.avatar_url}
              alt={displayName}
              width={32}
              height={32}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-all duration-200",
                "border-[var(--border-default)] group-hover:border-[var(--color-claude-coral)]",
                "group-hover:shadow-md group-hover:shadow-[var(--color-claude-coral)]/20"
              )}
            />
          ) : (
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200",
                "bg-gradient-to-br from-[var(--color-claude-coral)] to-[var(--color-claude-rust)]",
                "text-white font-semibold text-xs",
                "group-hover:shadow-md group-hover:shadow-[var(--color-claude-coral)]/30"
              )}
            >
              {displayName[0]?.toUpperCase() || "?"}
            </div>
          )}
          {/* Country flag badge */}
          {post.author.country_code && (
            <div className="absolute -bottom-0.5 -right-0.5 rounded-sm overflow-hidden shadow-sm border border-[var(--color-bg-primary)]">
              <FlagIcon countryCode={post.author.country_code} size="xs" />
            </div>
          )}
        </button>

        {/* Author details + content */}
        <div className="flex-1 min-w-0">
          {/* Author row: 田中太郎 [Lv.5] · 2h */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Author name */}
            <button
              onClick={handleAuthorClick}
              className="font-semibold text-[13px] text-[var(--color-text-primary)] hover:underline"
            >
              {displayName}
            </button>

            {/* Board emoji badge */}
            <span className="text-[12px] opacity-80" title={post.tab || "general"}>
              {getTagEmoji(post.tab)}
            </span>

            {/* Level badge - compact (hidden in community mode) */}
            {!hideLevelBadge && (
              <span
                className={cn(
                  "px-1 py-0.5 text-[9px] font-semibold rounded transition-colors",
                  post.author.level >= 6
                    ? "level-badge-6"
                    : post.author.level >= 5
                      ? "level-badge-5"
                      : "bg-[var(--color-claude-coral)]/10 text-[var(--color-claude-coral)]"
                )}
              >
                Lv.{post.author.level}
              </span>
            )}

            {/* Timestamp */}
            <span className="text-[11px] text-[var(--color-text-muted)]">
              · {timeAgo(post.created_at)}
            </span>
          </div>

          {/* Language indicator - always shown with simple codes (e.g., EN→KR, KR→KR) */}
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-[var(--color-text-muted)]">
            <span className={isSameLanguage ? "opacity-60" : "text-[var(--color-accent-cyan)]"}>
              {fromLangCode}
            </span>
            <span className="opacity-40">→</span>
            <span className="opacity-60">{toLangCode}</span>
          </div>

          {/* Content - Show shimmer when translation is pending */}
          {isTranslationPending && !isSameLanguage ? (
            <div className="mt-1.5">
              <TextShimmer contentLength={post.content.length} variant="default" />
            </div>
          ) : (
            <p
              className={cn(
                "mt-1.5 text-[13px] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap break-words",
                "transition-opacity duration-300 animate-fadeIn"
              )}
            >
              {displayContent}
            </p>
          )}

          {/* Images (if any) */}
          {post.images && post.images.length > 0 && (
            <div
              className={cn(
                "mt-2 grid gap-1.5 rounded-lg overflow-hidden",
                post.images.length === 1
                  ? "grid-cols-1"
                  : post.images.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-2"
              )}
            >
              {post.images.slice(0, 4).map((img, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "relative aspect-video bg-[var(--color-bg-card)] rounded-lg overflow-hidden",
                    post.images!.length === 3 && idx === 0 && "row-span-2 aspect-square"
                  )}
                >
                  <Image src={img} alt="" fill className="object-cover" sizes="300px" />
                </div>
              ))}
            </div>
          )}

          {/* Link Preview (YouTube, Twitter/X, GitHub, etc.) */}
          {embeddedUrl && (
            <div className="mt-2">
              <LinkPreview parsedUrl={embeddedUrl} />
            </div>
          )}

          {/* Footer: Actions + Translation toggle (on hover) */}
          <div className="flex items-center justify-between mt-2">
            {/* Translation toggle - shown on hover or when viewing original */}
            <div className="h-6 flex items-center">
              {!isSameLanguage && (isHovered || showOriginal || isTranslationPending) && (
                <button
                  onClick={handleTranslate}
                  disabled={isTranslationPending}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-all",
                    "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
                    "hover:bg-[var(--glass-bg)]",
                    "animate-fadeIn",
                    isTranslationPending && "opacity-70 cursor-wait"
                  )}
                >
                  {isTranslationPending ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <Globe size={10} />
                  )}
                  <span>
                    {isTranslationPending
                      ? "번역 중..."
                      : showOriginal
                        ? "번역 보기"
                        : hasTranslation
                          ? `원문 (${fromLangCode})`
                          : `번역 (${toLangCode})`}
                  </span>
                </button>
              )}
            </div>

            {/* Action buttons - compact */}
            <div className="flex items-center gap-1">
              {/* Liked by avatars - clickable with tooltip */}
              {likesCount > 0 && post.liked_by && post.liked_by.length > 0 && (
                <div className="flex items-center -space-x-2 mr-1">
                  {post.liked_by.slice(0, 3).map((user) => (
                    <button
                      key={user.id}
                      onClick={() => onAuthorClick?.(user.id)}
                      className="relative group/liker"
                      title={user.display_name || user.username}
                    >
                      <Image
                        src={user.avatar_url || ""}
                        alt={user.display_name || user.username}
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-full border-2 border-[var(--color-bg-primary)] hover:border-[var(--color-claude-coral)] transition-colors"
                      />
                      {/* Tooltip - only show on avatar hover */}
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 text-[10px] bg-black/90 text-white rounded whitespace-nowrap opacity-0 group-hover/liker:opacity-100 transition-opacity pointer-events-none z-10">
                        {user.display_name || user.username}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Like button with animation */}
              <button
                onClick={handleLike}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[11px] transition-all active:scale-95",
                  isLiked
                    ? "text-[var(--color-accent-red)] bg-[var(--color-accent-red)]/10"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-accent-red)] hover:bg-[var(--color-accent-red)]/10"
                )}
                aria-label={isLiked ? "Unlike" : "Like"}
              >
                <span className={cn("relative", likeAnimating && "animate-like-pop")}>
                  <Heart size={12} fill={isLiked ? "currentColor" : "none"} />
                  {/* Burst particles */}
                  {likeAnimating && (
                    <>
                      <span className="absolute inset-0 animate-like-ring rounded-full border-2 border-[var(--color-accent-red)]" />
                      <span className="absolute -top-1 left-1/2 w-1 h-1 rounded-full bg-[var(--color-accent-red)] animate-like-particle-1" />
                      <span className="absolute top-0 -right-1 w-1 h-1 rounded-full bg-[var(--color-accent-red)] animate-like-particle-2" />
                      <span className="absolute -bottom-1 left-1/2 w-1 h-1 rounded-full bg-[var(--color-accent-red)] animate-like-particle-3" />
                      <span className="absolute top-0 -left-1 w-1 h-1 rounded-full bg-[var(--color-accent-red)] animate-like-particle-4" />
                    </>
                  )}
                </span>
                <span className="tabular-nums">{likesCount}</span>
              </button>

              {/* Share button */}
              <button
                onClick={handleShare}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[11px] transition-all",
                  shareSuccess
                    ? "text-[var(--color-accent-green)] bg-[var(--color-accent-green)]/10"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10"
                )}
                aria-label="Share"
              >
                {shareSuccess ? <Check size={12} /> : <Share2 size={12} />}
              </button>

              {/* Comment button */}
              <button
                onClick={handleCommentClick}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[11px] transition-colors",
                  showComments
                    ? "text-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]/10"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-accent-blue)] hover:bg-[var(--color-accent-blue)]/10"
                )}
                aria-label="Comments"
              >
                <MessageCircle size={12} />
                <span className="tabular-nums">{commentsCount}</span>
              </button>
            </div>
          </div>

          {/* Comments Section - Expandable */}
          {showComments && (
            <div className="mt-3 pt-3 border-t border-[var(--border-default)]/50 animate-fadeIn">
              {/* Comments List - Using CommentItem to avoid Turbopack variable mangling */}
              {commentsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-[var(--color-text-muted)]" />
                </div>
              ) : localComments && localComments.length > 0 ? (
                <div className="space-y-3 mb-3">
                  {localComments.map((comment) => {
                    const repliesCount = comment.replies_count || comment.replies?.length || 0;
                    const hasReplies =
                      repliesCount > 0 || (comment.replies && comment.replies.length > 0);
                    const isExpanded = expandedReplies.has(comment.id);
                    const isLoading = loadingReplies.has(comment.id);
                    const hasRepliesLoaded =
                      comment.replies_loaded || (comment.replies && comment.replies.length > 0);

                    return (
                      <div key={comment.id} className="relative">
                        {/* Top-level comment */}
                        <CommentItem
                          comment={comment}
                          isSignedIn={isSignedIn}
                          hasSubmissionHistory={hasSubmissionHistory}
                          currentUserId={currentUserId}
                          onAuthorClick={onAuthorClick}
                          onCommentLike={onCommentLike}
                          onCommentReply={handleReplyClick}
                          onLoginRequired={onLoginRequired}
                          onSubmissionRequired={onSubmissionRequired}
                          translatedContent={getCommentTranslation?.(comment.id)}
                          userLanguage={userLanguage}
                          isNewlyLoaded={shimmeringComments.has(comment.id)}
                        />

                        {/* Reply Input - show when replying to this comment */}
                        {replyingTo?.commentId === comment.id && (
                          <div className="ml-8 mt-2 animate-fadeIn">
                            <div className="flex items-start gap-2">
                              <textarea
                                ref={replyInputRef}
                                value={replyText}
                                onChange={(e) => {
                                  setReplyText(e.target.value);
                                  // Auto-resize textarea
                                  e.target.style.height = "auto";
                                  e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                                }}
                                onKeyDown={(e) => {
                                  // Enter만 누르면 제출, Shift+Enter는 줄바꿈
                                  if (
                                    e.key === "Enter" &&
                                    !e.shiftKey &&
                                    !e.nativeEvent.isComposing
                                  ) {
                                    e.preventDefault();
                                    handleReplySubmit();
                                  } else if (e.key === "Escape") {
                                    handleCancelReply();
                                  }
                                }}
                                disabled={isSubmittingReply}
                                placeholder={`${replyingTo.authorName}님에게 답글 작성... (Shift+Enter for new line)`}
                                rows={1}
                                className={cn(
                                  "flex-1 px-3 py-1.5 text-[11px] rounded-lg",
                                  "bg-[var(--color-bg-card)] border border-[var(--color-claude-coral)]/50",
                                  "placeholder:text-[var(--color-text-muted)]",
                                  "focus:outline-none focus:border-[var(--color-claude-coral)]",
                                  "text-[var(--color-text-primary)]",
                                  "resize-none overflow-hidden min-h-[28px] max-h-[100px]"
                                )}
                              />
                              <button
                                onClick={handleCancelReply}
                                className="p-1.5 mt-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                                aria-label="취소"
                              >
                                <X size={14} />
                              </button>
                              <button
                                onClick={handleReplySubmit}
                                disabled={!replyText.trim() || isSubmittingReply}
                                className={cn(
                                  "p-1.5 mt-0.5 transition-colors rounded-lg",
                                  "text-[var(--color-text-muted)]",
                                  "hover:text-[var(--color-claude-coral)] hover:bg-[var(--color-claude-coral)]/10",
                                  "disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                                aria-label="답글 보내기"
                              >
                                {isSubmittingReply ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Send size={14} />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Replies Toggle & List */}
                        {hasReplies && (
                          <>
                            {/* Replies toggle button */}
                            <button
                              onClick={() => toggleReplies(comment.id, !!hasRepliesLoaded)}
                              className={cn(
                                "ml-8 flex items-center gap-2 py-2 text-[10px] transition-colors",
                                "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                              )}
                            >
                              <span className="w-6 h-px bg-[var(--color-text-muted)]/30" />
                              {isLoading ? (
                                <span className="flex items-center gap-1">
                                  <Loader2 size={10} className="animate-spin" />
                                  로딩 중...
                                </span>
                              ) : isExpanded ? (
                                <span>답글 숨기기</span>
                              ) : (
                                <span>답글 {repliesCount}개 보기</span>
                              )}
                              <span className="w-6 h-px bg-[var(--color-text-muted)]/30" />
                            </button>

                            {/* Replies list with tree branch connectors */}
                            {isExpanded && comment.replies && comment.replies.length > 0 && (
                              <div className="ml-4 mt-1 pl-4 animate-fadeIn">
                                {comment.replies.map((reply, index) => {
                                  const isLast = index === comment.replies!.length - 1;
                                  return (
                                    <div key={reply.id} className="relative">
                                      {/* Vertical line - from top to branch point, continues down if not last */}
                                      <div
                                        className="absolute w-px bg-[var(--color-text-muted)]/30"
                                        style={{
                                          left: -16,
                                          top: 0,
                                          height: isLast ? 12 : "100%",
                                        }}
                                      />
                                      {/* Horizontal branch line (└ shape) */}
                                      <div
                                        className="absolute h-px bg-[var(--color-text-muted)]/30"
                                        style={{
                                          left: -16,
                                          top: 12,
                                          width: 12,
                                        }}
                                      />

                                      {/* Reply content */}
                                      <div className="py-1">
                                        <CommentItem
                                          comment={reply}
                                          isReply={true}
                                          isSignedIn={isSignedIn}
                                          hasSubmissionHistory={hasSubmissionHistory}
                                          currentUserId={currentUserId}
                                          onAuthorClick={onAuthorClick}
                                          onCommentLike={onCommentLike}
                                          onLoginRequired={onLoginRequired}
                                          translatedContent={getCommentTranslation?.(reply.id)}
                                          userLanguage={userLanguage}
                                          isNewlyLoaded={shimmeringComments.has(reply.id)}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--color-text-muted)] mb-3">
                  No comments yet. Be the first to comment!
                </p>
              )}

              {/* Load More Comments Button - Text link style */}
              {hasMoreComments && (
                <button
                  onClick={loadMoreComments}
                  disabled={commentsLoading}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-2 mb-3",
                    "text-[10px] transition-colors",
                    "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
                    commentsLoading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className="w-8 h-px bg-[var(--color-text-muted)]/30" />
                  {commentsLoading ? (
                    <span className="flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" />
                      로딩 중...
                    </span>
                  ) : (
                    <span>이전 댓글 보기</span>
                  )}
                  <span className="w-8 h-px bg-[var(--color-text-muted)]/30" />
                </button>
              )}

              {/* Comment Input */}
              <div className="flex items-start gap-2">
                <div
                  className={cn(
                    "flex-1 relative",
                    (!isSignedIn || !hasSubmissionHistory) && "cursor-pointer"
                  )}
                  onClick={() => {
                    if (!isSignedIn) {
                      onLoginRequired?.("comment");
                    } else if (!hasSubmissionHistory) {
                      onSubmissionRequired?.();
                    }
                  }}
                >
                  <textarea
                    ref={commentInputRef}
                    value={commentText}
                    onChange={(e) => {
                      setCommentText(e.target.value);
                      // Auto-resize textarea
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => {
                      // Enter만 누르면 제출, Shift+Enter는 줄바꿈
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleCommentSubmit();
                      }
                    }}
                    disabled={!isSignedIn || !hasSubmissionHistory || isSubmitting}
                    placeholder={
                      !isSignedIn
                        ? "Sign in to comment"
                        : !hasSubmissionHistory
                          ? "Submit data to comment"
                          : "Write a comment... (Shift+Enter for new line)"
                    }
                    rows={1}
                    className={cn(
                      "w-full px-3 py-1.5 text-[12px] rounded-lg",
                      "bg-[var(--color-bg-card)] border border-[var(--border-default)]",
                      "placeholder:text-[var(--color-text-muted)]",
                      "focus:outline-none focus:border-[var(--color-claude-coral)]",
                      "text-[var(--color-text-primary)]",
                      "resize-none overflow-hidden min-h-[32px] max-h-[120px]",
                      (!isSignedIn || !hasSubmissionHistory) && "pointer-events-none"
                    )}
                  />
                </div>
                <button
                  onClick={handleCommentSubmit}
                  disabled={
                    !isSignedIn || !hasSubmissionHistory || !commentText.trim() || isSubmitting
                  }
                  className={cn(
                    "p-1.5 transition-colors rounded-lg mt-0.5",
                    "text-[var(--color-text-muted)]",
                    "hover:text-[var(--color-claude-coral)] hover:bg-[var(--color-claude-coral)]/10",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  aria-label="Send comment"
                >
                  {isSubmitting ? (
                    <div className="w-[14px] h-[14px] border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// Export memoized component
const FeedCard = memo(FeedCardComponent);
export default FeedCard;
