"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, Smartphone, Monitor, Loader2, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/use-push-notifications";

// App Logo Component for notifications
function AppLogo({ size = 24 }: { size?: number }) {
  return (
    <Image src="/logos/logo.png" alt="CCgather" width={size} height={size} className="rounded-md" />
  );
}

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
  notify_sound_enabled: boolean;
}

type PreviewTab = "mobile" | "desktop";

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
    <div className="relative mx-auto w-[170px] select-none">
      {/* Phone Frame */}
      <div className="relative bg-zinc-900 rounded-[22px] p-[4px] shadow-lg ring-1 ring-white/10">
        {/* Screen */}
        <div className="relative bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[18px] overflow-hidden h-[230px]">
          {/* Status Bar */}
          <div className="flex items-center justify-between px-3 pt-2">
            <span className="text-[8px] text-white/60 font-medium">9:41</span>
            <div className="w-3.5 h-[6px] rounded-sm border border-white/50 relative">
              <div className="absolute inset-[1px] right-[2px] bg-white/60 rounded-[1px]" />
            </div>
          </div>

          {/* Clock */}
          <div className="text-center pt-1.5 pb-2.5">
            <div className="text-[18px] font-light text-white/90 tracking-tight">9:41</div>
            <div className="text-[7px] text-white/40">Monday, January 27</div>
          </div>

          {/* Notifications Stack */}
          <div className="px-2 space-y-1.5">
            <AnimatePresence mode="wait">
              <motion.div
                key={`n1-${isEnabled}`}
                variants={notifVariants}
                initial="hidden"
                animate={isEnabled ? "visible" : "disabled"}
                className="rounded-xl p-2 bg-white/15 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 flex-shrink-0">
                    <AppLogo size={24} />
                  </div>
                  <p className="text-[8px] text-white font-medium truncate">
                    vibelabs liked your post
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
                className="rounded-xl p-2 bg-white/10 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 flex-shrink-0">
                    <AppLogo size={24} />
                  </div>
                  <p className="text-[8px] text-white/80 font-medium truncate">Rank #48 (+4)</p>
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
                className="rounded-xl p-2 bg-white/5 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 flex-shrink-0 opacity-60">
                    <AppLogo size={24} />
                  </div>
                  <p className="text-[8px] text-white/50 font-medium truncate">new comment</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom Fade */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none" />
        </div>

        {/* Dynamic Island */}
        <div className="absolute top-[4px] left-1/2 -translate-x-1/2 w-12 h-3.5 bg-black rounded-full" />
      </div>
    </div>
  );
}

// =====================================================
// Desktop Push Preview Component (Windows-style toast)
// =====================================================

function DesktopPushPreview({ isEnabled }: { isEnabled: boolean }) {
  return (
    <div className="relative select-none">
      {/* Desktop Monitor Frame - Thicker bezel for realistic look */}
      <div className="relative bg-zinc-700 rounded-2xl p-3 shadow-xl ring-1 ring-white/10 w-[300px]">
        {/* Inner bezel */}
        <div className="bg-zinc-900 rounded-xl p-1">
          {/* Screen Content */}
          <div className="relative bg-gradient-to-br from-[#0a0a14] to-[#12121f] rounded-lg overflow-hidden h-[170px]">
            {/* Desktop Wallpaper Pattern */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-6 left-6 w-24 h-24 rounded-full bg-blue-500/30 blur-3xl" />
              <div className="absolute bottom-12 right-10 w-20 h-20 rounded-full bg-purple-500/30 blur-3xl" />
            </div>

            {/* Desktop Icons */}
            <div className="absolute top-4 left-4 space-y-3">
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 rounded-lg bg-blue-500/50 shadow-lg" />
                <span className="text-[6px] text-white/50">Files</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 rounded-lg bg-green-500/50 shadow-lg" />
                <span className="text-[6px] text-white/50">Browser</span>
              </div>
            </div>

            {/* Taskbar */}
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-black/80 backdrop-blur-sm flex items-center px-3">
              <div className="flex gap-1.5">
                <div className="w-4 h-4 rounded bg-blue-500/70" />
                <div className="w-4 h-4 rounded bg-white/20" />
                <div className="w-4 h-4 rounded bg-white/20" />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400/70" />
                <span className="text-[7px] text-white/60">9:41 AM</span>
              </div>
            </div>

            {/* Windows Toast Notifications (Bottom Right) - More visible */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`desktop-notif-${isEnabled}`}
                initial={{ opacity: 0, x: 30, y: 10 }}
                animate={
                  isEnabled
                    ? {
                        opacity: 1,
                        x: 0,
                        y: 0,
                        transition: { type: "spring", stiffness: 300, damping: 25 },
                      }
                    : { opacity: 0.25, x: 15, y: 5 }
                }
                className="absolute bottom-8 right-2 w-[130px] bg-[#1a1a28] rounded-lg shadow-2xl border border-white/15 overflow-hidden"
              >
                {/* App Header */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-white/10 bg-white/5">
                  <div className="w-4 h-4 flex-shrink-0">
                    <AppLogo size={16} />
                  </div>
                  <span className="text-[8px] text-white/80 font-medium">CCgather</span>
                  <span className="ml-auto text-[7px] text-white/40">now</span>
                </div>
                {/* Notification Content */}
                <div className="px-2 py-2">
                  <p className="text-[9px] font-medium text-white mb-0.5">
                    vibelabs liked your post
                  </p>
                  <p className="text-[7px] text-white/60">Click to view</p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Second Toast (stacked behind) - More visible */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`desktop-notif-2-${isEnabled}`}
                initial={{ opacity: 0, x: 30 }}
                animate={
                  isEnabled
                    ? {
                        opacity: 0.85,
                        x: 0,
                        transition: { type: "spring", stiffness: 300, damping: 25, delay: 0.1 },
                      }
                    : { opacity: 0.15, x: 15 }
                }
                className="absolute bottom-[100px] right-2 w-[130px] bg-[#1a1a28]/95 rounded-lg shadow-xl border border-white/10 overflow-hidden"
              >
                <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-white/10 bg-white/5">
                  <div className="w-4 h-4 flex-shrink-0">
                    <AppLogo size={16} />
                  </div>
                  <span className="text-[8px] text-white/70 font-medium">CCgather</span>
                  <span className="ml-auto text-[7px] text-white/30">2m</span>
                </div>
                <div className="px-2 py-2">
                  <p className="text-[9px] font-medium text-white/80">Rank #48 (+4)</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Monitor Stand - More realistic */}
        <div className="flex flex-col items-center mt-1">
          <div className="w-8 h-3 bg-zinc-600 rounded-t" />
          <div className="w-16 h-1.5 bg-zinc-600 rounded-b" />
        </div>
      </div>
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
  size = "default",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "default" | "large";
}) {
  const isLarge = size === "large";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative rounded-full transition-colors",
        isLarge ? "w-12 h-6" : "w-9 h-5",
        checked ? "bg-[var(--color-accent-cyan)]" : "bg-[var(--color-text-disabled)]",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 rounded-full bg-white transition-transform shadow-sm",
          isLarge ? "w-5 h-5" : "w-4 h-4",
          checked ? (isLarge ? "translate-x-6" : "translate-x-4") : "translate-x-0"
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
  const [previewTab, setPreviewTab] = useState<PreviewTab>("mobile");

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
        {/* Push Toggle Header */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                  isSubscribed ? "bg-[var(--color-accent-cyan)]/20" : "bg-white/10"
                )}
              >
                {isPushLoading ? (
                  <Loader2 size={18} className="animate-spin text-[var(--color-text-muted)]" />
                ) : isSubscribed ? (
                  <Bell size={18} className="text-[var(--color-accent-cyan)]" />
                ) : (
                  <BellOff size={18} className="text-[var(--color-text-muted)]" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Push Notifications
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  {!isSupported
                    ? "Not supported in this browser"
                    : permission === "denied"
                      ? "Blocked - check browser settings"
                      : isSubscribed
                        ? "Enabled"
                        : "Disabled"}
                </p>
              </div>
            </div>

            <Toggle
              checked={isSubscribed}
              onChange={handlePushToggle}
              disabled={!canEnablePush || isPushLoading}
              size="large"
            />
          </div>

          {permission === "denied" && (
            <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
              <Smartphone size={10} />
              Unblock in browser settings to enable
            </p>
          )}
        </div>

        {/* Sound Toggle - Only show when subscribed */}
        {isSubscribed && (
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                    settings?.notify_sound_enabled
                      ? "bg-[var(--color-accent-cyan)]/20"
                      : "bg-white/10"
                  )}
                >
                  {settings?.notify_sound_enabled ? (
                    <Volume2 size={18} className="text-[var(--color-accent-cyan)]" />
                  ) : (
                    <VolumeX size={18} className="text-[var(--color-text-muted)]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Notification Sound
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {settings?.notify_sound_enabled ? "Sound on" : "Silent"}
                  </p>
                </div>
              </div>

              <Toggle
                checked={settings?.notify_sound_enabled ?? true}
                onChange={(checked) => updateSetting("notify_sound_enabled", checked)}
                disabled={isSaving}
                size="large"
              />
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
              May be overridden by device settings
            </p>
          </div>
        )}

        {/* Preview Section with Tabs */}
        <div className="p-4">
          {/* Tab Buttons - Compact */}
          <div className="flex items-center gap-1 mb-4">
            <button
              onClick={() => setPreviewTab("mobile")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                previewTab === "mobile"
                  ? "bg-[var(--color-accent-cyan)]/20 text-[var(--color-accent-cyan)]"
                  : "text-[var(--color-text-muted)] hover:bg-white/5"
              )}
            >
              <Smartphone size={12} />
              Mobile
            </button>
            <button
              onClick={() => setPreviewTab("desktop")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                previewTab === "desktop"
                  ? "bg-[var(--color-accent-cyan)]/20 text-[var(--color-accent-cyan)]"
                  : "text-[var(--color-text-muted)] hover:bg-white/5"
              )}
            >
              <Monitor size={12} />
              Desktop
            </button>
          </div>

          {/* Preview Area - Fixed height to prevent layout shift */}
          <div className="flex justify-center items-center h-[260px]">
            <AnimatePresence mode="wait">
              {previewTab === "mobile" ? (
                <motion.div
                  key="mobile"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <MobilePushPreview isEnabled={isSubscribed} />
                </motion.div>
              ) : (
                <motion.div
                  key="desktop"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <DesktopPushPreview isEnabled={isSubscribed} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Preferences Section - Always visible when subscribed */}
        {isSubscribed && (
          <>
            <div className="border-t border-white/[0.06]" />

            {/* Compact preferences header with saving indicator */}
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Notify me about
              </span>
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
              <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-0.5">
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

      {/* Browser/OS Support Guide - Open by default */}
      <details open className="glass rounded-xl overflow-hidden">
        <summary className="px-4 py-3 text-xs text-[var(--color-text-muted)] cursor-pointer hover:bg-white/[0.03] transition-colors flex items-center justify-between">
          <span>Browser &amp; OS Support Guide</span>
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Help</span>
        </summary>
        <div className="border-t border-white/[0.06]">
          {/* Desktop Browsers */}
          <div className="px-4 py-3 border-b border-[var(--border-default)]">
            <p className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
              Desktop
            </p>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">Chrome / Edge / Brave</span>
                <span className="text-[var(--color-success)] font-medium">✓ Supported</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">Firefox</span>
                <span className="text-[var(--color-success)] font-medium">✓ Supported</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">Safari (macOS 13+)</span>
                <span className="text-[var(--color-success)] font-medium">✓ Supported</span>
              </div>
            </div>
          </div>

          {/* Mobile */}
          <div className="px-4 py-3 border-b border-[var(--border-default)]">
            <p className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
              Mobile
            </p>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">Android Chrome</span>
                <span className="text-[var(--color-success)] font-medium">✓ Supported</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">iOS Safari (16.4+)</span>
                <span className="text-amber-600 font-medium">⚠ Add to Home Screen</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">iOS Chrome / Firefox</span>
                <span className="text-[var(--color-error)] font-medium">✗ Not supported</span>
              </div>
            </div>
          </div>

          {/* iOS Instructions */}
          <div className="px-4 py-3 border-b border-[var(--border-default)] bg-[var(--color-warning-bg)]">
            <p className="text-[10px] font-medium text-amber-600 mb-1.5">📱 iOS Users</p>
            <ol className="text-[11px] text-[var(--color-text-muted)] space-y-1 list-decimal list-inside">
              <li>
                Open this site in <span className="text-[var(--color-text-secondary)]">Safari</span>
              </li>
              <li>
                Tap <span className="text-[var(--color-text-secondary)]">Share</span> button
              </li>
              <li>
                Select{" "}
                <span className="text-[var(--color-text-secondary)]">
                  &quot;Add to Home Screen&quot;
                </span>
              </li>
              <li>Open from Home Screen, then enable push</li>
            </ol>
          </div>

          {/* Troubleshooting */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
              Troubleshooting
            </p>
            <div className="space-y-2 text-[11px] text-[var(--color-text-muted)]">
              <p>
                <span className="text-[var(--color-text-secondary)]">Blocked?</span> Check browser
                settings → Site permissions → Notifications
              </p>
              <p>
                <span className="text-[var(--color-text-secondary)]">Not working?</span> Try
                refreshing the page or clearing browser cache
              </p>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
