"use client";

import Image from "next/image";

interface ProfileCardProps {
  imageUrl?: string;
  fullName?: string | null;
  username?: string | null;
}

export default function ProfileCard({ imageUrl, fullName, username }: ProfileCardProps) {
  const displayName = fullName || username || "Anonymous";
  const displayUsername = username || "user";
  const initial = displayName.charAt(0).toUpperCase();

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
          <p className="text-base font-semibold text-[var(--color-text-primary)] truncate">
            {displayName}
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">@{displayUsername}</p>
        </div>
      </div>
    </section>
  );
}
