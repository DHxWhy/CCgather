"use client";

import dynamic from "next/dynamic";

// Lazy load mini Globe
const Globe = dynamic(
  () => import("@/components/globe/Globe").then((mod) => ({ default: mod.Globe })),
  { ssr: false, loading: () => <div className="w-10 h-10 rounded-lg bg-white/5 animate-pulse" /> }
);

interface MiniGlobeButtonProps {
  onClick: () => void;
  userCountryCode?: string;
}

export function MiniGlobeButton({ onClick, userCountryCode }: MiniGlobeButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative w-10 h-10 rounded-lg glass overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-[var(--color-claude-coral)]/50 transition-all active:scale-95 flex-shrink-0"
      title="View Global Stats"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ transform: "scale(0.1)", transformOrigin: "center" }}>
          <Globe size={400} userCountryCode={userCountryCode} />
        </div>
      </div>
      {/* Overlay gradient for better visibility */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/20 pointer-events-none" />
    </button>
  );
}
