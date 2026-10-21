// Shared by the notification bell and /notifications so both expand the same notifications

export const FEEDBACK_NOTIFICATION_TYPES = [
  "feedback_in_progress",
  "feedback_resolved",
  "feedback_closed",
] as const;

interface DisplayableNotification {
  type: string;
  body: string | null;
  data: Record<string, unknown> | null;
}

export interface NotificationDetail {
  quotedFeedback: string | null;
  text: string;
}

const isFeedbackType = (type: string): boolean =>
  (FEEDBACK_NOTIFICATION_TYPES as readonly string[]).includes(type);

/** What a notification shows when expanded, or null when there is nothing to expand */
export function getNotificationDetail(
  notification: DisplayableNotification
): NotificationDetail | null {
  if (notification.type === "system_notice") {
    return notification.body ? { quotedFeedback: null, text: notification.body } : null;
  }
  if (isFeedbackType(notification.type)) {
    const reply = notification.data?.admin_note;
    if (typeof reply !== "string" || reply.trim() === "") return null;
    return { quotedFeedback: notification.body?.trim() || null, text: reply.trim() };
  }
  return null;
}
