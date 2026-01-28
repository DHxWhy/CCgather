"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  BellOff,
  Heart,
  MessageCircle,
  Reply,
  User,
  TrendingUp,
  Mail,
  Megaphone,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/use-push-notifications";

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

interface NotificationSettingsProps {
  className?: string;
}

// =====================================================
// Setting Item Config
// =====================================================

const SETTING_ITEMS: {
  key: keyof NotificationSettings;
  label: string;
  description: string;
  icon: typeof Heart;
}[] = [
  {
    key: "post_likes",
    label: "Post Likes",
    description: "When someone likes your post",
    icon: Heart,
  },
  {
    key: "post_comments",
    label: "Post Comments",
    description: "When someone comments on your post",
    icon: MessageCircle,
  },
  {
    key: "comment_likes",
    label: "Comment Likes",
    description: "When someone likes your comment",
    icon: Heart,
  },
  {
    key: "comment_replies",
    label: "Comment Replies",
    description: "When someone replies to your comment",
    icon: Reply,
  },
  {
    key: "new_followers",
    label: "New Followers",
    description: "When someone follows you",
    icon: User,
  },
  {
    key: "mentions",
    label: "Mentions",
    description: "When someone mentions you",
    icon: MessageCircle,
  },
  {
    key: "rank_changes",
    label: "Rank Changes",
    description: "When your rank goes up or down",
    icon: TrendingUp,
  },
  {
    key: "system_announcements",
    label: "System Announcements",
    description: "Important updates and announcements",
    icon: Megaphone,
  },
  {
    key: "weekly_digest",
    label: "Weekly Digest",
    description: "Summary of your weekly activity",
    icon: Mail,
  },
  {
    key: "email_notifications",
    label: "Email Notifications",
    description: "Receive notifications via email",
    icon: Mail,
  },
];

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
        "relative w-10 h-5 rounded-full transition-colors",
        checked ? "bg-[var(--color-accent-cyan)]" : "bg-white/20",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

// =====================================================
// NotificationSettings Component
// =====================================================

export default function NotificationSettings({ className }: NotificationSettingsProps) {
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
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        setSettings(data.settings);
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

  if (isLoading) {
    return (
      <div className={cn("p-6", className)}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Push Notifications Section */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          Push Notifications
        </h3>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isSubscribed ? (
              <div className="w-10 h-10 rounded-full bg-[var(--color-accent-cyan)]/20 flex items-center justify-center">
                <Bell size={18} className="text-[var(--color-accent-cyan)]" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <BellOff size={18} className="text-[var(--color-text-muted)]" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {isSubscribed ? "Push enabled" : "Push disabled"}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {!isSupported
                  ? "Not supported in this browser"
                  : permission === "denied"
                    ? "Permission denied in browser settings"
                    : isSubscribed
                      ? "You'll receive notifications on this device"
                      : "Enable to receive notifications on this device"}
              </p>
            </div>
          </div>

          <button
            onClick={handlePushToggle}
            disabled={!isSupported || permission === "denied" || isPushLoading}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-medium transition-colors",
              isSubscribed
                ? "bg-white/10 text-[var(--color-text-primary)] hover:bg-white/20"
                : "bg-[var(--color-accent-cyan)] text-black hover:bg-[var(--color-accent-cyan)]/90",
              (!isSupported || permission === "denied" || isPushLoading) &&
                "opacity-50 cursor-not-allowed"
            )}
          >
            {isPushLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isSubscribed ? (
              "Disable"
            ) : (
              "Enable"
            )}
          </button>
        </div>
      </div>

      {/* Notification Types Section */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          Notification Types
        </h3>

        <div className="space-y-1">
          {SETTING_ITEMS.map((item) => {
            const Icon = item.icon;
            const isChecked = settings?.[item.key] ?? true;

            return (
              <div
                key={item.key}
                className="flex items-center justify-between gap-4 py-3 px-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-[var(--color-text-muted)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{item.description}</p>
                  </div>
                </div>

                <Toggle
                  checked={isChecked}
                  onChange={(checked) => updateSetting(item.key, checked)}
                  disabled={isSaving}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
