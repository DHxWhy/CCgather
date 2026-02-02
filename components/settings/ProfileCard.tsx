"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { RefreshCw, Shuffle, Save, Trash2, Loader2 } from "lucide-react";

// CC0 licensed character-based styles only (no simple patterns/backgrounds)
const DICEBEAR_STYLES = [
  "pixel-art", // Pixel art characters
  "bottts", // Robot characters
  "lorelei", // Illustrated portraits
  "fun-emoji", // Fun emoji faces
  "notionists", // Notion-style avatars
  "open-peeps", // Hand-drawn people
  "thumbs", // Thumbs up characters
] as const;

function generateRandomAvatar(): string {
  const style = DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)];
  const seed = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
}

interface ProfileCardProps {
  imageUrl?: string; // GitHub avatar
  customAvatarUrl?: string | null; // DiceBear custom avatar
  fullName?: string | null;
  username?: string | null;
  onSync?: () => void;
  isSyncing?: boolean;
  onSaveCustomAvatar?: (url: string) => Promise<void>;
  onRemoveCustomAvatar?: () => Promise<void>;
}

export default function ProfileCard({
  imageUrl,
  customAvatarUrl,
  fullName,
  username,
  onSync,
  isSyncing,
  onSaveCustomAvatar,
  onRemoveCustomAvatar,
}: ProfileCardProps) {
  const displayName = fullName || username || "Anonymous";
  const displayUsername = username || "user";
  const initial = displayName.charAt(0).toUpperCase();

  // Preview state for generated avatar
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Determine which avatar to display (priority: preview > custom > github)
  const displayAvatarUrl = previewUrl || customAvatarUrl || imageUrl;
  const hasCustomAvatar = !!customAvatarUrl;
  const hasPreview = !!previewUrl;

  const handleGenerate = useCallback(() => {
    const newUrl = generateRandomAvatar();
    setPreviewUrl(newUrl);
  }, []);

  const handleSave = useCallback(async () => {
    if (!previewUrl || !onSaveCustomAvatar) return;
    setIsSaving(true);
    try {
      await onSaveCustomAvatar(previewUrl);
      setPreviewUrl(null); // Clear preview after save
    } catch (error) {
      console.error("Failed to save custom avatar:", error);
    } finally {
      setIsSaving(false);
    }
  }, [previewUrl, onSaveCustomAvatar]);

  const handleRemove = useCallback(async () => {
    if (!onRemoveCustomAvatar) return;
    setIsRemoving(true);
    try {
      await onRemoveCustomAvatar();
      setPreviewUrl(null); // Clear any preview
    } catch (error) {
      console.error("Failed to remove custom avatar:", error);
    } finally {
      setIsRemoving(false);
    }
  }, [onRemoveCustomAvatar]);

  const handleCancelPreview = useCallback(() => {
    setPreviewUrl(null);
  }, []);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">Profile</h2>
        {onSync && (
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg transition-colors disabled:opacity-50"
            title="Sync profile from GitHub"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync GitHub"}
          </button>
        )}
      </div>

      <div className="p-4 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
        {/* Profile Info with Generate button on right */}
        <div className="flex items-center gap-4">
          {displayAvatarUrl ? (
            <div className="relative shrink-0">
              <Image
                src={displayAvatarUrl}
                alt={displayName}
                width={56}
                height={56}
                className="rounded-xl object-cover"
                unoptimized={displayAvatarUrl.includes("dicebear.com")}
              />
              {hasPreview && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold">NEW</span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-14 h-14 shrink-0 rounded-xl bg-gradient-to-br from-primary to-[#B85C3D] flex items-center justify-center">
              <span className="text-white font-bold text-xl">{initial}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-[var(--color-text-primary)] truncate">
              {displayName}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">@{displayUsername}</p>
          </div>

          {/* Generate Button - Right side */}
          {onSaveCustomAvatar && (
            <button
              onClick={handleGenerate}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-card)] border border-[var(--border-default)] rounded-lg transition-colors"
              title="Generate random avatar"
            >
              <Shuffle className="w-4 h-4" />
              <span className="hidden sm:inline">Random</span>
            </button>
          )}
        </div>

        {/* Action Buttons - Only show when there's preview or custom avatar */}
        {(hasPreview || hasCustomAvatar) && (
          <div className="mt-3 pt-3 border-t border-[var(--border-default)] flex flex-wrap items-center gap-2">
            {/* Save Button (only show when preview exists) */}
            {hasPreview && onSaveCustomAvatar && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[var(--color-claude-coral)] hover:bg-[var(--color-claude-coral)]/90 rounded-lg transition-colors disabled:opacity-50"
                title="Save this avatar"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {isSaving ? "Saving..." : "Save"}
              </button>
            )}

            {/* Cancel Preview Button */}
            {hasPreview && (
              <button
                onClick={handleCancelPreview}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-card)] border border-[var(--border-default)] rounded-lg transition-colors"
                title="Cancel preview"
              >
                Cancel
              </button>
            )}

            {/* Remove Button (only show when custom avatar is saved, no preview) */}
            {hasCustomAvatar && !hasPreview && onRemoveCustomAvatar && (
              <button
                onClick={handleRemove}
                disabled={isRemoving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                title="Remove custom avatar and use GitHub avatar"
              >
                {isRemoving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                {isRemoving ? "Removing..." : "Use GitHub"}
              </button>
            )}

            {/* Helper text */}
            <span className="text-[10px] text-[var(--color-text-muted)]/70 ml-auto">
              {hasPreview ? "Preview mode" : "Custom avatar active"}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
