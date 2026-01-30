"use client";

import Image from "next/image";
import { RefreshCw } from "lucide-react";

interface ProfileCardProps {
  imageUrl?: string;
  fullName?: string | null;
  username?: string | null;
  onSync?: () => void;
  isSyncing?: boolean;
}

export default function ProfileCard({
  imageUrl,
  fullName,
  username,
  onSync,
  isSyncing,
}: ProfileCardProps) {
  const displayName = fullName || username || "Anonymous";
  const displayUsername = username || "user";
  const initial = displayName.charAt(0).toUpperCase();

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
          <p className="text-base font-semibold text-[var(--color-text-primary)] truncate">
            {displayName}
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">@{displayUsername}</p>
        </div>
      </div>
    </section>
  );
}
