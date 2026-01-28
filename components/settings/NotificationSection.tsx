"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellOff,
  Smartphone,
  Loader2,
  Trophy,
  TrendingUp,
  Heart,
  MessageCircle,
  Reply,
  Award,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/usePushNotifications";

// =====================================================
// Types
// =====================================================

interface NotificationSettings {
  notify_submissions: boolean;
  notify_rank_updates: boolean;
  notify_level_up: boolean;
  notify_badges: boolean;
  post_likes: boolean;
  post_comments: boolean;
  comment_replies: boolean;
}

// =====================================================
// Mobile Push Preview Component
// =====================================================

const notificationVariants = {
  hidden: { opacity: 0, y: -20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 400, damping: 25 },
  },
  disabled: { opacity: 0.3, scale: 0.95 },
};

const secondNotificationVariants = {
  hidden: { opacity: 0, y: -15, scale: 0.9 },
  visible: {
    opacity: 0.7,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 400, damping: 25, delay: 0.15 },
  },
  disabled: { opacity: 0.15, scale: 0.9 },
};

function MobilePushPreview({ isEnabled }: { isEnabled: boolean }) {
  return (
    <div className="relative mx-auto w-[140px] select-none flex-shrink-0">
      {/* Phone Frame */}
      <div className="relative bg-zinc-900 rounded-[16px] p-[3px] shadow-xl ring-1 ring-white/10">
        {/* Screen */}
        <div className="relative bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[14px] overflow-hidden h-[180px]">
          {/* Status Bar */}
          <div className="flex items-center justify-between px-2.5 pt-1">
            <span className="text-[7px] text-white/60 font-medium">9:41</span>
            <div className="w-2.5 h-1.5 rounded-sm border border-white/50 relative">
              <div className="absolute inset-[1px] right-[2px] bg-white/60 rounded-[1px]" />
            </div>
          </div>

          {/* Clock */}
          <div className="text-center pt-1 pb-1.5">
            <div className="text-[14px] font-light text-white/90 tracking-tight">9:41</div>
            <div className="text-[6px] text-white/40">Monday, January 27</div>
          </div>

          {/* Push Notifications */}
          <div className="px-1.5 space-y-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={`notif-1-${isEnabled}`}
                variants={notificationVariants}
                initial="hidden"
                animate={isEnabled ? "visible" : "disabled"}
                className="rounded-lg p-1.5 backdrop-blur-md bg-white/15"
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-gradient-to-br from-[#00D4AA] to-[#0099CC] flex items-center justify-center flex-shrink-0">
                    <span className="text-[5px] font-bold text-white">CC</span>
                  </div>
                  <p className="text-[6px] text-white/90 font-medium truncate">
                    vibelabs liked your...
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={`notif-2-${isEnabled}`}
                variants={secondNotificationVariants}
                initial="hidden"
                animate={isEnabled ? "visible" : "disabled"}
                className="rounded-lg p-1.5 backdrop-blur-md bg-white/10"
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-gradient-to-br from-[#00D4AA] to-[#0099CC] flex items-center justify-center flex-shrink-0">
                    <span className="text-[5px] font-bold text-white">CC</span>
                  </div>
                  <p className="text-[6px] text-white/70 font-medium truncate">Rank #48 (+4)</p>
                </div>
              </motion.div>
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isEnabled ? 0.4 : 0.1 }}
              className="rounded-lg p-1.5 backdrop-blur-md bg-white/5"
            >
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-gradient-to-br from-[#00D4AA] to-[#0099CC] flex items-center justify-center flex-shrink-0 opacity-60">
                  <span className="text-[5px] font-bold text-white">CC</span>
                </div>
                <p className="text-[6px] text-white/50 font-medium truncate">new comment</p>
              </div>
            </motion.div>
          </div>

          {/* Bottom Gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none" />
        </div>

        {/* Dynamic Island */}
        <div className="absolute top-[3px] left-1/2 -translate-x-1/2 w-8 h-2.5 bg-black rounded-full" />
      </div>

      {/* Status Label */}
      <motion.div
        className={cn(
          "absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium",
          isEnabled
            ? "bg-[var(--color-accent-cyan)]/20 text-[var(--color-accent-cyan)]"
            : "bg-white/10 text-[var(--color-text-muted)]"
        )}
        animate={{ scale: isEnabled ? 1 : 0.95, opacity: isEnabled ? 1 : 0.6 }}
      >
        {isEnabled ? <Bell size={8} /> : <BellOff size={8} />}
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
        "relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0",
        checked ? "bg-[var(--color-accent-cyan)]" : "bg-white/20",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] w-4 h-4 rounded-full bg-white transition-transform shadow-sm",
          checked ? "translate-x-[22px]" : "translate-x-[3px]"
        )}
      />
    </button>
  );
}

// =====================================================
// Preference Item Component
// =====================================================

function PreferenceItem({
  icon: Icon,
  label,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-1">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-[var(--color-accent-cyan)]" />
        <span className="text-xs text-[var(--color-text-primary)]">{label}</span>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// =====================================================
// Notification Items Config
// =====================================================

const PREFERENCE_ITEMS: {
  key: keyof NotificationSettings;
  label: string;
  icon: React.ElementType;
}[] = [
  { key: "notify_submissions", label: "Submissions", icon: Send },
  { key: "notify_rank_updates", label: "Rank changes", icon: TrendingUp },
  { key: "notify_level_up", label: "Level up", icon: Trophy },
  { key: "notify_badges", label: "Badges", icon: Award },
  { key: "post_likes", label: "Post likes", icon: Heart },
  { key: "post_comments", label: "Comments", icon: MessageCircle },
  { key: "comment_replies", label: "Replies", icon: Reply },
];

// =====================================================
// NotificationSection Component
// =====================================================

export default function NotificationSection() {
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
        {/* Main Toggle Section */}
        <div className="p-4">
          <div className="flex items-center gap-4">
            {/* Mobile Preview */}
            <MobilePushPreview isEnabled={isSubscribed} />

            {/* Status & Button */}
            <div className="flex-1 min-w-0">
              {/* Status */}
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                    isSubscribed ? "bg-[var(--color-accent-cyan)]/20" : "bg-white/10"
                  )}
                >
                  {isSubscribed ? (
                    <Bell size={18} className="text-[var(--color-accent-cyan)]" />
                  ) : (
                    <BellOff size={18} className="text-[var(--color-text-muted)]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Push {isSubscribed ? "On" : "Off"}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {!isSupported
                      ? "Not supported"
                      : permission === "denied"
                        ? "Blocked in settings"
                        : isSubscribed
                          ? "Receiving notifications"
                          : "Enable to stay updated"}
                  </p>
                </div>
              </div>

              {/* Toggle Button */}
              <button
                onClick={handlePushToggle}
                disabled={!canEnablePush || isPushLoading}
                className={cn(
                  "w-full py-2.5 rounded-xl text-xs font-medium transition-all",
                  isSubscribed
                    ? "bg-white/10 text-[var(--color-text-primary)] hover:bg-white/15"
                    : "bg-[var(--color-accent-cyan)] text-black hover:bg-[var(--color-accent-cyan)]/90",
                  (!canEnablePush || isPushLoading) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isPushLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    Processing...
                  </span>
                ) : isSubscribed ? (
                  "Turn Off"
                ) : (
                  "Turn On"
                )}
              </button>

              {permission === "denied" && (
                <p className="text-[9px] text-amber-400 mt-1.5 flex items-center gap-1">
                  <Smartphone size={10} />
                  Check browser settings
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        {isSubscribed && (
          <div className="border-t border-white/10">
            <div className="px-4 py-2">
              <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Preferences
              </p>
            </div>

            {isLoading ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : (
              <div className="px-3 pb-3 grid grid-cols-2 gap-x-4 gap-y-0">
                {PREFERENCE_ITEMS.map((item) => (
                  <PreferenceItem
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    checked={settings?.[item.key] ?? true}
                    onChange={(checked) => updateSetting(item.key, checked)}
                    disabled={isSaving}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
