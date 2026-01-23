"use client";

import { useState } from "react";
import Image from "next/image";
import { Pencil, Check, X, Loader2 } from "lucide-react";

interface ProfileCardProps {
  imageUrl?: string;
  fullName?: string | null;
  username?: string | null;
  displayName?: string | null;
  onDisplayNameSave?: (name: string) => Promise<void>;
}

export default function ProfileCard({
  imageUrl,
  fullName,
  username,
  displayName: dbDisplayName,
  onDisplayNameSave,
}: ProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Priority: DB display_name > Clerk fullName > username
  const displayName = dbDisplayName || fullName || username || "Anonymous";
  const displayUsername = username || "user";
  const initial = displayName.charAt(0).toUpperCase();

  const handleEditStart = () => {
    setEditValue(displayName);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const handleSave = async () => {
    if (!onDisplayNameSave || !editValue.trim()) return;

    setIsSaving(true);
    try {
      await onDisplayNameSave(editValue.trim());
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save display name:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <section>
      <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Profile</h2>
      <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--border-default)]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={displayName}
            width={56}
            height={56}
            className="rounded-xl object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-[#B85C3D] flex items-center justify-center">
            <span className="text-white font-bold text-xl">{initial}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={50}
                autoFocus
                className="flex-1 min-w-0 px-2 py-1 text-base font-semibold bg-[var(--color-bg-secondary)] border border-[var(--border-default)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={handleSave}
                disabled={isSaving || !editValue.trim()}
                className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <p className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                {displayName}
              </p>
              {onDisplayNameSave && (
                <button
                  onClick={handleEditStart}
                  className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] opacity-0 group-hover:opacity-100 transition-all"
                  title="Edit display name"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <p className="text-sm text-[var(--color-text-muted)]">@{displayUsername}</p>
        </div>
      </div>
    </section>
  );
}
