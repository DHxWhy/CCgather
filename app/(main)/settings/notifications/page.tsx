"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, Smartphone, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/usePushNotifications";

// =====================================================
// Types
// =====================================================

interface NotificationSettings {
  notify_rank_updates: boolean;
  notify_level_up: boolean;
  notify_badges: boolean;
  notify_submissions: boolean;
  notify_post_likes: boolean;
  notify_post_comments: boolean;
  notify_comment_replies: boolean;
}

// =====================================================
// Mobile Push Preview Component
// =====================================================

const notifVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 500, damping: 30 },
  },
  disabled: { opacity: 0.25, scale: 0.97 },
};

function MobilePushPreview({ isEnabled }: { isEnabled: boolean }) {
  return (
    <div className="relative mx-auto w-[140px] select-none">
      {/* Phone Frame */}
      <div className="relative bg-zinc-900 rounded-[18px] p-[3px] shadow-lg ring-1 ring-white/10">
        {/* Screen */}
        <div className="relative bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[15px] overflow-hidden h-[170px]">
          {/* Status Bar */}
          <div className="flex items-center justify-between px-2.5 pt-1.5">
            <span className="text-[7px] text-white/60 font-medium">9:41</span>
            <div className="w-3 h-[5px] rounded-sm border border-white/50 relative">
              <div className="absolute inset-[1px] right-[2px] bg-white/60 rounded-[1px]" />
            </div>
          </div>

          {/* Clock */}
          <div className="text-center pt-1 pb-2">
            <div className="text-[16px] font-light text-white/90 tracking-tight">9:41</div>
            <div className="text-[6px] text-white/40">Monday, January 27</div>
          </div>

          {/* Notifications Stack */}
          <div className="px-1.5 space-y-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={`n1-${isEnabled}`}
                variants={notifVariants}
                initial="hidden"
                animate={isEnabled ? "visible" : "disabled"}
                className="rounded-lg p-1.5 bg-white/15 backdrop-blur-sm"
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-[6px] font-bold text-white">CC</span>
                  </div>
                  <p className="text-[7px] text-white font-medium truncate">
                    ❤️ vibelabs liked your post
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={`n2-${isEnabled}`}
                variants={notifVariants}
                initial="hidden"
                animate={isEnabled ? "visible" : "disabled"}
                transition={{ delay: 0.08 }}
                className="rounded-lg p-1.5 bg-white/10 backdrop-blur-sm"
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-[6px] font-bold text-white">CC</span>
                  </div>
                  <p className="text-[7px] text-white/80 font-medium truncate">🏆 Rank #48 (+4)</p>
                </div>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={`n3-${isEnabled}`}
                variants={notifVariants}
                initial="hidden"
                animate={isEnabled ? "visible" : "disabled"}
                transition={{ delay: 0.14 }}
                className="rounded-lg p-1.5 bg-white/5 backdrop-blur-sm"
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0 opacity-60">
                    <span className="text-[6px] font-bold text-white">CC</span>
                  </div>
                  <p className="text-[7px] text-white/50 font-medium truncate">💬 new comment</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom Fade */}
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none" />
        </div>

        {/* Dynamic Island */}
        <div className="absolute top-[3px] left-1/2 -translate-x-1/2 w-9 h-2.5 bg-black rounded-full" />
      </div>

      {/* Status Label */}
      <motion.div
        className={cn(
          "absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium whitespace-nowrap",
          isEnabled ? "bg-cyan-500/20 text-cyan-400" : "bg-white/10 text-[var(--color-text-muted)]"
        )}
        animate={{ scale: isEnabled ? 1 : 0.95, opacity: isEnabled ? 1 : 0.6 }}
      >
        {isEnabled ? <Bell size={9} /> : <BellOff size={9} />}
        <span>{isEnabled ? "On" : "Off"}</span>
      </motion.div>
    </div>
  );
}

// =====================================================
// Toggle Switch Component
// =====================================================

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative rounded-full transition-colors w-9 h-5",
        checked ? "bg-[var(--color-accent-cyan)]" : "bg-white/20",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 rounded-full bg-white transition-transform w-4 h-4",
          checked ? "translate-x-4" : "translate-x-0"
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
  emoji: string;
}[] = [
  { key: "notify_submissions", label: "Submissions", emoji: "✅" },
  { key: "notify_rank_updates", label: "Rank changes", emoji: "📊" },
  { key: "notify_level_up", label: "Level up", emoji: "⬆️" },
  { key: "notify_badges", label: "Badges", emoji: "🏆" },
  { key: "notify_post_likes", label: "Post likes", emoji: "❤️" },
  { key: "notify_post_comments", label: "Comments", emoji: "💬" },
  { key: "notify_comment_replies", label: "Replies", emoji: "↩️" },
];

// =====================================================
// Main Page Component
// =====================================================

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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

  const handlePushToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const canEnablePush = isSupported && permission !== "denied";

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Notifications</h1>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          Manage your notification preferences
        </p>
      </div>

      {/* Unified Notification Card */}
      <section className="glass rounded-2xl overflow-hidden">
        {/* Push Toggle Section */}
        <div className="p-4 flex items-center gap-4">
          {/* Mobile Preview */}
          <div className="flex-shrink-0 py-2">
            <MobilePushPreview isEnabled={isSubscribed} />
          </div>

          {/* Toggle Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                  isSubscribed ? "bg-[var(--color-accent-cyan)]/20" : "bg-white/10"
                )}
              >
                {isSubscribed ? (
                  <Bell size={16} className="text-[var(--color-accent-cyan)]" />
                ) : (
                  <BellOff size={16} className="text-[var(--color-text-muted)]" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {isSubscribed ? "Push On" : "Push Off"}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] leading-tight">
                  {!isSupported
                    ? "Not supported"
                    : permission === "denied"
                      ? "Blocked in browser"
                      : isSubscribed
                        ? "Receiving notifications"
                        : "Enable for real-time updates"}
                </p>
              </div>
            </div>

            <button
              onClick={handlePushToggle}
              disabled={!canEnablePush || isPushLoading}
              className={cn(
                "w-full px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                isSubscribed
                  ? "bg-white/10 text-[var(--color-text-primary)] hover:bg-white/15"
                  : "bg-[var(--color-accent-cyan)] text-black hover:bg-[var(--color-accent-cyan)]/90",
                (!canEnablePush || isPushLoading) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isPushLoading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  Processing...
                </span>
              ) : isSubscribed ? (
                "Turn Off"
              ) : (
                "Enable Push"
              )}
            </button>

            {permission === "denied" && (
              <p className="text-[10px] text-amber-400 mt-1.5 flex items-center gap-1">
                <Smartphone size={10} />
                Unblock in browser settings
              </p>
            )}
          </div>
        </div>

        {/* Preferences Section - Always visible when subscribed */}
        {isSubscribed && (
          <>
            <div className="border-t border-white/[0.06]" />

            {/* Compact preferences header with saving indicator */}
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Preferences
              </span>
              {/* Fixed height saving indicator - prevents layout shift */}
              <span
                className={cn(
                  "text-[10px] text-[var(--color-text-muted)] flex items-center gap-1 transition-opacity h-4",
                  isSaving ? "opacity-100" : "opacity-0"
                )}
              >
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Saving...
              </span>
            </div>

            {/* Compact toggle grid */}
            {isLoading ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : (
              <div className="px-3 pb-3 grid grid-cols-2 gap-x-2 gap-y-0.5">
                {NOTIFICATION_ITEMS.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm flex-shrink-0">{item.emoji}</span>
                      <span className="text-xs text-[var(--color-text-secondary)] truncate">
                        {item.label}
                      </span>
                    </div>
                    <Toggle
                      checked={settings?.[item.key] ?? true}
                      onChange={(checked) => updateSetting(item.key, checked)}
                      disabled={isSaving}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Browser Info - Collapsed by default, only for reference */}
      <details className="glass rounded-xl overflow-hidden">
        <summary className="px-4 py-3 text-xs text-[var(--color-text-muted)] cursor-pointer hover:bg-white/[0.03] transition-colors">
          About push notifications
        </summary>
        <div className="px-4 pb-3 text-[11px] text-[var(--color-text-muted)] space-y-2 border-t border-white/[0.06] pt-3">
          <p>Push notifications require browser permission and app settings.</p>
          <p>If blocked, update your browser&apos;s site settings to re-enable.</p>
        </div>
      </details>
    </div>
  );
}
