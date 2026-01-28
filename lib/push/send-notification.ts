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
          await webpush.sendNotification(pushSubscription, JSON.stringify(payload), {
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
// Notification Helpers
// =====================================================

export function createPostLikeNotification(
  actorUsername: string,
  postContent: string,
  postId: string
): PushNotificationPayload {
  return {
    title: "New Like",
    body: `${actorUsername} liked your post: "${postContent.slice(0, 50)}${postContent.length > 50 ? "..." : ""}"`,
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
  return {
    title: "New Comment",
    body: `${actorUsername}: "${commentContent.slice(0, 50)}${commentContent.length > 50 ? "..." : ""}"`,
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
  return {
    title: "Comment Liked",
    body: `${actorUsername} liked your comment: "${commentContent.slice(0, 40)}${commentContent.length > 40 ? "..." : ""}"`,
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
  return {
    title: "New Reply",
    body: `${actorUsername} replied: "${replyContent.slice(0, 50)}${replyContent.length > 50 ? "..." : ""}"`,
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

export function createRankChangeNotification(
  newRank: number,
  previousRank: number
): PushNotificationPayload {
  const improved = newRank < previousRank;
  return {
    title: improved ? "🎉 Rank Up!" : "📊 Rank Update",
    body: improved
      ? `You moved up to #${newRank} (from #${previousRank})!`
      : `Your rank changed to #${newRank} (from #${previousRank})`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: "rank-change",
    data: {
      url: "/leaderboard",
      type: "rank_update",
    },
  };
}

export function createSubmissionCompleteNotification(
  totalTokens: number,
  rank: number
): PushNotificationPayload {
  const formattedTokens =
    totalTokens >= 1_000_000
      ? `${(totalTokens / 1_000_000).toFixed(1)}M`
      : totalTokens >= 1_000
        ? `${(totalTokens / 1_000).toFixed(0)}K`
        : totalTokens.toString();

  return {
    title: "✅ Submission Complete",
    body: `Your data has been submitted! Total: ${formattedTokens} tokens (Global #${rank})`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: "submission-complete",
    data: {
      url: "/leaderboard",
      type: "submission_complete",
    },
  };
}

export function createLevelUpNotification(
  newLevel: number,
  levelName: string
): PushNotificationPayload {
  return {
    title: "⬆️ Level Up!",
    body: `Congratulations! You've reached Level ${newLevel}: ${levelName}`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: "level-up",
    data: {
      url: "/leaderboard",
      type: "level_up",
    },
  };
}

export function createBadgeEarnedNotification(
  badgeName: string,
  badgeIcon: string,
  badgeRarity: string
): PushNotificationPayload {
  const rarityEmoji =
    badgeRarity === "legendary"
      ? "🌟"
      : badgeRarity === "epic"
        ? "💎"
        : badgeRarity === "rare"
          ? "✨"
          : "🏅";

  return {
    title: `${rarityEmoji} New Badge Unlocked!`,
    body: `You earned: ${badgeIcon} ${badgeName}`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: `badge-${badgeName.toLowerCase().replace(/\s+/g, "-")}`,
    data: {
      url: "/leaderboard",
      type: "badge_earned",
    },
  };
}
