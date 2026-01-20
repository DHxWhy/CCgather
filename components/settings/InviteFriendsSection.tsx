"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Users, Gift, EyeOff } from "lucide-react";
import { BADGES } from "@/lib/constants/badges";

interface InviteFriendsSectionProps {
  referralCode: string | null;
  referralCount: number;
  hideProfileOnInvite?: boolean;
  onToggleHideProfile?: (value: boolean) => void;
}

// Get social badges sorted by requirement
const SOCIAL_BADGES = BADGES.filter((b) => b.category === "social").sort((a, b) => {
  // Extract number from condition string (hacky but works for our badges)
  const getThreshold = (badge: (typeof BADGES)[number]) => {
    if (badge.id === "recruiter") return 5;
    if (badge.id === "networker") return 10;
    if (badge.id === "influencer") return 20;
    if (badge.id === "social_star") return 30;
    if (badge.id === "social_legend") return 50;
    return 0;
  };
  return getThreshold(a) - getThreshold(b);
});

const BADGE_THRESHOLDS = [5, 10, 20, 30, 50];

export default function InviteFriendsSection({
  referralCode,
  referralCount,
  hideProfileOnInvite = false,
  onToggleHideProfile,
}: InviteFriendsSectionProps) {
  const [copied, setCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const inviteUrl =
    isMounted && referralCode ? `${window.location.origin}/join/${referralCode}` : "";

  const handleCopy = async () => {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Find next badge threshold
  const nextThreshold =
    BADGE_THRESHOLDS.find((t) => t > referralCount) ||
    BADGE_THRESHOLDS[BADGE_THRESHOLDS.length - 1];
  const prevThreshold = BADGE_THRESHOLDS.filter((t) => t <= referralCount).pop() || 0;
  const progressPercent = nextThreshold
    ? Math.min(100, ((referralCount - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
    : 100;

  if (!referralCode) {
    return null;
  }

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-4 h-4 text-[var(--color-claude-coral)]" />
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">Invite Friends</h2>
      </div>

      <div className="p-4 bg-[var(--color-section-bg)] rounded-xl border border-[var(--border-default)]">
        {/* Invite Link */}
        <div className="mb-4">
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">
            Your Invite Link
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--border-default)] rounded-lg text-sm text-[var(--color-text-primary)] truncate font-mono">
              {inviteUrl || "Loading..."}
            </div>
            <button
              onClick={handleCopy}
              disabled={!inviteUrl}
              className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all min-w-[80px] ${
                copied
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-[var(--color-claude-coral)] hover:bg-[var(--color-claude-terracotta)] text-white"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="hidden sm:inline">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="hidden sm:inline">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hide Profile Toggle */}
        {onToggleHideProfile && (
          <div className="flex items-center justify-between mb-4 p-3 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--border-default)]">
            <div className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span className="text-sm text-[var(--color-text-secondary)]">
                Hide my profile on invite page
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={hideProfileOnInvite}
              onClick={() => onToggleHideProfile(!hideProfileOnInvite)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                hideProfileOnInvite ? "bg-[var(--color-claude-coral)]" : "bg-white/10"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  hideProfileOnInvite ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}

        {/* Friends Joined Count */}
        <div className="flex items-center gap-2 mb-4 p-3 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--border-default)]">
          <Users className="w-4 h-4 text-[var(--color-claude-coral)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-text-primary)]">{referralCount}</span>{" "}
            friend{referralCount !== 1 ? "s" : ""} joined via your link
          </span>
        </div>

        {/* Badge Progress */}
        <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--border-default)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-2">
            Unlock badges by inviting friends:
          </div>

          {/* Badge Icons Row */}
          <div className="flex items-center justify-between mb-2">
            {SOCIAL_BADGES.map((badge, index) => {
              const threshold = BADGE_THRESHOLDS[index] || 0;
              const isEarned = referralCount >= threshold;

              return (
                <div
                  key={badge.id}
                  className="flex flex-col items-center gap-1"
                  title={`${badge.name}: ${badge.description}`}
                >
                  <span
                    className={`text-lg sm:text-xl transition-all ${
                      isEarned ? "" : "grayscale opacity-50"
                    }`}
                  >
                    {badge.icon}
                  </span>
                  <span
                    className={`text-[10px] font-medium ${
                      isEarned
                        ? "text-[var(--color-claude-coral)]"
                        : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {threshold}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          {referralCount < 50 && (
            <div className="mt-3">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--color-claude-coral)] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {referralCount}/{nextThreshold}
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {Math.round(progressPercent)}%
                </span>
              </div>
            </div>
          )}

          {referralCount >= 50 && (
            <div className="mt-2 text-center text-xs text-[var(--color-claude-coral)] font-medium">
              All social badges unlocked!
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
