"use client";

import { memo, useState, useCallback, useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import { Heart, MessageCircle, Globe, Send, Share2, Check, Reply } from "lucide-react";
import { cn } from "@/lib/utils";
import { FlagIcon } from "@/components/ui/FlagIcon";
import LinkPreview from "./LinkPreview";
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
  created_at: string;
  parent_comment_id?: string | null;
  likes_count?: number;
  is_liked?: boolean;
  replies?: FeedComment[];
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
  images?: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  is_liked?: boolean;
  // Mock data for UI
  liked_by?: LikedByUser[];
  comments?: FeedComment[];
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
  className?: string;
  // Auth props
  isSignedIn?: boolean;
  hasSubmissionHistory?: boolean;
  onLoginRequired?: (action: "like" | "comment") => void;
  onSubmissionRequired?: () => void;
  // Display options
  hideLevelBadge?: boolean; // Hide level badge for community mode (no rank display)
  variant?: "card" | "plain"; // card = bordered, plain = borderless (leaderboard style)
  isFeatured?: boolean; // Highlight style for Hall of Fame featured posts
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
  onAuthorClick?: (authorId: string) => void;
  onCommentLike?: (commentId: string) => void;
  onCommentReply?: (commentId: string, parentAuthor: string) => void;
  onLoginRequired?: (action: "like" | "comment") => void;
  onSubmissionRequired?: () => void;
}

const CommentItem = memo(function CommentItem({
  comment,
  isReply = false,
  isSignedIn,
  hasSubmissionHistory,
  onAuthorClick,
  onCommentLike,
  onCommentReply,
  onLoginRequired,
  onSubmissionRequired,
}: CommentItemProps) {
  const authorName = comment.author.display_name || comment.author.username;
  const avatarUrl = comment.author.avatar_url;
  const likesCount = comment.likes_count ?? 0;
  const isLiked = comment.is_liked ?? false;
  const hasParent = !!comment.parent_comment_id;

  const handleLikeClick = useCallback(() => {
    if (!isSignedIn) {
      onLoginRequired?.("like");
      return;
    }
    onCommentLike?.(comment.id);
  }, [isSignedIn, onLoginRequired, onCommentLike, comment.id]);

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

  const avatarSize = isReply ? 20 : 24;
  const textSize = isReply ? "text-[11px]" : "text-[12px]";
  const iconSize = isReply ? 9 : 10;

  return (
    <div className="flex items-start gap-2">
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
        <div className="flex items-baseline gap-1.5">
          <button
            onClick={() => onAuthorClick?.(comment.author.id)}
            className={cn(textSize, "font-medium text-[var(--color-text-primary)] hover:underline")}
          >
            {authorName}
          </button>
          <span
            className={cn(isReply ? "text-[9px]" : "text-[10px]", "text-[var(--color-text-muted)]")}
          >
            {timeAgo(comment.created_at)}
          </span>
        </div>
        <p className={cn(textSize, "text-[var(--color-text-secondary)] leading-relaxed")}>
          {comment.content}
        </p>
        {/* Comment actions */}
        <div className="flex items-center gap-2 mt-0.5">
          <button
            onClick={handleLikeClick}
            className={cn(
              "flex items-center gap-1 transition-colors",
              isReply ? "text-[9px]" : "text-[10px]",
              isLiked
                ? "text-[var(--color-accent-red)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-accent-red)]"
            )}
          >
            <Heart size={iconSize} fill={isLiked ? "currentColor" : "none"} />
            {likesCount > 0 && <span>{likesCount}</span>}
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
  className,
  isSignedIn = false,
  hasSubmissionHistory = false,
  onLoginRequired,
  onSubmissionRequired,
  hideLevelBadge = false,
  variant = "card",
  isFeatured = false,
}: FeedCardProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [isLiked, setIsLiked] = useState(post.is_liked ?? false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [isHovered, setIsHovered] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [shareSuccess, setShareSuccess] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localComments, setLocalComments] = useState<FeedComment[]>(post.comments || []);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);

  const displayName = post.author.display_name || post.author.username;
  const displayContent = showOriginal ? post.content : post.translated_content || post.content;
  const fromLangCode =
    LANGUAGE_CODES[post.original_language] || post.original_language.toUpperCase();
  const toLangCode = LANGUAGE_CODES[userLanguage] || userLanguage.toUpperCase();
  const isSameLanguage = post.original_language === userLanguage;

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
    setShowComments((prev) => !prev);
    onComment?.(post.id);
  }, [onComment, post.id]);

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

  return (
    <article
      className={cn(
        "relative transition-all duration-200",
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
      {/* Header: Author info */}
      <div className="flex items-start gap-2">
        {/* Avatar with flag overlay */}
        <button
          onClick={handleAuthorClick}
          className="flex-shrink-0 group relative"
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

          {/* Content */}
          <p className="mt-1.5 text-[13px] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap break-words">
            {displayContent}
          </p>

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
              {!isSameLanguage && (isHovered || showOriginal) && (
                <button
                  onClick={() => setShowOriginal((prev) => !prev)}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-all",
                    "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
                    "hover:bg-[var(--glass-bg)]",
                    "animate-fadeIn"
                  )}
                >
                  <Globe size={10} />
                  <span>{showOriginal ? "번역 보기" : `원문 (${fromLangCode})`}</span>
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
                      className="relative group"
                      title={user.display_name || user.username}
                    >
                      <Image
                        src={user.avatar_url || ""}
                        alt={user.display_name || user.username}
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-full border-2 border-[var(--color-bg-primary)] hover:border-[var(--color-claude-coral)] transition-colors"
                      />
                      {/* Tooltip */}
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 text-[10px] bg-black/90 text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
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
              {localComments && localComments.length > 0 ? (
                <div className="space-y-3 mb-3">
                  {localComments.map((comment) => (
                    <div key={comment.id} className="space-y-2">
                      {/* Top-level comment */}
                      <CommentItem
                        comment={comment}
                        isSignedIn={isSignedIn}
                        hasSubmissionHistory={hasSubmissionHistory}
                        onAuthorClick={onAuthorClick}
                        onCommentLike={onCommentLike}
                        onCommentReply={onCommentReply}
                        onLoginRequired={onLoginRequired}
                        onSubmissionRequired={onSubmissionRequired}
                      />

                      {/* Replies (대댓글) - indented, no reply button */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="ml-8 pl-2 border-l-2 border-[var(--border-default)]/30 space-y-2">
                          {comment.replies.map((reply) => (
                            <CommentItem
                              key={reply.id}
                              comment={reply}
                              isReply={true}
                              isSignedIn={isSignedIn}
                              hasSubmissionHistory={hasSubmissionHistory}
                              onAuthorClick={onAuthorClick}
                              onCommentLike={onCommentLike}
                              onLoginRequired={onLoginRequired}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--color-text-muted)] mb-3">
                  No comments yet. Be the first to comment!
                </p>
              )}

              {/* Comment Input */}
              <div className="flex items-center gap-2">
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
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !e.nativeEvent.isComposing && handleCommentSubmit()
                    }
                    disabled={!isSignedIn || !hasSubmissionHistory || isSubmitting}
                    placeholder={
                      !isSignedIn
                        ? "Sign in to comment"
                        : !hasSubmissionHistory
                          ? "Submit data to comment"
                          : "Write a comment..."
                    }
                    className={cn(
                      "w-full px-3 py-1.5 text-[12px] rounded-lg",
                      "bg-[var(--color-bg-card)] border border-[var(--border-default)]",
                      "placeholder:text-[var(--color-text-muted)]",
                      "focus:outline-none focus:border-[var(--color-claude-coral)]",
                      "text-[var(--color-text-primary)]",
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
                    "p-1.5 transition-colors rounded-lg",
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
