"use client";

import { useState, useEffect } from "react";
import { Share2, Copy, Check, Linkedin } from "lucide-react";

interface ShareButtonsProps {
  url: string;
  title: string;
  oneLiner?: string;
}

export default function ShareButtons({ url, title, oneLiner }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const fullUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${url}`
      : `https://ccgather.com${url}`;

  const shareText = oneLiner || title;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleShareX = () => {
    const text = encodeURIComponent(`${shareText}\n\n`);
    const shareUrl = encodeURIComponent(fullUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${shareUrl}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleShareLinkedIn = () => {
    const shareUrl = encodeURIComponent(fullUrl);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: shareText,
          url: fullUrl,
        });
      } catch {
        // User cancelled or error
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* X (Twitter) */}
      <button
        onClick={handleShareX}
        className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-section-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-section-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
        aria-label="Share on X"
      >
        <span className="text-lg font-bold">𝕏</span>
      </button>

      {/* LinkedIn */}
      <button
        onClick={handleShareLinkedIn}
        className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-section-bg)] text-[var(--color-text-muted)] hover:bg-[#0A66C2]/20 hover:text-[#0A66C2] transition-colors"
        aria-label="Share on LinkedIn"
      >
        <Linkedin className="w-5 h-5" />
      </button>

      {/* Copy Link */}
      <button
        onClick={handleCopyLink}
        className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
          copied
            ? "bg-green-500/20 text-green-600 dark:text-green-400"
            : "bg-[var(--color-section-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-section-bg-hover)] hover:text-[var(--color-text-primary)]"
        }`}
        aria-label={copied ? "Link copied" : "Copy link"}
      >
        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
      </button>

      {/* Native Share (Mobile) */}
      {canShare && (
        <button
          onClick={handleNativeShare}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-section-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-section-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Share"
        >
          <Share2 className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
