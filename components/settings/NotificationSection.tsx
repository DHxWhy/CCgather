"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, Smartphone, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/usePushNotifications";

// =====================================================
// Types
// =====================================================

interface NotificationSettings {
  post_likes: boolean;
  post_comments: boolean;
  comment_likes: boolean;
  comment_replies: boolean;
  new_followers: boolean;
  mentions: boolean;
  system_announcements: boolean;
  rank_changes: boolean;
  weekly_digest: boolean;
  email_notifications: boolean;
}

// =====================================================
// Mobile Push Preview Component (Animated)
// =====================================================

const notificationVariants = {
  hidden: {
    opacity: 0,
    y: -20,
    scale: 0.95,
    filter: "blur(4px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    },
  },
  disabled: {
    opacity: 0.3,
    scale: 0.95,
    filter: "blur(2px)",
  },
};

const secondNotificationVariants = {
  hidden: {
    opacity: 0,
    y: -15,
    scale: 0.9,
    filter: "blur(4px)",
  },
  visible: {
    opacity: 0.7,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
      delay: 0.15,
    },
  },
  disabled: {
    opacity: 0.15,
    scale: 0.9,
    filter: "blur(2px)",
  },
};

function MobilePushPreview({ isEnabled }: { isEnabled: boolean }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="relative mx-auto w-[180px] select-none"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      animate={{
        y: isHovered ? -3 : 0,
        scale: isHovered ? 1.03 : 1,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      {/* Phone Frame - Larger */}
      <div className="relative bg-zinc-900 rounded-[20px] p-[4px] shadow-xl ring-1 ring-white/10">
        {/* Screen */}
        <div className="relative bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[17px] overflow-hidden h-[220px]">
          {/* Status Bar */}
          <div className="flex items-center justify-between px-3 pt-1.5">
            <span className="text-[8px] text-white/60 font-medium">9:41</span>
            <div className="flex items-center gap-0.5">
              <div className="w-3 h-1.5 rounded-sm border border-white/50 relative">
                <div className="absolute inset-[1px] right-[2px] bg-white/60 rounded-[1px]" />
              </div>
            </div>
          </div>

          {/* Clock */}
          <div className="text-center pt-1.5 pb-2">
            <div className="text-[18px] font-light text-white/90 tracking-tight">9:41</div>
            <div className="text-[7px] text-white/40 mt-0.5">Monday, January 27</div>
          </div>

          {/* Push Notifications */}
          <div className="px-2 space-y-1.5">
            {/* First Notification */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`notif-1-${isEnabled}`}
                variants={notificationVariants}
                initial="hidden"
                animate={isEnabled ? "visible" : "disabled"}
                className="rounded-xl p-2 backdrop-blur-md bg-white/15 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#00D4AA] to-[#0099CC] flex items-center justify-center flex-shrink-0">
                    <span className="text-[6px] font-bold text-white">CC</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] text-white/90 font-medium leading-tight truncate">
                      ❤️ vibelabs liked your post
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Second Notification */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`notif-2-${isEnabled}`}
                variants={secondNotificationVariants}
                initial="hidden"
                animate={isEnabled ? "visible" : "disabled"}
                className="rounded-xl p-2 backdrop-blur-md bg-white/10"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#00D4AA] to-[#0099CC] flex items-center justify-center flex-shrink-0">
                    <span className="text-[6px] font-bold text-white">CC</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] text-white/70 font-medium leading-tight truncate">
                      🏆 Rank #48 (+4)
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Third Notification - Fading */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`notif-3-${isEnabled}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{
                  opacity: isEnabled ? 0.4 : 0.1,
                  y: 0,
                  scale: isEnabled ? 1 : 0.95,
                }}
                transition={{ type: "spring" as const, stiffness: 400, damping: 25, delay: 0.25 }}
                className="rounded-xl p-2 backdrop-blur-md bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#00D4AA] to-[#0099CC] flex items-center justify-center flex-shrink-0 opacity-60">
                    <span className="text-[6px] font-bold text-white">CC</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] text-white/50 font-medium leading-tight truncate">
                      💬 new comment
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom Gradient Fade */}
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none" />
        </div>

        {/* Dynamic Island */}
        <div className="absolute top-[4px] left-1/2 -translate-x-1/2 w-10 h-3 bg-black rounded-full" />
      </div>

      {/* Status Label */}
      <motion.div
        className={cn(
          "absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium",
          isEnabled
            ? "bg-[var(--color-accent-cyan)]/20 text-[var(--color-accent-cyan)]"
            : "bg-white/10 text-[var(--color-text-muted)]"
        )}
        animate={{
          scale: isEnabled ? 1 : 0.95,
          opacity: isEnabled ? 1 : 0.6,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {isEnabled ? (
          <>
            <Bell size={10} />
            <span>On</span>
          </>
        ) : (
          <>
            <BellOff size={10} />
            <span>Off</span>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// =====================================================
// Toggle Switch Component
// =====================================================

function Toggle({
  checked,
  onChange,
  disabled,
  size = "default",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "default" | "small";
}) {
  const isSmall = size === "small";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative rounded-full transition-colors",
        isSmall ? "w-8 h-4" : "w-10 h-5",
        checked ? "bg-[var(--color-accent-cyan)]" : "bg-white/20",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 rounded-full bg-white transition-transform",
          isSmall ? "w-3 h-3" : "w-4 h-4",
          checked ? (isSmall ? "translate-x-4" : "translate-x-5") : "translate-x-0.5"
        )}
      />
    </button>
  );
}

// =====================================================
// NotificationSection Component
// =====================================================

const NOTIFICATION_ITEMS: {
  key: keyof Omit<NotificationSettings, "email_notifications">;
  label: string;
  emoji: string;
}[] = [
  { key: "post_likes", label: "Post likes", emoji: "❤️" },
  { key: "post_comments", label: "Comments", emoji: "💬" },
  { key: "comment_replies", label: "Replies", emoji: "↩️" },
  { key: "comment_likes", label: "Comment likes", emoji: "💗" },
  { key: "rank_changes", label: "Rank changes", emoji: "📊" },
  { key: "mentions", label: "Mentions", emoji: "📢" },
  { key: "new_followers", label: "New followers", emoji: "👋" },
  { key: "system_announcements", label: "Announcements", emoji: "📣" },
  { key: "weekly_digest", label: "Weekly digest", emoji: "📧" },
];

export default function NotificationSection() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading: isPushLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/community/settings");
        if (response.ok) {
          const data = await response.json();
          setSettings(data.settings);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Update setting
  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    if (!settings) return;

    setIsSaving(true);
    const previousSettings = { ...settings };
    setSettings({ ...settings, [key]: value });

    try {
      const response = await fetch("/api/community/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) throw new Error("Failed to update");
    } catch (error) {
      console.error("Error updating setting:", error);
      setSettings(previousSettings);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle push notification toggle
  const handlePushToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const canEnablePush = isSupported && permission !== "denied";

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">
          Push Notifications
        </h2>
        {(isSaving || isPushLoading) && (
          <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving...
          </span>
        )}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {/* Main Toggle with Preview */}
        <div className="p-4 pb-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Mobile Preview */}
            <div className="flex-shrink-0 py-4">
              <MobilePushPreview isEnabled={isSubscribed} />
            </div>

            {/* Toggle Section */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                    isSubscribed ? "bg-[var(--color-accent-cyan)]/20" : "bg-white/10"
                  )}
                >
                  {isSubscribed ? (
                    <Bell size={20} className="text-[var(--color-accent-cyan)]" />
                  ) : (
                    <BellOff size={20} className="text-[var(--color-text-muted)]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {isSubscribed ? "Notifications On" : "Notifications Off"}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {!isSupported
                      ? "Not supported in this browser"
                      : permission === "denied"
                        ? "Blocked in browser settings"
                        : isSubscribed
                          ? "You'll receive push notifications"
                          : "Enable to stay updated"}
                  </p>
                </div>
              </div>

              <button
                onClick={handlePushToggle}
                disabled={!canEnablePush || isPushLoading}
                className={cn(
                  "w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isSubscribed
                    ? "bg-white/10 text-[var(--color-text-primary)] hover:bg-white/20"
                    : "bg-[var(--color-accent-cyan)] text-black hover:bg-[var(--color-accent-cyan)]/90",
                  (!canEnablePush || isPushLoading) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isPushLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Processing...
                  </span>
                ) : isSubscribed ? (
                  "Turn Off Notifications"
                ) : (
                  "Enable Notifications"
                )}
              </button>

              {permission === "denied" && (
                <p className="text-[10px] text-amber-400 mt-2 flex items-center justify-center sm:justify-start gap-1">
                  <Smartphone size={12} />
                  Check browser settings to unblock
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Notification Types (Expandable) */}
        {isSubscribed && (
          <>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 border-t border-white/10 hover:bg-white/5 transition-colors"
            >
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                Customize Notifications
              </span>
              {isExpanded ? (
                <ChevronUp size={16} className="text-[var(--color-text-muted)]" />
              ) : (
                <ChevronDown size={16} className="text-[var(--color-text-muted)]" />
              )}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-1 border-t border-white/5">
                {isLoading ? (
                  <div className="py-4 flex justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
                  </div>
                ) : (
                  NOTIFICATION_ITEMS.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm">{item.emoji}</span>
                        <span className="text-xs text-[var(--color-text-primary)]">
                          {item.label}
                        </span>
                      </div>
                      <Toggle
                        checked={settings?.[item.key] ?? true}
                        onChange={(checked) => updateSetting(item.key, checked)}
                        disabled={isSaving}
                        size="small"
                      />
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
