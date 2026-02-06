"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCheck,
  Heart,
  MessageCircle,
  Reply,
  User,
  TrendingUp,
  TrendingDown,
  Megaphone,
  Filter,
  Check,
  Sparkles,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { BrandSpinner } from "@/components/shared/BrandSpinner";
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

type FilterType = "all" | "unread" | "likes" | "comments" | "system";

// =====================================================
// Notification Type Config
// =====================================================

type NotificationConfigItem = {
  icon: typeof Heart;
  color: string;
  bgColor: string;
  getMessage: (actor: NotificationActor | null, notification?: Notification | null) => string;
  category: "likes" | "comments" | "social" | "system";
};

const NOTIFICATION_CONFIG: Record<string, NotificationConfigItem> = {
  post_like: {
    icon: Heart,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    getMessage: (actor) => `${actor?.display_name || actor?.username || "Someone"} liked your post`,
    category: "likes",
  },
  post_comment: {
    icon: MessageCircle,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    getMessage: (actor) =>
      `${actor?.display_name || actor?.username || "Someone"} commented on your post`,
    category: "comments",
  },
  comment_like: {
    icon: Heart,
    color: "text-pink-400",
    bgColor: "bg-pink-400/10",
    getMessage: (actor) =>
      `${actor?.display_name || actor?.username || "Someone"} liked your comment`,
    category: "likes",
  },
  comment_reply: {
    icon: Reply,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    getMessage: (actor) =>
      `${actor?.display_name || actor?.username || "Someone"} replied to your comment`,
    category: "comments",
  },
  new_follower: {
    icon: User,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    getMessage: (actor) =>
      `${actor?.display_name || actor?.username || "Someone"} started following you`,
    category: "social",
  },
  mention: {
    icon: MessageCircle,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    getMessage: (actor) => `${actor?.display_name || actor?.username || "Someone"} mentioned you`,
    category: "comments",
  },
  rank_up: {
    icon: TrendingUp,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    getMessage: () => "Your rank has improved!",
    category: "system",
  },
  rank_down: {
    icon: TrendingDown,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    getMessage: () => "Your rank has changed",
    category: "system",
  },
  system: {
    icon: Megaphone,
    color: "text-[var(--color-accent-cyan)]",
    bgColor: "bg-[var(--color-accent-cyan)]/10",
    getMessage: () => "System announcement",
    category: "system",
  },
  system_notice: {
    icon: Megaphone,
    color: "text-[var(--color-accent-cyan)]",
    bgColor: "bg-[var(--color-accent-cyan)]/10",
    getMessage: (_actor, notification) => notification?.title || "System notice",
    category: "system",
  },
  weekly_digest: {
    icon: Megaphone,
    color: "text-[var(--color-claude-coral)]",
    bgColor: "bg-[var(--color-claude-coral)]/10",
    getMessage: () => "Your weekly digest is ready",
    category: "system",
  },
};

// Short time format: "1h ago", "3d ago", "2m ago"
function shortTimeAgo(date: Date): string {
  const str = formatDistanceToNowStrict(date, { addSuffix: false });
  return (
    str
      .replace(/ seconds?/, "s")
      .replace(/ minutes?/, "m")
      .replace(/ hours?/, "h")
      .replace(/ days?/, "d")
      .replace(/ months?/, "mo")
      .replace(/ years?/, "y") + " ago"
  );
}

function getNotificationConfig(type: string): NotificationConfigItem {
  return NOTIFICATION_CONFIG[type] || NOTIFICATION_CONFIG.system!;
}

// =====================================================
// Filter Tabs
// =====================================================

const FILTER_TABS: { value: FilterType; label: string; icon?: typeof Filter }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "likes", label: "Likes", icon: Heart },
  { value: "comments", label: "Comments", icon: MessageCircle },
  { value: "system", label: "System", icon: Megaphone },
];

// =====================================================
// Notification Item Component (with micro-interactions)
// =====================================================

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (notification: Notification) => void;
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onNavigate,
}: NotificationItemProps) {
  const [isClearing, setIsClearing] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const config = getNotificationConfig(notification.type);
  const Icon = config.icon;
  const isExpandable = notification.type === "system_notice" && notification.body;

  const handleClick = () => {
    if (!notification.is_read) {
      setIsClearing(true);
      setShowCheck(true);
      setTimeout(() => {
        onMarkAsRead(notification.id);
        setShowCheck(false);
      }, 400);
    }

    if (isExpandable) {
      setIsExpanded((prev) => !prev);
      return;
    }

    onNavigate(notification);
  };

  return (
    <motion.div layout className="relative group">
      <motion.button
        onClick={handleClick}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "w-full flex items-start gap-3 p-3 text-left transition-all duration-300 rounded-lg",
          "hover:bg-white/5 relative overflow-hidden",
          !notification.is_read && "bg-white/[0.03]"
        )}
      >
        {/* Background highlight for unread */}
        <AnimatePresence>
          {!notification.is_read && !isClearing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 bg-gradient-to-r from-[var(--color-claude-coral)]/5 to-transparent pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Icon / Avatar */}
        <motion.div
          animate={isClearing ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.3 }}
          className={cn(
            "relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            config.bgColor
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

          <AnimatePresence>
            {showCheck && (
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
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <motion.p
              animate={isClearing ? { opacity: [1, 0.7, 1] } : {}}
              className={cn(
                "text-xs",
                notification.is_read
                  ? "text-[var(--color-text-muted)]"
                  : "text-[var(--color-text-primary)]"
              )}
            >
              {config.getMessage(notification.actor, notification)}
            </motion.p>
            {isExpandable && (
              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={12} className="text-[var(--color-text-muted)]" />
              </motion.div>
            )}
          </div>
          <AnimatePresence>
            {isExpanded && notification.body && (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-[11px] text-[var(--color-text-secondary)] mt-1.5 leading-relaxed overflow-hidden select-text cursor-text"
              >
                {notification.body}
              </motion.p>
            )}
          </AnimatePresence>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
            {shortTimeAgo(new Date(notification.created_at))}
          </p>
        </div>

        {/* Unread indicator */}
        <AnimatePresence>
          {!notification.is_read && !isClearing && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="flex-shrink-0 self-center"
            >
              <div className="w-2 h-2 rounded-full bg-[var(--color-accent-cyan)] shadow-[0_0_6px_var(--color-accent-cyan)]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sparkle effect on clear */}
        <AnimatePresence>
          {showCheck && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <Sparkles size={12} className="text-amber-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Delete button (visible on hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
        className="absolute right-2 top-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400"
        aria-label="Delete notification"
      >
        <Trash2 size={12} />
      </button>
    </motion.div>
  );
}

// =====================================================
// Main Page Component
// =====================================================

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);
  const LIMIT = 30;

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (loadMore = false) => {
      try {
        if (loadMore) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
          setOffset(0);
        }

        const currentOffset = loadMore ? offset : 0;
        const params = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(currentOffset),
        });

        if (filter === "unread") {
          params.set("unread", "true");
        }

        const response = await fetch(`/api/community/notifications?${params}`);
        if (!response.ok) throw new Error("Failed to fetch");

        const data = await response.json();

        if (loadMore) {
          setNotifications((prev) => [...prev, ...data.notifications]);
        } else {
          setNotifications(data.notifications);
        }

        setUnreadCount(data.unread_count);
        setHasMore(data.hasMore);
        setOffset(currentOffset + LIMIT);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [filter, offset]
  );

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          fetchNotifications(true);
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, fetchNotifications]);

  // Mark as read
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

  // Mark all as read with satisfying animation
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const markAllAsRead = async () => {
    setIsMarkingAll(true);

    // Stagger animation for each unread notification
    const unreadNotifications = notifications.filter((n) => !n.is_read);
    for (let i = 0; i < unreadNotifications.length; i++) {
      setTimeout(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === unreadNotifications[i]?.id ? { ...n, is_read: true } : n))
        );
      }, i * 50); // 50ms stagger
    }

    try {
      await fetch("/api/community/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });

      setTimeout(
        () => {
          setUnreadCount(0);
          setIsMarkingAll(false);
        },
        unreadNotifications.length * 50 + 200
      );
    } catch (error) {
      console.error("Error marking all as read:", error);
      setIsMarkingAll(false);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    try {
      await fetch("/api/community/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_ids: [notificationId] }),
      });
    } catch (error) {
      console.error("Error deleting notification:", error);
      fetchNotifications();
    }
  };

  // No navigation action - notifications are read-only
  const handleNavigate = () => {};

  // Filter notifications by category
  const filteredNotifications = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.is_read;
    const config = getNotificationConfig(n.type);
    if (filter === "likes") return config.category === "likes";
    if (filter === "comments") return config.category === "comments";
    if (filter === "system") return config.category === "system";
    return true;
  });

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-claude-coral)] to-[var(--color-claude-rust)] flex items-center justify-center">
                <Bell size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-[var(--color-text-primary)]">
                  Notifications
                </h1>
                {unreadCount > 0 && (
                  <p className="text-[10px] text-[var(--color-text-muted)]">{unreadCount} unread</p>
                )}
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {/* Mark all as read button */}
              {unreadCount > 0 && (
                <motion.button
                  onClick={markAllAsRead}
                  disabled={isMarkingAll}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    "bg-[var(--color-claude-coral)]/10 text-[var(--color-claude-coral)]",
                    "hover:bg-[var(--color-claude-coral)]/20",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <CheckCheck size={14} />
                  <span>{isMarkingAll ? "Clearing..." : "Clear all"}</span>
                </motion.button>
              )}

              {/* Settings link - top right */}
              <Link
                href="/settings/notifications"
                className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Settings →
              </Link>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-hide pb-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap",
                filter === tab.value
                  ? "bg-[var(--color-claude-coral)] text-white"
                  : "bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10 hover:text-[var(--color-text-primary)]"
              )}
            >
              {tab.icon && <tab.icon size={12} />}
              {tab.label}
              {tab.value === "unread" && unreadCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[9px]">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Glass Container */}
        <div className="glass rounded-2xl overflow-hidden">
          {/* Loading State */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <BrandSpinner size="md" />
              <p className="text-xs text-[var(--color-text-muted)] mt-4">
                Loading notifications...
              </p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <Bell size={24} className="text-[var(--color-text-muted)]" />
              </div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                {filter === "unread" ? "All caught up!" : "No notifications yet"}
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] max-w-xs">
                {filter === "unread"
                  ? "You've read all your notifications. Nice work!"
                  : "When you get notifications, they'll show up here."}
              </p>
              {filter === "unread" && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-3">
                  <Sparkles size={18} className="text-amber-400" />
                </motion.div>
              )}
            </div>
          ) : (
            /* Notification List */
            <div className="divide-y divide-white/5">
              <AnimatePresence mode="popLayout">
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                    onNavigate={handleNavigate}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Load more trigger */}
          {hasMore && (
            <div ref={observerRef} className="p-3 text-center">
              {isLoadingMore && (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 border-2 border-[var(--color-claude-coral)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-[var(--color-text-muted)]">Loading more...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
