"use client";

import dynamic from "next/dynamic";

// Lazy load terminal animation for performance
const AuthTerminalAnimation = dynamic(
  () =>
    import("./AuthTerminalAnimation").then((mod) => ({
      default: mod.AuthTerminalAnimation,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-lg h-[320px] rounded-xl bg-white/5 animate-pulse" />
    ),
  }
);

export function AuthLeftPanel() {
  return (
    <div className="hidden lg:flex flex-col items-end justify-center w-full h-full bg-gradient-to-br from-[#0D0D0F] via-[#131316] to-[#0D0D0F] pr-16 pl-16">
      {/* Background pattern */}
      <div className="absolute inset-0 pattern-dots opacity-30" />

      {/* Glow effect */}
      <div
        className="absolute top-1/3 right-0 w-[400px] h-[300px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(ellipse, rgba(218, 119, 86, 0.3) 0%, transparent 70%)",
        }}
      />

      {/* Content - Terminal aligned to right */}
      <div className="relative z-10 w-full max-w-md">
        <AuthTerminalAnimation />
      </div>
    </div>
  );
}
