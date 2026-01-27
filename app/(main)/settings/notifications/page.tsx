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
  // Leaderboard & Progress (matches DB: notify_*)
  notify_rank_updates: boolean;
  notify_level_up: boolean;
  notify_badges: boolean;
  notify_submissions: boolean;
  // Community
  notify_post_likes: boolean;
  notify_post_comments: boolean;
  notify_comment_replies: boolean;
}

// =====================================================
// Mobile Push Preview Component (Compact & Modern)
// =====================================================

const notifVariants = {
  hidden: { opacity: 0, y: -12, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 500, damping: 30 },
  },
  disabled: { opacity: 0.25, scale: 0.97 },
};

function MobilePushPreview({ isEnabled }: { isEnabled: boolean }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="relative mx-auto w-[180px] select-none"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      animate={{ y: isHovered ? -3 : 0, scale: isHovered ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      {/* Phone Frame */}
      <div className="relative bg-zinc-900 rounded-[22px] p-[4px] shadow-xl ring-1 ring-white/10">
        {/* Screen */}
        <div className="relative bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[19px] overflow-hidden h-[220px]">
          {/* Status Bar */}
          <div className="flex items-center justify-between px-3.5 pt-2">
            <span className="text-[8px] text-white/60 font-medium">9:41</span>
            <div className="w-3.5 h-[7px] rounded-sm border border-white/50 relative">
              <div className="absolute inset-[1px] right-[2px] bg-white/60 rounded-[1px]" />
            </div>
          </div>

          {/* Clock */}
          <div className="text-center pt-1.5 pb-2.5">
            <div className="text-[20px] font-light text-white/90 tracking-tight">9:41</div>
            <div className="text-[7px] text-white/40">Monday, January 27</div>
          </div>

          {/* Notifications Stack */}
          <div className="px-2 space-y-1.5">
            {/* Notif 1 */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`n1-${isEnabled}`}
                variants={notifVariants}
                initial="hidden"
                animate={isEnabled ? "visible" : "disabled"}
                className="rounded-xl p-2 bg-white/15 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-[7px] font-bold text-white">CC</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] text-white font-medium truncate">
                      ❤️ vibelabs liked your post
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Notif 2 */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`n2-${isEnabled}`}
                variants={notifVariants}
                initial="hidden"
                animate={isEnabled ? "visible" : "disabled"}
                transition={{ delay: 0.1 }}
                className="rounded-xl p-2 bg-white/10 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-[7px] font-bold text-white">CC</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] text-white/80 font-medium truncate">
                      🏆 Rank #48 (+4)
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Notif 3 */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`n3-${isEnabled}`}
                variants={notifVariants}
                initial="hidden"
                animate={isEnabled ? "visible" : "disabled"}
                transition={{ delay: 0.18 }}
                className="rounded-xl p-2 bg-white/5 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0 opacity-60">
                    <span className="text-[7px] font-bold text-white">CC</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] text-white/50 font-medium truncate">💬 new comment</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom Fade */}
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none" />
        </div>

        {/* Dynamic Island */}
        <div className="absolute top-[4px] left-1/2 -translate-x-1/2 w-12 h-3.5 bg-black rounded-full" />
      </div>

      {/* Status Label */}
      <motion.div
        className={cn(
          "absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap",
          isEnabled ? "bg-cyan-500/20 text-cyan-400" : "bg-white/10 text-[var(--color-text-muted)]"
        )}
        animate={{ scale: isEnabled ? 1 : 0.95, opacity: isEnabled ? 1 : 0.6 }}
      >
        {isEnabled ? <Bell size={10} /> : <BellOff size={10} />}
        <span>{isEnabled ? "On" : "Off"}</span>
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
        isSmall ? "w-9 h-5" : "w-11 h-6",
        checked ? "bg-[var(--color-accent-cyan)]" : "bg-white/20",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 rounded-full bg-white transition-transform",
          isSmall ? "w-4 h-4" : "w-5 h-5",
          checked ? (isSmall ? "translate-x-4" : "translate-x-5") : "translate-x-0.5"
        )}
      />
    </button>
  );
}

// =====================================================
// Notification Items Configuration
// =====================================================

const NOTIFICATION_ITEMS: {
  key: keyof NotificationSettings;
  label: string;
  description: string;
  emoji: string;
  category: "progress" | "community";
}[] = [
  // Leaderboard & Progress
  {
    key: "notify_submissions",
    label: "제출 완료",
    description: "데이터 제출이 완료되었을 때",
    emoji: "✅",
    category: "progress",
  },
  {
    key: "notify_rank_updates",
    label: "순위 변동",
    description: "리더보드 순위가 변경되었을 때",
    emoji: "📊",
    category: "progress",
  },
  {
    key: "notify_level_up",
    label: "레벨업",
    description: "레벨이 올랐을 때",
    emoji: "⬆️",
    category: "progress",
  },
  {
    key: "notify_badges",
    label: "뱃지 획득",
    description: "새로운 뱃지를 획득했을 때",
    emoji: "🏆",
    category: "progress",
  },
  // Community
  {
    key: "notify_post_likes",
    label: "게시물 좋아요",
    description: "누군가 내 게시물을 좋아요 했을 때",
    emoji: "❤️",
    category: "community",
  },
  {
    key: "notify_post_comments",
    label: "댓글",
    description: "누군가 내 게시물에 댓글을 달았을 때",
    emoji: "💬",
    category: "community",
  },
  {
    key: "notify_comment_replies",
    label: "답글",
    description: "누군가 내 댓글에 답글을 달았을 때",
    emoji: "↩️",
    category: "community",
  },
];

// =====================================================
// Main Page Component
// =====================================================

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

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
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Notifications</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Manage how you receive notifications from CCgather
        </p>
      </div>

      {/* Main Toggle Section with Preview */}
      <section className="glass rounded-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Mobile Preview */}
            <div className="flex-shrink-0 py-4">
              <MobilePushPreview isEnabled={isSubscribed} />
            </div>

            {/* Toggle Section */}
            <div className="flex-1 text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-4 mb-4">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                    isSubscribed ? "bg-[var(--color-accent-cyan)]/20" : "bg-white/10"
                  )}
                >
                  {isSubscribed ? (
                    <Bell size={24} className="text-[var(--color-accent-cyan)]" />
                  ) : (
                    <BellOff size={24} className="text-[var(--color-text-muted)]" />
                  )}
                </div>
                <div>
                  <p className="text-base font-semibold text-[var(--color-text-primary)]">
                    {isSubscribed ? "Push Notifications On" : "Push Notifications Off"}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {!isSupported
                      ? "Not supported in this browser"
                      : permission === "denied"
                        ? "Blocked in browser settings"
                        : isSubscribed
                          ? "You'll receive push notifications on this device"
                          : "Enable to stay updated in real-time"}
                  </p>
                </div>
              </div>

              <button
                onClick={handlePushToggle}
                disabled={!canEnablePush || isPushLoading}
                className={cn(
                  "w-full lg:w-auto px-8 py-3 rounded-xl text-sm font-semibold transition-all",
                  isSubscribed
                    ? "bg-white/10 text-[var(--color-text-primary)] hover:bg-white/20"
                    : "bg-[var(--color-accent-cyan)] text-black hover:bg-[var(--color-accent-cyan)]/90",
                  (!canEnablePush || isPushLoading) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isPushLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </span>
                ) : isSubscribed ? (
                  "Turn Off Notifications"
                ) : (
                  "Enable Push Notifications"
                )}
              </button>

              {permission === "denied" && (
                <p className="text-xs text-amber-400 mt-3 flex items-center justify-center lg:justify-start gap-1.5">
                  <Smartphone size={14} />
                  Check your browser settings to unblock notifications
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Saving Indicator - only show when actually saving, not during initial load */}
        {(isSaving || (isPushLoading && isSupported)) && (
          <div className="px-6 py-2 bg-white/5 border-t border-white/10">
            <span className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving changes...
            </span>
          </div>
        )}
      </section>

      {/* Notification Types Section */}
      {isSubscribed && (
        <section className="glass rounded-2xl overflow-hidden">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
          >
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] text-left">
                Notification Preferences
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] text-left mt-0.5">
                Choose which notifications you want to receive
              </p>
            </div>
            {isExpanded ? (
              <ChevronUp size={20} className="text-[var(--color-text-muted)]" />
            ) : (
              <ChevronDown size={20} className="text-[var(--color-text-muted)]" />
            )}
          </button>

          {isExpanded && (
            <div className="px-4 pb-4 border-t border-white/10">
              {isLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {NOTIFICATION_ITEMS.map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-4 px-2">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{item.emoji}</span>
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">
                            {item.label}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <Toggle
                        checked={settings?.[item.key] ?? true}
                        onChange={(checked) => updateSetting(item.key, checked)}
                        disabled={isSaving}
                        size="small"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Browser Permissions Info */}
      <section className="glass rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          About Push Notifications
        </h2>
        <div className="space-y-3 text-xs text-[var(--color-text-muted)]">
          <p>Push notifications require two levels of permission:</p>
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>
              <strong className="text-[var(--color-text-secondary)]">Browser Permission</strong> -
              Your browser will ask for permission when you first enable notifications
            </li>
            <li>
              <strong className="text-[var(--color-text-secondary)]">App Settings</strong> -
              Customize which types of notifications you want to receive above
            </li>
          </ol>
          <p className="pt-2">
            If you&apos;ve blocked notifications in your browser, you&apos;ll need to update your
            browser&apos;s site settings to re-enable them.
          </p>
        </div>
      </section>
    </div>
  );
}
