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
      <div className="w-full max-w-md h-[280px] rounded-xl bg-white/5 animate-pulse" />
    ),
  }
);

export function AuthLeftPanel() {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-[#0D0D0F] via-[#131316] to-[#0D0D0F] p-8 lg:p-12">
      {/* Background pattern */}
      <div className="absolute inset-0 pattern-dots opacity-30" />

      {/* Glow effect */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(ellipse, rgba(218, 119, 86, 0.3) 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg">
        {/* Terminal Animation */}
        <AuthTerminalAnimation />

        {/* Tagline */}
        <h2 className="mt-8 text-2xl lg:text-3xl font-bold text-white">
          Proof of your
          <br />
          <span className="shimmer-text">Claude Code dedication</span>
        </h2>

        <p className="mt-4 text-[var(--color-text-muted)] max-w-sm">
          Join the global community of developers serious about AI-first
          development.
        </p>
      </div>
    </div>
  );
}
