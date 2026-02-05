import * as webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";

// =====================================================
// Types
// =====================================================

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  silent?: boolean;
  data?: {
    url?: string;
    type?: string;
    postId?: string;
    commentId?: string;
    actorId?: string;
  };
}

// =====================================================
// Initialize VAPID
// =====================================================

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@ccgather.dev";

let isVapidConfigured = false;

function ensureVapidConfigured() {
  if (isVapidConfigured) return true;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("VAPID keys not configured. Push notifications disabled.");
    return false;
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    isVapidConfigured = true;
    return true;
  } catch (error) {
    console.error("Failed to configure VAPID:", error);
    return false;
  }
}

// =====================================================
// Send Push Notification to User
// =====================================================

export async function sendPushNotificationToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ success: number; failed: number }> {
  if (!ensureVapidConfigured()) {
    return { success: 0, failed: 0 };
  }

  const supabase = createServiceClient();

  // Get user's sound preference
  const { data: settings } = await supabase
    .from("user_notification_settings")
    .select("notify_sound_enabled")
    .eq("user_id", userId)
    .single();

  // Apply sound setting to payload (silent = !notify_sound_enabled)
  const payloadWithSound: PushNotificationPayload = {
    ...payload,
    silent: settings?.notify_sound_enabled === false,
  };

  // Get all push subscriptions for this user
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;
  const expiredSubscriptionIds: string[] = [];

  // Send to all subscriptions
  await Promise.all(
    subscriptions.map(
      async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, JSON.stringify(payloadWithSound), {
            TTL: 86400, // 24 hours
            urgency: "normal",
          });
          success++;
        } catch (error: unknown) {
          const webPushError = error as { statusCode?: number };
          if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
            // Subscription has expired or is invalid - mark for deletion
            expiredSubscriptionIds.push(sub.id);
          }
          failed++;
          console.error("Push notification failed:", error);
        }
      }
    )
  );

  // Clean up expired subscriptions
  if (expiredSubscriptionIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", expiredSubscriptionIds);
  }

  return { success, failed };
}

// =====================================================
// Send Push Notification to Multiple Users
// =====================================================

export async function sendPushNotificationToUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<{ success: number; failed: number }> {
  const results = await Promise.all(
    userIds.map((userId) => sendPushNotificationToUser(userId, payload))
  );

  return results.reduce(
    (acc, result) => ({
      success: acc.success + result.success,
      failed: acc.failed + result.failed,
    }),
    { success: 0, failed: 0 }
  );
}

// =====================================================
// Notification Helpers - Community
// =====================================================

// Helper to truncate content for mobile-friendly display
function truncateContent(content: string, maxLength: number): string {
  const trimmed = content.trim().replace(/\n/g, " ");
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength).trim() + "...";
}

export function createPostLikeNotification(
  actorUsername: string,
  postContent: string,
  postId: string
): PushNotificationPayload {
  const preview = truncateContent(postContent, 40);
  return {
    title: `❤️ ${actorUsername} liked your post`,
    body: `"${preview}"`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: `post-like-${postId}`,
    data: {
      url: `/community?post=${postId}`,
      type: "post_like",
      postId,
    },
  };
}

export function createCommentNotification(
  actorUsername: string,
  commentContent: string,
  postId: string,
  commentId: string
): PushNotificationPayload {
  const preview = truncateContent(commentContent, 50);
  return {
    title: "💬 New comment on your post",
    body: `${actorUsername}:\n"${preview}"`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: `comment-${postId}`,
    data: {
      url: `/community?post=${postId}#comment-${commentId}`,
      type: "post_comment",
      postId,
      commentId,
    },
  };
}

export function createCommentLikeNotification(
  actorUsername: string,
  commentContent: string,
  postId: string,
  commentId: string
): PushNotificationPayload {
  const preview = truncateContent(commentContent, 40);
  return {
    title: `❤️ ${actorUsername} liked your comment`,
    body: `"${preview}"`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: `comment-like-${commentId}`,
    data: {
      url: `/community?post=${postId}#comment-${commentId}`,
      type: "comment_like",
      postId,
      commentId,
    },
  };
}

export function createCommentReplyNotification(
  actorUsername: string,
  replyContent: string,
  postId: string,
  commentId: string
): PushNotificationPayload {
  const preview = truncateContent(replyContent, 50);
  return {
    title: "💬 Someone replied to you",
    body: `${actorUsername}:\n"${preview}"`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: `reply-${commentId}`,
    data: {
      url: `/community?post=${postId}#comment-${commentId}`,
      type: "comment_reply",
      postId,
      commentId,
    },
  };
}

// =====================================================
// Unified Submission Summary Notification
// =====================================================

export interface SubmissionSummaryData {
  totalTokens: number;
  rank: number;
  rankChange?: number; // positive number = moved up (e.g., 4 means ↑4)
  newLevel?: { level: number; name: string };
  newBadges?: { name: string; icon: string }[];
}

function formatTokensCompact(tokens: number): string {
  if (tokens >= 1_000_000_000) {
    return `${(tokens / 1_000_000_000).toFixed(1)}B`;
  }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(0)}K`;
  }
  return tokens.toString();
}

// =====================================================
// Notification Helpers - Feedback
// =====================================================

export type FeedbackStatus = "in_progress" | "resolved" | "closed";

export function createFeedbackStatusNotification(
  status: FeedbackStatus,
  feedbackType: "bug" | "feature" | "general",
  feedbackContent: string,
  adminNote?: string
): PushNotificationPayload {
  const preview = truncateContent(feedbackContent, 40);
  const typeLabel =
    feedbackType === "bug"
      ? "Bug Report"
      : feedbackType === "feature"
        ? "Feature Request"
        : "Feedback";

  const statusConfig: Record<FeedbackStatus, { title: string; emoji: string }> = {
    in_progress: {
      title: `Your ${typeLabel} is being reviewed`,
      emoji: "🔍",
    },
    resolved: {
      title: `Your ${typeLabel} has been resolved!`,
      emoji: "✅",
    },
    closed: {
      title: `Your ${typeLabel} has been closed`,
      emoji: "📋",
    },
  };

  const config = statusConfig[status];
  const bodyLines = [`"${preview}"`];

  if (adminNote) {
    bodyLines.push(`\nAdmin: ${truncateContent(adminNote, 80)}`);
  }

  return {
    title: `${config.emoji} ${config.title}`,
    body: bodyLines.join(""),
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: `feedback-${status}`,
    data: {
      url: "/settings",
      type: `feedback_${status}`,
    },
  };
}

export function createSubmissionSummaryNotification(
  data: SubmissionSummaryData
): PushNotificationPayload {
  const lines: string[] = [];

  // Line 1: Tokens + Rank
  const tokenStr = formatTokensCompact(data.totalTokens);
  const rankStr = data.rankChange
    ? `Global #${data.rank} (↑${data.rankChange})`
    : `Global #${data.rank}`;
  lines.push(`📊 ${tokenStr} tokens`);
  lines.push(`🏆 ${rankStr}`);

  // Level up (if applicable)
  if (data.newLevel) {
    lines.push(`🆙 Level ${data.newLevel.level}: ${data.newLevel.name}`);
  }

  // New badges (each on its own line)
  if (data.newBadges && data.newBadges.length > 0) {
    for (const badge of data.newBadges) {
      lines.push(`${badge.icon} ${badge.name}`);
    }
  }

  // Choose title based on achievements
  let title = "✅ Data synced!";
  if (data.newBadges && data.newBadges.length > 0) {
    title = "🎉 New badges unlocked!";
  } else if (data.newLevel) {
    title = "🎉 Level up!";
  } else if (data.rankChange && data.rankChange > 0) {
    title = "🎉 You're climbing!";
  }

  return {
    title,
    body: lines.join("\n"),
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: "submission-summary",
    data: {
      url: "/leaderboard",
      type: "submission_summary",
    },
  };
}
