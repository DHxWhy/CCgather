"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCheck,
  Heart,
  MessageCircle,
  Reply,
  User,
  TrendingUp,
  Megaphone,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import Link from "next/link";

// =====================================================
// Types
// =====================================================

interface NotificationActor {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Notification {
  id: string;
  type: string;
  actor: NotificationActor | null;
  post_id: string | null;
  comment_id: string | null;
  title: string | null;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  className?: string;
}

// =====================================================
// Notification Type Config
// =====================================================

type NotificationConfigItem = {
  icon: typeof Heart;
  color: string;
  getMessage: (actor: NotificationActor | null, notification?: Notification | null) => string;
};

const NOTIFICATION_CONFIG: Record<string, NotificationConfigItem> = {
  post_like: {
    icon: Heart,
    color: "text-pink-500",
    getMessage: (actor) => `${actor?.display_name || actor?.username || "Someone"} liked your post`,
  },
  post_comment: {
    icon: MessageCircle,
    color: "text-blue-500",
    getMessage: (actor) =>
      `${actor?.display_name || actor?.username || "Someone"} commented on your post`,
  },
  comment_like: {
    icon: Heart,
    color: "text-pink-400",
    getMessage: (actor) =>
      `${actor?.display_name || actor?.username || "Someone"} liked your comment`,
  },
  comment_reply: {
    icon: Reply,
    color: "text-cyan-500",
    getMessage: (actor) =>
      `${actor?.display_name || actor?.username || "Someone"} replied to your comment`,
  },
  new_follower: {
    icon: User,
    color: "text-green-500",
    getMessage: (actor) =>
      `${actor?.display_name || actor?.username || "Someone"} started following you`,
  },
  mention: {
    icon: MessageCircle,
    color: "text-purple-500",
    getMessage: (actor) => `${actor?.display_name || actor?.username || "Someone"} mentioned you`,
  },
  rank_up: {
    icon: TrendingUp,
    color: "text-amber-500",
    getMessage: () => "Your rank has improved!",
  },
  rank_down: {
    icon: TrendingUp,
    color: "text-gray-500",
    getMessage: () => "Your rank has changed",
  },
  system: {
    icon: Megaphone,
    color: "text-[var(--color-accent-cyan)]",
    getMessage: () => "System announcement",
  },
  system_notice: {
    icon: Megaphone,
    color: "text-[var(--color-accent-cyan)]",
    getMessage: (_actor, notification) => notification?.title || "System notice",
  },
  weekly_digest: {
    icon: Megaphone,
    color: "text-[var(--color-claude-coral)]",
    getMessage: () => "Your weekly digest is ready",
  },
};

// Helper to safely get notification config
function getNotificationConfig(type: string): NotificationConfigItem {
  return NOTIFICATION_CONFIG[type] || NOTIFICATION_CONFIG.system!;
}

// =====================================================
// NotificationBell Component
// =====================================================

export default function NotificationBell({ className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevUnreadCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef(true);
  const { play: playNotificationSound } = useNotificationSound();
  // Use ref to avoid re-creating fetchNotifications when playNotificationSound changes
  const playNotificationSoundRef = useRef(playNotificationSound);
  playNotificationSoundRef.current = playNotificationSound;

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/community/notifications?limit=20");

      // Silently handle 401 (user not logged in) or 404 (user not in DB yet)
      if (response.status === 401 || response.status === 404) {
        return;
      }

      if (!response.ok) {
        // Don't throw, just return silently to avoid console spam
        return;
      }

      const data = await response.json();
      setNotifications(data.notifications);

      const newUnreadCount = data.unread_count;

      // Play sound only when new notifications arrive (not on first load)
      if (!isFirstLoadRef.current && newUnreadCount > prevUnreadCountRef.current) {
        playNotificationSoundRef.current(0.3); // 30% volume - subtle but noticeable
      }

      prevUnreadCountRef.current = newUnreadCount;
      isFirstLoadRef.current = false;
      setUnreadCount(newUnreadCount);
    } catch {
      // Network errors - silently ignore to avoid console spam during polling
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty deps - use refs for mutable values

  // Initial fetch and polling
  useEffect(() => {
    fetchNotifications();

    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await fetch("/api/community/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_ids: [notificationId] }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await fetch("/api/community/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  // State for micro-interaction
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Handle notification click with micro-interaction
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      setClearingId(notification.id);
      setTimeout(() => {
        markAsRead(notification.id);
        setClearingId(null);
      }, 300);
    }

    // Expandable notifications (system_notice with body)
    if (notification.type === "system_notice" && notification.body) {
      setExpandedId((prev) => (prev === notification.id ? null : notification.id));
      return;
    }

    // Navigate to post if applicable
    if (notification.post_id) {
      setTimeout(() => {
        setIsOpen(false);
        window.location.href = `/community?post=${notification.post_id}`;
      }, 350);
    } else {
      setIsOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          "hover:bg-white/10",
          isOpen && "bg-white/10"
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell size={16} className="text-[var(--color-text-secondary)]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[var(--color-claude-coral)] text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-hidden rounded-xl border border-white/10 shadow-xl z-50 animate-fadeIn bg-[var(--color-bg-secondary)]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[calc(70vh-60px)] scrollbar-hide">
            {isLoading && notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-[var(--color-accent-cyan)] border-t-transparent rounded-full mx-auto" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={32} className="mx-auto mb-2 text-[var(--color-text-muted)]" />
                <p className="text-sm text-[var(--color-text-muted)]">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const config = getNotificationConfig(notification.type);
                const Icon = config.icon;
                const isClearing = clearingId === notification.id;

                return (
                  <motion.button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors relative overflow-hidden",
                      "hover:bg-white/5",
                      !notification.is_read && "bg-white/[0.03]"
                    )}
                  >
                    {/* Icon with check overlay */}
                    <div
                      className={cn(
                        "relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                        "bg-white/10"
                      )}
                    >
                      {notification.actor?.avatar_url ? (
                        <img
                          src={notification.actor.avatar_url}
                          alt=""
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <Icon size={14} className={config.color} />
                      )}

                      {/* Checkmark animation on clear */}
                      <AnimatePresence>
                        {isClearing && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center bg-green-500 rounded-full"
                          >
                            <Check size={14} className="text-white" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-xs transition-opacity",
                          notification.is_read
                            ? "text-[var(--color-text-muted)]"
                            : "text-[var(--color-text-primary)]",
                          isClearing && "opacity-60"
                        )}
                      >
                        {config.getMessage(notification.actor, notification)}
                      </p>
                      <AnimatePresence>
                        {expandedId === notification.id && notification.body && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-[11px] text-[var(--color-text-secondary)] mt-1.5 leading-relaxed overflow-hidden"
                          >
                            {notification.body}
                          </motion.p>
                        )}
                      </AnimatePresence>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: ko,
                        })}
                      </p>
                    </div>

                    {/* Unread indicator with animation */}
                    <AnimatePresence>
                      {!notification.is_read && !isClearing && (
                        <motion.div
                          initial={{ scale: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex-shrink-0 w-2 h-2 rounded-full bg-[var(--color-accent-cyan)] shadow-[0_0_6px_var(--color-accent-cyan)]"
                        />
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-white/10 px-4 py-2">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="block w-full text-center text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors py-1"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
